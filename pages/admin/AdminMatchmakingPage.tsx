
import React, { useState, useEffect } from 'react';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import AiFeatureButton from '../../components/AiFeatureButton';
import Textarea from '../../components/Textarea';
import LoadingSpinner from '../../components/LoadingSpinner';
import SimpleBarChart from '../../components/SimpleBarChart';
import { 
    MatchmakingSuggestion, 
    DisputeResolutionSuggestion, 
    DemandItem, 
    StockItem, 
    DemandStatus,
    StockStatus,
    MockCompany, 
    UserRole 
} from '../../types';
import { 
    ArrowsRightLeftIcon, 
    ScaleIcon, 
    DocumentTextIcon, 
    InformationCircleIcon, 
    HashtagIcon, 
    CalendarDaysIcon, 
    ArchiveBoxIcon, 
    BeakerIcon, 
    BuildingStorefrontIcon, 
    SparklesIcon,
    BanknotesIcon,
    ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { useLocale } from '../../LocaleContext';
import { getTranslatedDemandStatus, getTranslatedStockStatus } from '../../locales';
import { CUSTOMER_DEMANDS_STORAGE_KEY, MANUFACTURER_STOCK_STORAGE_KEY, MOCK_COMPANIES_STORAGE_KEY } from '../../constants';


let ai: GoogleGenAI | null = null;
try {
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } else {
    console.warn("API_KEY environment variable is not set for AdminMatchmakingPage. Real AI features will be limited.");
  }
} catch (error) {
  console.error("Error initializing GoogleGenAI for AdminMatchmakingPage:", error);
}

interface AdminMatchmakingState {
  matchmakingSuggestions?: MatchmakingSuggestion[] | string;
  disputeDetails?: string;
  disputeResolutionSuggestions?: DisputeResolutionSuggestion[];
  
  allDemands?: DemandItem[];
  isLoadingDemandsList?: boolean;
  allStockItems?: StockItem[];
  isLoadingStockList?: boolean;
  mockCompanies?: MockCompany[];
  isLoadingCompanies?: boolean;

  currentAiFeatureKey?: string;
}

const getDemandStatusBadgeColor = (status: DemandStatus): string => {
  switch (status) {
    case DemandStatus.RECEIVED: return 'bg-sky-500 text-sky-50';
    case DemandStatus.PROCESSING: return 'bg-amber-500 text-amber-50';
    case DemandStatus.COMPLETED: return 'bg-green-500 text-green-50';
    case DemandStatus.CANCELLED: return 'bg-red-500 text-red-50';
    default: return 'bg-slate-500 text-slate-50';
  }
};

const getStockStatusBadgeColor = (status?: StockStatus): string => {
    if (!status) return 'bg-slate-500 text-slate-50';
    switch (status) {
      case StockStatus.AVAILABLE: return 'bg-green-600 text-green-50';
      case StockStatus.RESERVED: return 'bg-yellow-500 text-yellow-50';
      case StockStatus.SOLD: return 'bg-red-600 text-red-50';
      default: return 'bg-slate-500 text-slate-50';
    }
  };


