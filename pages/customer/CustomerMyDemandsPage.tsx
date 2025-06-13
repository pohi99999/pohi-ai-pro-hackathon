
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { DemandItem, DemandStatus } from '../../types';
import { DocumentTextIcon, InformationCircleIcon, TagIcon, CalendarDaysIcon, HashtagIcon, ArchiveBoxIcon, BeakerIcon, SparklesIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { useLocale } from '../../LocaleContext';
import { getTranslatedDemandStatus } from '../../locales';
import { CUSTOMER_DEMANDS_STORAGE_KEY } from '../../constants';


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
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDemandIdForAi, setSelectedDemandIdForAi] = useState<string | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [isAiLoadingForDemand, setIsAiLoadingForDemand] = useState<string | null>(null);


  useEffect(() => {
    setIsLoading(true);
    try {
      const storedDemandsRaw = localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY);
      if (storedDemandsRaw) {
        const parsedDemands: DemandItem[] = JSON.parse(storedDemandsRaw);
        // For Customer's "My Demands", only show items they submitted themselves (not by admin for another company)
        // This simple check assumes direct submission if `submittedByCompanyId` is missing.
        const ownDemands = parsedDemands.filter(item => !item.submittedByCompanyId);

        ownDemands.sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
        setDemands(ownDemands);
      }
    } catch (error) {
      console.error("Error loading demands:", error);
    }
    setIsLoading(false);
  }, []);

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

    const result = await generateDemandStatusExplanationWithGemini(demand);
    
    setAiAnalysisResult(result);
    setIsAiLoadingForDemand(null);
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
              
              <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                <Button
                  onClick={() => handleAiDemandAnalysis(demand)}
                  isLoading={isAiLoadingForDemand === demand.id}
                  disabled={!ai || (isAiLoadingForDemand !== null && isAiLoadingForDemand !== demand.id)}
                  variant="ghost"
                  size="sm"
                  className="w-full text-cyan-400 border border-cyan-600 hover:bg-cyan-500/20"
                  leftIcon={<SparklesIcon className="h-4 w-4 text-yellow-400"/>}
                  title={selectedDemandIdForAi === demand.id && aiAnalysisResult ? t('customerMyDemands_ai_hideExplanation') : t('customerMyDemands_ai_requestStatusExplanation')}
                >
                  {selectedDemandIdForAi === demand.id && aiAnalysisResult ? t('customerMyDemands_ai_hideExplanation') : t('customerMyDemands_ai_requestStatusExplanation')}
                </Button>

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
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
};

export default CustomerMyDemandsPage;
