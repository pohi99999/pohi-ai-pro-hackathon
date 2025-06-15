

import React, { useState } from 'react';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import AiFeatureButton from '../../components/AiFeatureButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import { MonthlyPlatformSummaryData } from '../../types';
import { MOCK_AI_RESPONSES } from '../../constants';
import { useLocale } from '../../LocaleContext';
import { 
  DocumentChartBarIcon, 
  InformationCircleIcon,
  PlusCircleIcon,
  CheckBadgeIcon,
  AcademicCapIcon,
  ArchiveBoxIcon, // For New Stock Items
  UserGroupIcon // For New Demands (representing customers)
} from '@heroicons/react/24/outline';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

let ai: GoogleGenAI | null = null;
try {
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } else {
    console.warn("API_KEY environment variable is not set for AdminAiReportsPage. Real AI features will be limited to mock data.");
  }
} catch (error) {
  console.error("Error initializing GoogleGenAI for AdminAiReportsPage:", error);
}

const parseJsonFromGeminiResponse = <T,>(text: string, featureName: string): T | string => {
  let jsonStr = text.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error(`Failed to parse JSON response for ${featureName}:`, e, "Raw text:", text);
    return `Hiba történt az AI válaszának feldolgozásakor (${featureName}). A válasz nem érvényes JSON formátumú. Nyers válasz (részlet): ${text.substring(0,200)}...`;
  }
};