const AdminMatchmakingPage: React.FC = () => {
  const { t, locale } = useLocale();
  const [isLoadingAi, setIsLoadingAi] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<AdminMatchmakingState>({ 
    isLoadingDemandsList: true, 
    allDemands: [],
    isLoadingStockList: true,
    allStockItems: [],
    isLoadingCompanies: true,
    mockCompanies: []
  });

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
      return t('customerNewDemand_error_failedToParseJson', { featureName: t(featureNameKey as any), rawResponse: text.substring(0,150) });
    }
  };

  const generateAutomaticPairingSuggestionsWithGemini = async (): Promise<MatchmakingSuggestion[] | string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');

    const demandsRaw = localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY);
    const stockRaw = localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY);

    const demands: DemandItem[] = demandsRaw ? JSON.parse(demandsRaw) : [];
    const stockItems: StockItem[] = stockRaw ? JSON.parse(stockRaw) : [];

    const productTermKey = 'productType_acaciaDebarkedSandedPost';
    const productTerm = t(productTermKey).toLowerCase(); 
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';

    const acaciaDemands = demands.filter(d => 
      d.status === DemandStatus.RECEIVED && 
      (d.notes?.toLowerCase().includes(productTerm) || d.diameterType.toLowerCase().includes(productTerm) || d.notes?.toLowerCase().includes("akác oszlop") || d.notes?.toLowerCase().includes("acacia post"))
    );
    const acaciaStock = stockItems.filter(s => 
      s.status === StockStatus.AVAILABLE && 
      (s.notes?.toLowerCase().includes(productTerm) || s.diameterType.toLowerCase().includes(productTerm) || s.notes?.toLowerCase().includes("akác oszlop") || s.notes?.toLowerCase().includes("acacia post"))
    );

    if (acaciaDemands.length === 0 || acaciaStock.length === 0) {
      return t('adminMatchmaking_noPairingSuggestions');
    }
    
    const relevantDemandData = acaciaDemands.map(d => ({id: d.id, diameterFrom: d.diameterFrom, diameterTo: d.diameterTo, length: d.length, quantity: d.quantity, notes: d.notes?.substring(0,100), submittedByCompanyName: d.submittedByCompanyName}));
    const relevantStockData = acaciaStock.map(s => ({id: s.id, diameterFrom: s.diameterFrom, diameterTo: s.diameterTo, length: s.length, quantity: s.quantity, price: s.price, notes: s.notes?.substring(0,100), uploadedByCompanyName: s.uploadedByCompanyName}));


    const prompt = `You are an AI assistant for a timber trading platform specializing in "${productTerm}" products.
Based on the following Customer Demands and Manufacturer Stock, identify potential pairings for "${productTerm}" products.
Provide your response as a JSON array in ${promptLang}. Each object should represent a pairing and include the following fields:
- "demandId": string (ID of the demand)
- "stockId": string (ID of the stock item)
- "reason": string (short justification in ${promptLang} for why the pairing is good. Consider matching dimensions and quantities. IF A DEMAND IS SMALLER THAN THE STOCK, OR A STOCK ITEM COULD SATISFY MULTIPLE SMALL DEMANDS, EXPLICITLY MENTION THE POSSIBILITY OF CONSOLIDATION IN THE REASONING. For example: "This 10-piece demand can be well combined with other small items into a larger shipment from the manufacturer's larger stock." or "The manufacturer's 200-piece stock could satisfy multiple smaller demands of similar size, making consolidated shipping optimal.")
- "matchStrength": string (e.g., "High", "Medium", "Low", or a numeric value like "85%")
- "similarityScore": number (optional, numeric similarity score between 0.0 and 1.0)

The response MUST ONLY contain the JSON array.

Customer Demands (Demands):
${JSON.stringify(relevantDemandData, null, 2)}

Manufacturer Stock (Stock Items):
${JSON.stringify(relevantStockData, null, 2)}
`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const parsedResult = parseJsonFromGeminiResponse<Omit<MatchmakingSuggestion, 'id'>[]>(response.text, "adminMatchmaking_requestAiMatchmakingSuggestions");

      if (typeof parsedResult === 'string') return parsedResult;

      if (Array.isArray(parsedResult)) {
        return parsedResult.map(item => ({ ...item, id: `gemini-match-${item.demandId}-${item.stockId}-${Date.now()}` }));
      }
      return t('adminMatchmaking_error_failedToParsePairing', {rawResponse: response.text.substring(0,100)});
    } catch (error) {
      console.error("Error generating AI matchmaking suggestions:", error);
      return t('adminMatchmaking_error_pairingGeneric');
    }
  };

  const generateDisputeResolutionSuggestionsWithGemini = async (disputeDetails: string): Promise<DisputeResolutionSuggestion[]> => {
    if (!ai) {
      return [{ id: 'error-no-ai', suggestion: t('customerNewDemand_error_aiUnavailable') }];
    }
    if (!disputeDetails || disputeDetails.trim().length < 10) {
        return [{ id: 'error-no-details', suggestion: t('adminMatchmaking_error_noDisputeDetails') }];
    }
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const prompt = `An admin of an online timber marketplace requests dispute resolution suggestions. For the following dispute, provide several (at least 2-3) specific, practical resolution suggestions in ${promptLang} to help the parties reach an agreement.
Provide your response as a list, with each suggestion starting on a new line and preceded by '- ' (hyphen and space). Do not include any introduction, summary, or other explanation outside the list. I only want the list of suggestions.

Dispute Details:
${disputeDetails}

Example of desired response format (only return lines starting with hyphen):
- Suggestion 1: Initiate direct negotiation between parties with a mediator.
- Suggestion 2: Obtain an independent expert opinion on the disputed issue (e.g., quality, quantity).
- Suggestion 3: Offer partial compensation or a discount for quicker resolution.`;

    try {
      // setIsLoadingAi(prev => ({ ...prev, disputeResolutionSuggestions: true })); // Not needed, handled by handleAiFeatureClick
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      
      const rawText = response.text;
      const suggestionsText = rawText.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- '))
        .map(line => line.substring(2).trim());

      if (suggestionsText.length > 0) {
        return suggestionsText.map((sg, index) => ({ id: `gemini-dr-${index}`, suggestion: sg }));
      }
      
      const fallbackMessage = t('adminMatchmaking_error_failedToParseDisputeSuggestions', {
        rawResponse: (rawText && rawText.length > 0 && !rawText.toLowerCase().includes("nem tudok segíteni") && !rawText.toLowerCase().includes("i cannot assist")) 
            ? (rawText.length > 150 ? rawText.substring(0,150) + "..." : rawText) 
            : t('adminMatchmaking_noRelevantSuggestion') 
      });
      return [{ id: 'parse-fail', suggestion: fallbackMessage }];

    } catch (error) {
      console.error("Error generating dispute resolution suggestions with Gemini:", error);
      return [{ id: 'api-error', suggestion: t('adminMatchmaking_error_disputeResolutionGeneric') }];
    } /*finally { // Not needed, handled by handleAiFeatureClick
      setIsLoadingAi(prev => ({ ...prev, disputeResolutionSuggestions: false }));
    }*/
  };


  const handleAiFeatureClick = (
    featureKey: Extract<keyof AdminMatchmakingState, 'matchmakingSuggestions' | 'disputeResolutionSuggestions'>,
    aiOperationKey: string
  ) => {
    setIsLoadingAi(prev => ({ ...prev, [aiOperationKey]: true }));
     setState(prev => ({ 
        ...prev, 
        matchmakingSuggestions: featureKey === 'matchmakingSuggestions' ? undefined : prev.matchmakingSuggestions,
        disputeResolutionSuggestions: featureKey === 'disputeResolutionSuggestions' ? undefined : prev.disputeResolutionSuggestions,
        currentAiFeatureKey: aiOperationKey 
    }));


    const execute = async () => {
        let result;
        try {
            if(featureKey === 'matchmakingSuggestions') {
                result = await generateAutomaticPairingSuggestionsWithGemini();
            } else if (featureKey === 'disputeResolutionSuggestions') {
                result = await generateDisputeResolutionSuggestionsWithGemini(state.disputeDetails || '');
            }
            setState(prev => ({ ...prev, [featureKey]: result }));
        } catch (error) { 
            console.error(`Error in AI feature ${featureKey}:`, error);
            const errorMessage = t('adminMatchmaking_error_criticalProcessingError');
            if (featureKey === 'disputeResolutionSuggestions') {
                setState(prev => ({ ...prev, disputeResolutionSuggestions: [{id: 'error-catch', suggestion: errorMessage}] }));
            } else if (featureKey === 'matchmakingSuggestions') {
                 setState(prev => ({ ...prev, matchmakingSuggestions: errorMessage })); // Set error string
            }
        } finally {
             setIsLoadingAi(prev => ({ ...prev, [aiOperationKey]: false}));
        }
    };
    execute();
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setState(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    setState(prev => ({ ...prev, isLoadingDemandsList: true, isLoadingStockList: true, isLoadingCompanies: true }));
    try {
      const storedDemandsRaw = localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY);
      const storedStockRaw = localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY);
      const storedCompaniesRaw = localStorage.getItem(MOCK_COMPANIES_STORAGE_KEY);

      if (storedDemandsRaw) {
        const parsedDemands: DemandItem[] = JSON.parse(storedDemandsRaw);
        parsedDemands.sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
        setState(prev => ({ ...prev, allDemands: parsedDemands }));
      } else {
        setState(prev => ({ ...prev, allDemands: [] }));
      }
      if (storedStockRaw) {
        const parsedStock: StockItem[] = JSON.parse(storedStockRaw);
        parsedStock.sort((a, b) => (a.uploadDate && b.uploadDate) ? new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime() : 0);
        setState(prev => ({ ...prev, allStockItems: parsedStock }));
      } else {
        setState(prev => ({ ...prev, allStockItems: [] }));
      }
      if (storedCompaniesRaw) {
        setState(prev => ({ ...prev, mockCompanies: JSON.parse(storedCompaniesRaw) }));
      } else {
        setState(prev => ({ ...prev, mockCompanies: [] }));
      }
    } catch (error) {
      console.error("Error loading data for admin matchmaking:", error);
      setState(prev => ({ ...prev, allDemands: [], allStockItems: [], mockCompanies: [] }));
    }
    setState(prev => ({ ...prev, isLoadingDemandsList: false, isLoadingStockList: false, isLoadingCompanies: false }));
  }, []);

  const getDemandStatusChartData = () => {
    if (!state.allDemands) return [];
    const counts: Record<DemandStatus, number> = {
      [DemandStatus.RECEIVED]: 0,
      [DemandStatus.PROCESSING]: 0,
      [DemandStatus.COMPLETED]: 0,
      [DemandStatus.CANCELLED]: 0,
    };
    state.allDemands.forEach(item => {
      if (counts[item.status] !== undefined) {
        counts[item.status]++;
      }
    });
    return [
      { label: t('demandStatus_RECEIVED'), value: counts[DemandStatus.RECEIVED], color: 'text-sky-500' },
      { label: t('demandStatus_PROCESSING'), value: counts[DemandStatus.PROCESSING], color: 'text-amber-500' },
      { label: t('demandStatus_COMPLETED'), value: counts[DemandStatus.COMPLETED], color: 'text-green-500' },
      { label: t('demandStatus_CANCELLED'), value: counts[DemandStatus.CANCELLED], color: 'text-red-500' },
    ];
  };

  const isAnyAiLoading = Object.values(isLoadingAi).some(s => s);

  const getDemandById = (id: string): DemandItem | undefined => state.allDemands?.find(d => d.id === id || d.id.includes(id) || id.includes(d.id));
  const getStockById = (id: string): StockItem | undefined => state.allStockItems?.find(s => s.id === id || (s.id && s.id.includes(id)) || (s.id && id.includes(s.id)));


  return (
    <>
      <PageTitle title={t('adminMatchmaking_title')} subtitle={t('adminMatchmaking_subtitle')} icon={<ArrowsRightLeftIcon className="h-8 w-8"/>}/>
      
      <div className="mb-8">
        <SimpleBarChart data={getDemandStatusChartData()} title={t('adminMatchmaking_chart_demandStatusTitle')} />
      </div>

      <h2 className="text-xl font-semibold text-white mt-2 mb-4 border-b border-slate-700 pb-2">{t('adminStock_aiToolsTitle')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card title={t('adminMatchmaking_requestAiMatchmakingSuggestions', {productName: t('productType_acaciaDebarkedSandedPost')})}>
          <p className="text-sm text-slate-300 mb-3">{t('adminMatchmaking_aiMatchmakingDescription', {productName: t('productType_acaciaDebarkedSandedPost')})}</p>
          <AiFeatureButton
            text={t('adminMatchmaking_requestAiMatchmakingSuggestions', {productName: t('productType_acaciaDebarkedSandedPost')})}
            onClick={() => handleAiFeatureClick('matchmakingSuggestions', 'aiPairingOp')}
            isLoading={isLoadingAi.aiPairingOp}
            disabled={!ai || isAnyAiLoading}
            leftIcon={<SparklesIcon className="h-5 w-5 text-yellow-400" />}
          />
          {isLoadingAi.aiPairingOp && state.currentAiFeatureKey === 'aiPairingOp' && <LoadingSpinner text={t('adminStock_generatingSuggestions')} />}
          {state.matchmakingSuggestions && !isLoadingAi.aiPairingOp && state.currentAiFeatureKey === 'aiPairingOp' && (
             <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-2">
              {typeof state.matchmakingSuggestions === 'string' ? (
                <p className="text-sm text-red-300 p-3 bg-red-900/30 rounded">{state.matchmakingSuggestions}</p>
              ) : state.matchmakingSuggestions.length === 0 ? (
                <p className="text-sm text-slate-400 p-3 bg-slate-700/50 rounded">{t('adminMatchmaking_noPairingSuggestions')}</p>
              ) : (
                state.matchmakingSuggestions.map(suggestion => {
                  const demand = getDemandById(suggestion.demandId);
                  const stock = getStockById(suggestion.stockId);
                  return (
                    <Card key={suggestion.id} title={t('adminMatchmaking_suggestedPairing')} className="bg-slate-700/50 !shadow-md">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            {/* Demand Details */}
                            <div className="p-2 bg-slate-600/40 rounded">
                                <h6 className="font-semibold text-cyan-300 mb-1">{t('adminMatchmaking_pairedDemand')}: {demand?.id.substring(0,10)}...</h6>
                                {demand ? (
                                    <>
                                        {demand.submittedByCompanyName && <p className="text-slate-300"><BuildingStorefrontIcon className="h-4 w-4 inline mr-1 text-slate-400"/>{demand.submittedByCompanyName}</p>}
                                        <p className="text-slate-300">{demand.diameterType}, Ø{demand.diameterFrom}-{demand.diameterTo}cm, {demand.length}m, {demand.quantity}pcs</p>
                                        {demand.notes && <p className="text-slate-400 italic truncate" title={demand.notes}>"{demand.notes}"</p>}
                                    </>
                                ) : <p className="text-slate-400">{t('adminMatchmaking_demand')} {suggestion.demandId} {t('error')}</p>}
                            </div>
                            {/* Stock Details */}
                            <div className="p-2 bg-slate-600/40 rounded">
                                <h6 className="font-semibold text-emerald-300 mb-1">{t('adminMatchmaking_pairedStock')}: {stock?.id?.substring(0,10)}...</h6>
                                {stock ? (
                                    <>
                                        {stock.uploadedByCompanyName && <p className="text-slate-300"><BuildingStorefrontIcon className="h-4 w-4 inline mr-1 text-slate-400"/>{stock.uploadedByCompanyName}</p>}
                                        <p className="text-slate-300">{stock.diameterType}, Ø{stock.diameterFrom}-{stock.diameterTo}cm, {stock.length}m, {stock.quantity}pcs</p>
                                        {stock.price && <p className="text-slate-300"><BanknotesIcon className="h-4 w-4 inline mr-1 text-green-400"/>{stock.price}</p>}
                                        {stock.notes && <p className="text-slate-400 italic truncate" title={stock.notes}>"{stock.notes}"</p>}
                                    </>
                                ) : <p className="text-slate-400">{t('adminMatchmaking_stock')} {suggestion.stockId} {t('error')}</p>}
                            </div>
                        </div>
                        <div className="mt-2 p-2 bg-slate-600/30 rounded">
                            <p className="text-xs text-slate-300 whitespace-pre-wrap"><strong className="text-yellow-300">{t('adminMatchmaking_reason')}</strong> {suggestion.reason}</p>
                            {suggestion.matchStrength && <p className="text-xs text-yellow-300 mt-0.5"><strong className="text-yellow-300">{t('adminMatchmaking_matchStrength')}</strong> {suggestion.matchStrength}</p>}
                            {suggestion.similarityScore && <p className="text-xs text-yellow-300 mt-0.5"><strong className="text-yellow-300">{t('adminMatchmaking_similarityScoreLabel') || 'Similarity Score:'}</strong> {(suggestion.similarityScore * 100).toFixed(0)}%</p>}
                        </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </Card>

        <Card title={t('adminMatchmaking_aiDisputeResolutionAdvisor')}>
          <Textarea
            label={t('adminMatchmaking_disputeDetailsLabel')}
            name="disputeDetails"
            value={state.disputeDetails || ''}
            onChange={handleInputChange}
            rows={5}
            placeholder={t('adminMatchmaking_disputeDetailsPlaceholder')}
          />
          <AiFeatureButton
            text={t('adminMatchmaking_requestResolutionSuggestions')}
            onClick={() => handleAiFeatureClick('disputeResolutionSuggestions', 'disputeResOp')}
            isLoading={isLoadingAi.disputeResOp}
            disabled={Boolean(!ai || !state.disputeDetails || (state.disputeDetails?.trim().length || 0) < 10 || isAnyAiLoading)}
            aria-label={t('adminMatchmaking_requestResolutionSuggestions')}
          />
          {isLoadingAi.disputeResOp && state.currentAiFeatureKey === 'disputeResOp' && <LoadingSpinner text={t('adminMatchmaking_searchingSuggestions')} />}
          {state.disputeResolutionSuggestions && !isLoadingAi.disputeResOp && state.currentAiFeatureKey === 'disputeResOp' && (
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-2">
              <h5 className="font-semibold text-cyan-400 mb-1">{t('adminMatchmaking_suggestedResolutionSteps')}</h5>
              {state.disputeResolutionSuggestions.map(suggestion => (
                <div key={suggestion.id} className={`p-2 bg-slate-700/50 rounded text-sm ${suggestion.id.startsWith('error-') || suggestion.id === 'api-error' || suggestion.id === 'parse-fail' || suggestion.id === 'error-catch' || suggestion.suggestion.toLowerCase().includes('error') || suggestion.suggestion.toLowerCase().includes('hiba') ? 'text-red-300' : 'text-slate-200'}`}>
                  <ScaleIcon className={`h-4 w-4 inline mr-2 ${suggestion.id.startsWith('error-') || suggestion.id === 'api-error' || suggestion.id === 'parse-fail' || suggestion.id === 'error-catch' || suggestion.suggestion.toLowerCase().includes('error') || suggestion.suggestion.toLowerCase().includes('hiba') ? 'text-red-400' : 'text-yellow-400'}`}/>
                  {suggestion.suggestion}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Demands by Company */}
      <Card title={t('adminMatchmaking_demandsByCompanyTitle')} className="mb-6">
        {state.isLoadingCompanies || state.isLoadingDemandsList ? (
          <LoadingSpinner text={t('adminMatchmaking_loadingCompanyData')} />
        ) : !state.mockCompanies || state.mockCompanies.filter(c => c.role === UserRole.CUSTOMER).length === 0 ? ( 
          <p className="text-slate-400 p-4">{t('adminMatchmaking_noCompaniesFound')}</p>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto p-1">
            {state.mockCompanies.filter(c => c.role === UserRole.CUSTOMER).map(company => { 
              const companyDemands = state.allDemands?.filter(d => d.submittedByCompanyId === company.id) || [];
              const totalCubicMeters = companyDemands.reduce((sum, d) => sum + (d.cubicMeters || 0), 0);
              return (
                <Card key={company.id} title={`${company.companyName} (${t('adminMatchmaking_totalVolume', {volume: totalCubicMeters.toFixed(2)})})`} className="bg-slate-700/60 !shadow-sm">
                  {company.address && (company.address.street || company.address.city || company.address.country) && (
                    <p className="text-xs text-slate-400 px-3 pb-1 -mt-2">
                        {company.address.street && `${company.address.street}, `}
                        {company.address.zipCode && `${company.address.zipCode} `}
                        {company.address.city && `${company.address.city}, `}
                        {company.address.country}
                    </p>
                  )}
                  {companyDemands.length === 0 ? (
                    <p className="text-sm text-slate-400 p-3">{t('adminMatchmaking_noDemandsForCompany')}</p>
                  ) : (
                    <ul className="space-y-2 p-2">
                      {companyDemands.map(demand => (
                        <li key={demand.id} className="p-2 bg-slate-600/50 rounded text-xs">
                           <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-cyan-300">ID: {demand.id.substring(0,10)}...</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${getDemandStatusBadgeColor(demand.status)}`}>{getTranslatedDemandStatus(demand.status,t)}</span>
                           </div>
                           <p className="text-slate-300">{demand.diameterType}, Ø{demand.diameterFrom}-{demand.diameterTo}cm, {demand.length}m, {demand.quantity}pcs</p>
                           <p className="text-slate-300">{t('customerMyDemands_cubicMeters')}: {demand.cubicMeters?.toFixed(3) || 'N/A'} m³</p>
                           {demand.notes && <p className="text-slate-400 italic truncate" title={demand.notes}>"{demand.notes}"</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      {/* Stock by Company */}
      <Card title={t('adminMatchmaking_stockByCompanyTitle')}>
        {state.isLoadingCompanies || state.isLoadingStockList ? (
          <LoadingSpinner text={t('adminMatchmaking_loadingCompanyData')} />
        ) : !state.mockCompanies || state.mockCompanies.filter(c => c.role === UserRole.MANUFACTURER).length === 0 ? (
          <p className="text-slate-400 p-4">{t('adminMatchmaking_noCompaniesFound')}</p>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto p-1">
            {state.mockCompanies.filter(c => c.role === UserRole.MANUFACTURER).map(company => {
              const companyStock = state.allStockItems?.filter(s => s.uploadedByCompanyId === company.id) || [];
              const totalCubicMeters = companyStock.reduce((sum, s) => sum + (s.cubicMeters || 0), 0);
              return (
                <Card key={company.id} title={`${company.companyName} (${t('adminMatchmaking_totalVolume', {volume: totalCubicMeters.toFixed(2)})})`} className="bg-slate-700/60 !shadow-sm">
                  {company.address && (company.address.street || company.address.city || company.address.country) && (
                    <p className="text-xs text-slate-400 px-3 pb-1 -mt-2">
                        {company.address.street && `${company.address.street}, `}
                        {company.address.zipCode && `${company.address.zipCode} `}
                        {company.address.city && `${company.address.city}, `}
                        {company.address.country}
                    </p>
                  )}
                  {companyStock.length === 0 ? (
                    <p className="text-sm text-slate-400 p-3">{t('adminMatchmaking_noStockForCompany')}</p>
                  ) : (
                    <ul className="space-y-2 p-2">
                      {companyStock.map(stock => (
                        <li key={stock.id} className="p-2 bg-slate-600/50 rounded text-xs">
                           <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-emerald-300">ID: {stock.id?.substring(0,10)}...</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${getStockStatusBadgeColor(stock.status)}`}>{getTranslatedStockStatus(stock.status,t)}</span>
                           </div>
                           <p className="text-slate-300">{stock.diameterType}, Ø{stock.diameterFrom}-{stock.diameterTo}cm, {stock.length}m, {stock.quantity}pcs</p>
                           <p className="text-slate-300">{t('customerMyDemands_cubicMeters')}: {stock.cubicMeters?.toFixed(3) || 'N/A'} m³</p>
                           {stock.price && <p className="text-slate-300"><BanknotesIcon className="h-4 w-4 inline mr-1 text-green-400"/>{stock.price}</p>}
                           {stock.notes && <p className="text-slate-400 italic truncate" title={stock.notes}>"{stock.notes}"</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
};

export default AdminMatchmakingPage;
