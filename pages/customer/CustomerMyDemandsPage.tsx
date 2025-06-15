

import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import AiFeatureButton from '../../components/AiFeatureButton'; // Added
import { DemandItem, DemandStatus, StockItem, StockStatus, AiStockSuggestion } from '../../types'; // Added StockItem, StockStatus, AiStockSuggestion
import { DocumentTextIcon, InformationCircleIcon, TagIcon, CalendarDaysIcon, HashtagIcon, ArchiveBoxIcon, BeakerIcon, SparklesIcon, BuildingStorefrontIcon, CubeIcon } from '@heroicons/react/24/outline'; // Added CubeIcon
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { useLocale } from '../../LocaleContext';
import { getTranslatedDemandStatus, getTranslatedStockStatus } from '../../locales'; // Added getTranslatedStockStatus
import { CUSTOMER_DEMANDS_STORAGE_KEY, MANUFACTURER_STOCK_STORAGE_KEY } from '../../constants'; // Added MANUFACTURER_STOCK_STORAGE_KEY


let ai: GoogleGenAI | null = null;
try {
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } else {
    console.warn("API_KEY environment variable is not set for CustomerMyDemandsPage. Real AI features will not work."); 
  }
} catch (error) {
  console.error("Error initializing GoogleGenAI for CustomerMyDemandsPage:", error); 
}


const getStatusBadgeColor = (status: DemandStatus): string => {
  switch (status) {
    case DemandStatus.RECEIVED:
      return 'bg-sky-500 text-sky-50';
    case DemandStatus.PROCESSING:
      return 'bg-amber-500 text-amber-50';
    case DemandStatus.COMPLETED:
      return 'bg-green-500 text-green-50';
    case DemandStatus.CANCELLED:
      return 'bg-red-500 text-red-50';
    default:
      return 'bg-slate-500 text-slate-50';
  }
};