const AdminAiReportsPage: React.FC = () => {
  const { t, locale } = useLocale();
  const [platformSummary, setPlatformSummary] = useState<MonthlyPlatformSummaryData | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGenerateSummary = async () => {
    setIsLoadingSummary(true);
    setPlatformSummary(null);
    setErrorMessage(null);

    if (!ai) {
      const unavailableMsg = t('adminAiReports_mockFallback_aiServiceUnavailable', { mockInterpretation: MOCK_AI_RESPONSES.monthlyPlatformSummary.aiInterpretation });
      setErrorMessage(unavailableMsg);
      setPlatformSummary({ 
        ...MOCK_AI_RESPONSES.monthlyPlatformSummary,
        month: MOCK_AI_RESPONSES.monthlyPlatformSummary.month, 
        aiInterpretation: unavailableMsg 
      });
      setIsLoadingSummary(false);
      return;
    }

    const currentMonthYear = new Date().toLocaleString(locale, { month: 'long', year: 'numeric' });
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const prompt = `Generate a concise monthly platform summary for a timber trading platform for the month of '${currentMonthYear}' in ${promptLang}. The summary should be in JSON format and include the following fields: 'month' (string, use the provided month), 'newDemands' (number), 'newStockItems' (number), 'successfulMatches' (number), and 'aiInterpretation' (string, a brief 2-3 sentence analysis of these numbers and potential suggestions). Provide realistic but fictional numbers for demands, stock, and matches. The response must only contain the JSON object, without any extra text or markdown.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const parsedResult = parseJsonFromGeminiResponse<MonthlyPlatformSummaryData>(response.text, t('adminAiReports_monthlyPlatformSummary'));

      if (typeof parsedResult === 'string') {
        setErrorMessage(parsedResult); 
        setPlatformSummary({
            ...MOCK_AI_RESPONSES.monthlyPlatformSummary,
            month: MOCK_AI_RESPONSES.monthlyPlatformSummary.month, 
            aiInterpretation: t('adminAiReports_mockFallback_errorProcessingResponse', { errorMessage: parsedResult, mockInterpretation: MOCK_AI_RESPONSES.monthlyPlatformSummary.aiInterpretation })
        });
      } else {
        setPlatformSummary(parsedResult);
        setErrorMessage(null); 
      }
    } catch (error) {
      console.error("Error generating monthly platform summary with Gemini:", error);
      const apiErrorMsg = t('adminAiReports_error_summaryGeneric');
      setErrorMessage(apiErrorMsg);
      setPlatformSummary({ 
        ...MOCK_AI_RESPONSES.monthlyPlatformSummary,
        month: MOCK_AI_RESPONSES.monthlyPlatformSummary.month, 
        aiInterpretation: t('adminAiReports_mockFallback_errorProcessingResponse', { errorMessage: apiErrorMsg, mockInterpretation: MOCK_AI_RESPONSES.monthlyPlatformSummary.aiInterpretation })
      });
    } finally {
      setIsLoadingSummary(false);
    }
  };

  return (
    <>
      <PageTitle 
        title={t('adminAiReports_title')}
        subtitle={t('adminAiReports_subtitle')}
        icon={<DocumentChartBarIcon className="h-8 w-8" />}
      />
      <div className="space-y-6">
        <Card title={t('adminAiReports_monthlyPlatformSummary')}>
          <div className="space-y-4 p-4">
            <AiFeatureButton
              text={t('adminAiReports_generateMonthlySummary')}
              onClick={handleGenerateSummary}
              isLoading={isLoadingSummary}
              disabled={!ai && isLoadingSummary} // Disable if AI not available and already loading mock
            />
            {isLoadingSummary && <LoadingSpinner text={t('adminAiReports_generatingSummary')} />}
            
            {errorMessage && !isLoadingSummary && !platformSummary?.aiInterpretation.includes(MOCK_AI_RESPONSES.monthlyPlatformSummary.aiInterpretation) && ( 
                <Card title={t('adminAiReports_errorTitle')} className="mt-4 border border-red-700" titleClassName="text-red-400">
                    <p className="text-red-300">{errorMessage}</p>
                </Card>
            )}

            {platformSummary && !isLoadingSummary && (
              <Card 
                title={t('adminAiReports_aiSummaryTitle', { month: platformSummary.month })}
                bodyClassName="space-y-4 !pt-4 !pb-4" 
                className={`mt-4 border ${errorMessage && platformSummary.aiInterpretation !== MOCK_AI_RESPONSES.monthlyPlatformSummary.aiInterpretation ? 'border-red-600' : 'border-slate-700'}`}
                titleClassName={errorMessage && platformSummary.aiInterpretation !== MOCK_AI_RESPONSES.monthlyPlatformSummary.aiInterpretation ? 'text-red-400' : 'text-cyan-400'}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Stat Card for New Demands */}
                  <div className="p-4 bg-slate-700 rounded-lg shadow-lg flex flex-col items-center justify-center text-center hover:bg-slate-600/70 transition-colors">
                    <UserGroupIcon className="h-10 w-10 text-sky-400 mb-2" />
                    <span className="text-sm font-medium text-slate-300">{t('adminAiReports_newDemands')}</span>
                    <p className="text-3xl font-semibold text-white mt-1">{platformSummary.newDemands}</p>
                  </div>
                  
                  {/* Stat Card for New Stock Items */}
                  <div className="p-4 bg-slate-700 rounded-lg shadow-lg flex flex-col items-center justify-center text-center hover:bg-slate-600/70 transition-colors">
                    <ArchiveBoxIcon className="h-10 w-10 text-emerald-400 mb-2" />
                    <span className="text-sm font-medium text-slate-300">{t('adminAiReports_newStockItems')}</span>
                    <p className="text-3xl font-semibold text-white mt-1">{platformSummary.newStockItems}</p>
                  </div>
                  
                  {/* Stat Card for Successful Matches */}
                  <div className="p-4 bg-slate-700 rounded-lg shadow-lg flex flex-col items-center justify-center text-center hover:bg-slate-600/70 transition-colors">
                    <CheckBadgeIcon className="h-10 w-10 text-purple-400 mb-2" />
                    <span className="text-sm font-medium text-slate-300">{t('adminAiReports_successfulMatches')}</span>
                    <p className="text-3xl font-semibold text-white mt-1">{platformSummary.successfulMatches}</p>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                  <div className="flex items-center text-yellow-400 mb-2">
                    <AcademicCapIcon className="h-6 w-6 mr-2 flex-shrink-0" />
                    <h4 className="text-md font-semibold">{t('adminAiReports_aiInterpretation')}</h4>
                  </div>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{platformSummary.aiInterpretation}</p>
                </div>
              </Card>
            )}
          </div>
        </Card>

        <Card>
            <div className="text-center py-8 px-4">
              <InformationCircleIcon className="h-12 w-12 text-cyan-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-1">{t('adminAiReports_moreReportsComingSoon')}</h3>
              <p className="text-slate-400 text-sm">
                {t('adminAiReports_moreReportsDescription')}
              </p>
            </div>
        </Card>
      </div>
    </>
  );
};

export default AdminAiReportsPage;