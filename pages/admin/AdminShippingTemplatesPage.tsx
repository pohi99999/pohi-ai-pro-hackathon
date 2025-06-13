
import React, { useState } from 'react';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import AiFeatureButton from '../../components/AiFeatureButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import { EnvelopeIcon, DocumentCheckIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { useLocale } from '../../LocaleContext';

let ai: GoogleGenAI | null = null;
try {
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } else {
    console.warn("API_KEY environment variable is not set for AdminShippingTemplatesPage. Real AI features will be limited.");
  }
} catch (error) {
  console.error("Error initializing GoogleGenAI for AdminShippingTemplatesPage:", error);
}

interface AdminShippingTemplatesState {
  emailDraft?: string;
  waybillCheckSuggestions?: string[] | string; 
  currentAiFeatureKey?: string; 
}

const AdminShippingTemplatesPage: React.FC = () => {
  const { t, locale } = useLocale();
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<AdminShippingTemplatesState>({});

  const generateEmailDraftWithGemini = async (): Promise<string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const prompt = `Create a professional, polite, and informative email draft in ${promptLang} for a shipping notification. The email should include the following placeholders for the user to fill in later: [Partner Name], [Order Number], [Date], [Time]. The purpose of the email is to inform the partner about shipping details and request confirmation of receipt. The response should only contain the full email text, without any extra introduction or explanation.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      return response.text || t('adminShippingTemplates_error_emailGeneric');
    } catch (error) {
      console.error("Error generating email draft with Gemini:", error);
      return t('adminShippingTemplates_error_emailGeneric');
    }
  };

  const generateWaybillCheckSuggestionsWithGemini = async (): Promise<string[] | string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const prompt = `An admin of a timber company requests waybill check suggestions. Provide at least 3-4 specific, practical tips or checkpoints in ${promptLang} that are important when checking data on a waybill for timber transport to ensure accuracy and compliance. Your response should be a list, with each suggestion starting on a new line and preceded by '- ' (hyphen and space). The response should contain nothing else but this list.`;
    
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      const rawText = response.text;
      const suggestions = rawText.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- '))
        .map(line => line.substring(2).trim())
        .filter(suggestion => suggestion.length > 0);
      
      return suggestions.length > 0 ? suggestions : t('adminShippingTemplates_error_noSuggestionsFromAI');
    } catch (error) {
      console.error("Error generating waybill check suggestions with Gemini:", error);
      return t('adminShippingTemplates_error_waybillGeneric');
    }
  };


  const handleAiFeatureClick = async (
    featureKey: keyof AdminShippingTemplatesState,
    aiOperationKey: string
  ) => {
    setIsLoading(prev => ({ ...prev, [aiOperationKey]: true }));
    setState(prev => ({ 
        ...prev, 
        emailDraft: featureKey === 'emailDraft' ? undefined : prev.emailDraft,
        waybillCheckSuggestions: featureKey === 'waybillCheckSuggestions' ? undefined : prev.waybillCheckSuggestions,
        currentAiFeatureKey: aiOperationKey
    }));

    let result;
    try {
        if (featureKey === 'emailDraft') {
            result = await generateEmailDraftWithGemini();
        } else if (featureKey === 'waybillCheckSuggestions') {
            result = await generateWaybillCheckSuggestionsWithGemini();
        }
        setState(prev => ({ ...prev, [featureKey]: result }));
    } catch (error) {
        console.error(`Error in AI feature ${featureKey}:`, error);
        const errorMessage = t('adminUsers_error_aiFeatureGeneric');
        setState(prev => ({ ...prev, [featureKey]: errorMessage }));
    } finally {
        setIsLoading(prev => ({ ...prev, [aiOperationKey]: false }));
    }
  };

  const isAnyLoading = Object.values(isLoading).some(status => status);

  return (
    <>
      <PageTitle title={t('adminShippingTemplates_title')} subtitle={t('adminShippingTemplates_subtitle')} icon={<ClipboardDocumentListIcon className="h-8 w-8"/>}/>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* E-mail Draft Generation */}
        <Card title={t('adminShippingTemplates_emailDraftGeneration')}>
          <p className="text-sm text-slate-300 mb-3">{t('adminShippingTemplates_emailDraftDescription')}</p>
          <AiFeatureButton
            text={t('adminShippingTemplates_requestEmailDraft')}
            onClick={() => handleAiFeatureClick('emailDraft', 'emailDraftOp')}
            isLoading={isLoading.emailDraftOp}
            disabled={!ai || isAnyLoading}
            leftIcon={<EnvelopeIcon className="h-5 w-5" />}
          />
          {isLoading.emailDraftOp && state.currentAiFeatureKey === "emailDraftOp" && <LoadingSpinner text={t('adminShippingTemplates_generatingDraft')} />}
          {state.emailDraft && !isLoading.emailDraftOp && state.currentAiFeatureKey === "emailDraftOp" && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded">
              <h5 className={`font-semibold mb-1 ${state.emailDraft.includes(t('error')) || state.emailDraft.includes(t('customerNewDemand_error_aiUnavailable').substring(0,10)) ? "text-red-400" : "text-cyan-300"}`}>
                {t('adminShippingTemplates_generatedEmailDraft')}
              </h5>
              <pre className="text-sm text-slate-200 whitespace-pre-wrap">{state.emailDraft}</pre>
            </div>
          )}
        </Card>

        {/* Waybill Data Check Suggestions */}
        <Card title={t('adminShippingTemplates_waybillCheckSuggestions')}>
          <p className="text-sm text-slate-300 mb-3">{t('adminShippingTemplates_waybillCheckDescription')}</p>
          <AiFeatureButton
            text={t('adminShippingTemplates_requestCheckSuggestions')}
            onClick={() => handleAiFeatureClick('waybillCheckSuggestions', "waybillCheckOp")}
            isLoading={isLoading.waybillCheckOp}
            disabled={!ai || isAnyLoading}
            leftIcon={<DocumentCheckIcon className="h-5 w-5" />}
          />
          {isLoading.waybillCheckOp && state.currentAiFeatureKey === "waybillCheckOp" && <LoadingSpinner text={t('adminShippingTemplates_searchingSuggestions')} />}
          {state.waybillCheckSuggestions && !isLoading.waybillCheckOp && state.currentAiFeatureKey === "waybillCheckOp" && (
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-2">
              <h5 className={`font-semibold mb-1 ${
                (typeof state.waybillCheckSuggestions === 'string' && (state.waybillCheckSuggestions.includes(t('error')) || state.waybillCheckSuggestions.includes(t('customerNewDemand_error_aiUnavailable').substring(0,10)))) 
                ? "text-red-400" 
                : "text-cyan-400"
              }`}>
                {t('adminShippingTemplates_suggestedCheckpoints')}
              </h5>
              {typeof state.waybillCheckSuggestions === 'string' ? (
                <p className="text-sm text-red-300 whitespace-pre-wrap">{state.waybillCheckSuggestions}</p>
              ) : Array.isArray(state.waybillCheckSuggestions) && state.waybillCheckSuggestions.length > 0 ? (
                state.waybillCheckSuggestions.map((suggestion, idx) => (
                  <div key={idx} className={`p-2 bg-slate-700/50 rounded text-sm ${
                    suggestion.includes(t('error')) || suggestion.includes(t('customerNewDemand_error_aiUnavailable').substring(0,10)) ? "text-red-300" : "text-slate-200"
                  }`}>
                    <DocumentCheckIcon className={`h-4 w-4 inline mr-2 ${
                      suggestion.includes(t('error')) || suggestion.includes(t('customerNewDemand_error_aiUnavailable').substring(0,10)) ? "text-red-400" : "text-yellow-400"
                    }`}/>{suggestion}
                  </div>
                ))
              ) : (
                 <p className="text-sm text-slate-400">{t('adminShippingTemplates_noSuggestionsReceived')}</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
};

export default AdminShippingTemplatesPage;