const CustomerMyDemandsPage: React.FC = () => { 
  const { t, locale } = useLocale();
  const [demands, setDemands] = useState<DemandItem[]>([]);
  const [allStockItems, setAllStockItems] = useState<StockItem[]>([]); // New state for all stock items
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDemandIdForAi, setSelectedDemandIdForAi] = useState<string | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [isAiLoadingForDemand, setIsAiLoadingForDemand] = useState<string | null>(null);

  // New state for "Suggest Similar Stock" feature
  const [selectedDemandIdForStockSuggestion, setSelectedDemandIdForStockSuggestion] = useState<string | null>(null);
  const [suggestedStock, setSuggestedStock] = useState<AiStockSuggestion[] | string | null>(null);
  const [isAiLoadingForStockSuggestion, setIsAiLoadingForStockSuggestion] = useState<string | null>(null);


  useEffect(() => {
    setIsLoading(true);
    try {
      const storedDemandsRaw = localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY);
      if (storedDemandsRaw) {
        const parsedDemands: DemandItem[] = JSON.parse(storedDemandsRaw);
        const ownDemands = parsedDemands.filter(item => !item.submittedByCompanyId);
        ownDemands.sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
        setDemands(ownDemands);
      }
      // Load all stock items for the "Suggest Similar Stock" feature
      const storedStockRaw = localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY);
      if (storedStockRaw) {
        const parsedStock: StockItem[] = JSON.parse(storedStockRaw);
        setAllStockItems(parsedStock.filter(s => s.status === StockStatus.AVAILABLE));
      }

    } catch (error) {
      console.error("Error loading demands or stock:", error);
    }
    setIsLoading(false);
  }, []);

  const parseJsonFromGeminiResponse = <T,>(text: string, featureNameKey: string): T | string => {
    let jsonStr = text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    try {
      return JSON.parse(jsonStr) as T;
    } catch (e) {
      console.error(`Failed to parse JSON response for ${t(featureNameKey as any)}:`, e, "Raw text:", text);
      return t('customerNewDemand_error_failedToParseJson', { featureName: t(featureNameKey as any), rawResponse: text.substring(0,100) });
    }
  };

  const generateDemandStatusExplanationWithGemini = async (demand: DemandItem): Promise<string> => {
    if (!ai) {
      return t('customerNewDemand_error_aiUnavailable');
    }

    const productDetails = `${demand.diameterType} Ø${demand.diameterFrom}-${demand.diameterTo}cm, Length: ${demand.length}m (${demand.quantity}pcs)`;
    const submissionDateFormatted = new Date(demand.submissionDate).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    const translatedStatus = getTranslatedDemandStatus(demand.status, t);
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';

    const prompt = `A customer wants a more detailed, AI-generated, friendly explanation of their timber demand status in ${promptLang}.
Demand details:
- ID: ${demand.id}
- Product: ${productDetails}
- Submitted: ${submissionDateFormatted}
- Current status: "${translatedStatus}" 

Task: Provide a 2-3 sentence generalized explanation of what this "${translatedStatus}" status might mean in practice in timber trading, and possibly what the next likely step in processing might be. Avoid specific promises or delivery times; provide general information. The response should only contain the generated explanation text, without any extra formatting or prefix/suffix. Respond in ${promptLang}.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      return response.text || t('customerMyDemands_error_failedToGenerateExplanation');
    } catch (error) {
      console.error("Error generating demand status explanation with Gemini:", error);
      return t('customerMyDemands_error_aiStatusExplanationGeneric');
    }
  };

  const handleAiDemandAnalysis = async (demand: DemandItem) => {
    if (selectedDemandIdForAi === demand.id && aiAnalysisResult) {
      setSelectedDemandIdForAi(null);
      setAiAnalysisResult(null);
      setIsAiLoadingForDemand(null);
      return;
    }

    setIsAiLoadingForDemand(demand.id);
    setSelectedDemandIdForAi(demand.id); 
    setAiAnalysisResult(null); 
    // Clear other AI feature results
    setSelectedDemandIdForStockSuggestion(null);
    setSuggestedStock(null);

    const result = await generateDemandStatusExplanationWithGemini(demand);
    
    setAiAnalysisResult(result);
    setIsAiLoadingForDemand(null);
  };

  const generateSimilarStockSuggestionsWithGemini = async (demand: DemandItem): Promise<AiStockSuggestion[] | string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
    
    const availableStock = allStockItems.filter(s => s.status === StockStatus.AVAILABLE);
    if (availableStock.length === 0) {
      return t('customerMyDemands_ai_suggestStock_noStockAvailable');
    }
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';

    const MAX_STOCK_ITEMS_TO_SEND = 30; // Limit the number of stock items sent in the prompt
    const relevantStockData = availableStock.slice(0, MAX_STOCK_ITEMS_TO_SEND).map(s => ({
        id: s.id,
        diameterType: s.diameterType,
        diameterFrom: s.diameterFrom,
        diameterTo: s.diameterTo,
        length: s.length,
        quantity: s.quantity,
        price: s.price,
        notes: s.notes?.substring(0,100), // Truncate notes
        sustainabilityInfo: s.sustainabilityInfo?.substring(0,100), // Truncate info
        uploadedByCompanyName: s.uploadedByCompanyName
    }));

    const prompt = `A customer on a timber trading platform has the following demand. Find 1-3 similar or alternative available stock items from the provided list.
For each suggestion, provide "stockItemId", a "reason" (why it's a good match/alternative, considering dimensions, quantity, price, notes), "matchStrength" (e.g., "High", "Medium", "Low", or a numeric percentage like "85%"), and "similarityScore" (numeric, 0.0-1.0).
Respond in JSON format as an array of objects in ${promptLang}.

Customer Demand:
- ID: ${demand.id}
- Diameter Type: ${demand.diameterType}
- Diameter: ${demand.diameterFrom}-${demand.diameterTo} cm
- Length: ${demand.length} m
- Quantity: ${demand.quantity} pcs
- Notes: ${demand.notes || 'N/A'}

Available Stock (Top ${relevantStockData.length} items):
${JSON.stringify(relevantStockData, null, 2)}

The response MUST ONLY contain the JSON array.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const parsedResult = parseJsonFromGeminiResponse<AiStockSuggestion[]>(response.text, "customerMyDemands_ai_suggestStock_title");
      return parsedResult;
    } catch (error) {
      console.error("Error generating similar stock suggestions:", error);
      return t('customerMyDemands_ai_suggestStock_errorGeneric');
    }
  };

  const handleSuggestSimilarStock = async (demand: DemandItem) => {
    if (selectedDemandIdForStockSuggestion === demand.id && suggestedStock) {
        setSelectedDemandIdForStockSuggestion(null);
        setSuggestedStock(null);
        setIsAiLoadingForStockSuggestion(null);
        return;
    }
    setIsAiLoadingForStockSuggestion(demand.id);
    setSelectedDemandIdForStockSuggestion(demand.id);
    setSuggestedStock(null);
    // Clear other AI feature results
    setSelectedDemandIdForAi(null);
    setAiAnalysisResult(null);

    const result = await generateSimilarStockSuggestionsWithGemini(demand);
    setSuggestedStock(result);
    setIsAiLoadingForStockSuggestion(null);
  };
  
  const getStockItemById = (id: string): StockItem | undefined => {
    return allStockItems.find(stock => stock.id === id);
  };


  if (isLoading) {
    return (
      <>
        <PageTitle title={t('customerMyDemands_title')} subtitle={t('customerMyDemands_subtitle')} icon={<DocumentTextIcon className="h-8 w-8" />} />
        <LoadingSpinner text={t('customerMyDemands_loadingDemands')} />
      </>
    );
  }

  return (
    <>
      <PageTitle title={t('customerMyDemands_title')} subtitle={t('customerMyDemands_subtitle')} icon={<DocumentTextIcon className="h-8 w-8" />} />
      
      {demands.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <InformationCircleIcon className="h-16 w-16 text-cyan-500 mx-auto mb-4" />
            <p className="text-slate-300 text-lg">{t('customerMyDemands_noDemands')}</p>
            <p className="text-slate-400 text-sm mt-2">{t('customerMyDemands_submitNewDemandPrompt')}</p>
            <Button variant="primary" size="md" className="mt-6">
              <NavLink to="/customer/new-demand">{t('menu_customer_newDemand')}</NavLink>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {demands.map(demand => (
            <Card key={demand.id} className="flex flex-col justify-between hover-glow transition-shadow duration-300">
              <div>
                <div className="p-4 border-b border-slate-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-semibold text-cyan-400 flex items-center">
                            <HashtagIcon className="h-5 w-5 mr-2 text-cyan-500" />
                            {t('customerMyDemands_demandId')}: {demand.id.substring(0, 10)}...
                            </h3>
                            <p className="text-xs text-slate-400 flex items-center mt-1">
                                <CalendarDaysIcon className="h-4 w-4 mr-1 text-slate-500" />
                                {t('customerMyDemands_submitted')}: {new Date(demand.submissionDate).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {demand.submittedByCompanyName && ( 
                                <p className="text-xs text-slate-400 flex items-center mt-1">
                                    <BuildingStorefrontIcon className="h-4 w-4 mr-1 text-slate-500" />
                                     {t('adminMatchmaking_byCompany', { companyName: demand.submittedByCompanyName })}
                                </p>
                            )}
                        </div>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(demand.status)}`}>
                            {getTranslatedDemandStatus(demand.status, t)}
                        </span>
                    </div>
                  </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center text-sm text-slate-300">
                    <ArchiveBoxIcon className="h-5 w-5 mr-2 text-cyan-400 shrink-0" />
                    <span>
                      <span className="font-medium text-slate-100">{t('customerMyDemands_features')}:</span> {demand.diameterType}, Ø {demand.diameterFrom}-{demand.diameterTo}cm, {t('customerNewDemand_length').toLowerCase()}: {demand.length}m, {demand.quantity}pcs
                    </span>
                  </div>
                   <div className="flex items-center text-sm text-slate-300">
                    <BeakerIcon className="h-5 w-5 mr-2 text-cyan-400 shrink-0" />
                    <span>
                        <span className="font-medium text-slate-100">{t('customerMyDemands_cubicMeters')}:</span> {demand.cubicMeters?.toFixed(3) || 'N/A'} m³
                    </span>
                  </div>
                  {demand.notes && (
                    <div className="pt-2 mt-2 border-t border-slate-700/50">
                      <p className="text-xs text-slate-400">{t('notes')}:</p>
                      <p className="text-sm text-slate-300 break-words">{demand.notes.length > 100 ? `${demand.notes.substring(0, 100)}...` : demand.notes}</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 border-t border-slate-700 bg-slate-800/50 space-y-2">
                <AiFeatureButton
                  onClick={() => handleAiDemandAnalysis(demand)}
                  isLoading={isAiLoadingForDemand === demand.id}
                  disabled={!ai || (isAiLoadingForDemand !== null && isAiLoadingForDemand !== demand.id) || (isAiLoadingForStockSuggestion !== null)}
                  className="w-full"
                  leftIcon={<SparklesIcon className="h-4 w-4 text-yellow-400"/>}
                  title={selectedDemandIdForAi === demand.id && aiAnalysisResult ? t('customerMyDemands_ai_hideExplanation') : t('customerMyDemands_ai_requestStatusExplanation')}
                  text={selectedDemandIdForAi === demand.id && aiAnalysisResult ? t('customerMyDemands_ai_hideExplanation') : t('customerMyDemands_ai_requestStatusExplanation')}
                />

                <AiFeatureButton
                  onClick={() => handleSuggestSimilarStock(demand)}
                  isLoading={isAiLoadingForStockSuggestion === demand.id}
                  disabled={!ai || (isAiLoadingForStockSuggestion !== null && isAiLoadingForStockSuggestion !== demand.id) || (isAiLoadingForDemand !== null)}
                  className="w-full"
                  leftIcon={<CubeIcon className="h-4 w-4 text-green-400"/>}
                  title={selectedDemandIdForStockSuggestion === demand.id && suggestedStock ? t('customerMyDemands_ai_suggestStock_hideSuggestions') : t('customerMyDemands_ai_suggestStock_button')}
                  text={selectedDemandIdForStockSuggestion === demand.id && suggestedStock ? t('customerMyDemands_ai_suggestStock_hideSuggestions') : t('customerMyDemands_ai_suggestStock_button')}
                />


                {isAiLoadingForDemand === demand.id && (
                  <div className="mt-3">
                    <LoadingSpinner size="sm" text={t('customerMyDemands_ai_analysisInProgress')} />
                  </div>
                )}

                {selectedDemandIdForAi === demand.id && aiAnalysisResult && !isAiLoadingForDemand && (
                  <div className={`mt-3 p-3 rounded ${aiAnalysisResult.includes(t('error')) || aiAnalysisResult.includes("Hiba") ? 'bg-red-900/50 border border-red-700' : 'bg-slate-700'}`}>
                    <h5 className="text-sm font-semibold text-cyan-300 mb-1">{t('customerMyDemands_ai_explanationTitle')}</h5>
                    <p className={`text-xs whitespace-pre-wrap ${aiAnalysisResult.includes(t('error')) || aiAnalysisResult.includes("Hiba") ? 'text-red-300' : 'text-slate-200'}`}>{aiAnalysisResult}</p>
                  </div>
                )}

                {isAiLoadingForStockSuggestion === demand.id && (
                    <div className="mt-3">
                        <LoadingSpinner size="sm" text={t('customerMyDemands_ai_suggestStock_loading')} />
                    </div>
                )}

                {selectedDemandIdForStockSuggestion === demand.id && suggestedStock && !isAiLoadingForStockSuggestion && (
                    <div className="mt-3 p-3 rounded bg-slate-700">
                        <h5 className="text-sm font-semibold text-cyan-300 mb-2">{t('customerMyDemands_ai_suggestStock_title')}</h5>
                        {typeof suggestedStock === 'string' ? (
                            <p className="text-xs text-red-300">{suggestedStock}</p>
                        ) : suggestedStock.length === 0 ? (
                            <p className="text-xs text-slate-300">{t('customerMyDemands_ai_suggestStock_noMatches')}</p>
                        ) : (
                            <ul className="space-y-3">
                                {suggestedStock.map(suggestion => {
                                    const stockItemDetails = getStockItemById(suggestion.stockItemId);
                                    return (
                                        <li key={suggestion.stockItemId} className="p-2 bg-slate-600/70 rounded-md text-xs">
                                            {stockItemDetails ? (
                                                <>
                                                    <p className="font-semibold text-emerald-300">{stockItemDetails.diameterType}, Ø{stockItemDetails.diameterFrom}-{stockItemDetails.diameterTo}cm, {stockItemDetails.length}m, {stockItemDetails.quantity}pcs</p>
                                                    {stockItemDetails.uploadedByCompanyName && <p className="text-slate-400">{t('adminMatchmaking_byCompany', { companyName: stockItemDetails.uploadedByCompanyName })}</p>}
                                                    {stockItemDetails.price && <p className="text-slate-300">{t('manufacturerMyStock_price')}: {stockItemDetails.price}</p>}
                                                </>
                                            ) : (
                                                <p className="text-slate-400">{t('customerMyDemands_ai_suggestStock_stockItemDetailsNotFound', { id: suggestion.stockItemId })}</p>
                                            )}
                                            <p className="mt-1 text-slate-300"><strong className="text-yellow-400">{t('adminMatchmaking_reason')}:</strong> {suggestion.reason}</p>
                                            {suggestion.matchStrength && <p className="text-slate-300"><strong className="text-yellow-400">{t('adminMatchmaking_matchStrength')}:</strong> {suggestion.matchStrength}</p>}
                                            {suggestion.similarityScore !== undefined && <p className="text-slate-300"><strong className="text-yellow-400">{t('adminMatchmaking_similarityScoreLabel')}:</strong> {(suggestion.similarityScore * 100).toFixed(0)}%</p>}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
};

export default CustomerMyDemandsPage;