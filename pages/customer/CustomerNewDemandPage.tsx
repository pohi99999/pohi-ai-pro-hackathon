import React, { useState, useEffect, useCallback } from 'react';
import PageTitle from '../../components/PageTitle';
import Input from '../../components/Input';
import Textarea from '../../components/Textarea';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Select from '../../components/Select';
import AiFeatureButton from '../../components/AiFeatureButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ProductFeatures, AlternativeProduct, DemandItem, DemandStatus, GeminiComparisonResponse } from '../../types';
import { DIAMETER_TYPE_OPTIONS } from '../../locales'; 
import { ShoppingCartIcon } from '@heroicons/react/24/outline';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { useLocale } from '../../LocaleContext';
import { CUSTOMER_DEMANDS_STORAGE_KEY } from '../../constants';


let ai: GoogleGenAI | null = null;
try {
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } else {
    console.warn("API_KEY environment variable is not set for CustomerNewDemandPage. Real AI features will not work."); 
  }
} catch (error) {
  console.error("Error initializing GoogleGenAI for CustomerNewDemandPage:", error); 
}

const CustomerNewDemandPage: React.FC = () => { 
  const { t, locale } = useLocale();
  const initialFormData: ProductFeatures = {
    diameterType: '',
    diameterFrom: '',
    diameterTo: '',
    length: '',
    quantity: '',
    notes: '',
    cubicMeters: 0,
  };
  const [formData, setFormData] = useState<ProductFeatures>(initialFormData);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  
  const [alternativeProducts, setAlternativeProducts] = useState<AlternativeProduct[] | string | null>(null);
  const [productComparison, setProductComparison] = useState<GeminiComparisonResponse | string | null>(null);
  const [currentAiFeatureKey, setCurrentAiFeatureKey] = useState<string | null>(null); 


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const calculateCubicMeters = useCallback(() => {
    const { diameterFrom, diameterTo, length, quantity } = formData;
    if (diameterFrom && diameterTo && length && quantity) {
      const avgDiameter = (parseFloat(diameterFrom) + parseFloat(diameterTo)) / 2 / 100; 
      const len = parseFloat(length); 
      const qty = parseInt(quantity); 
      if (!isNaN(avgDiameter) && !isNaN(len) && !isNaN(qty) && avgDiameter > 0) {
        const volumePerPiece = Math.PI * Math.pow(avgDiameter / 2, 2) * len;
        setFormData(prev => ({ ...prev, cubicMeters: parseFloat((volumePerPiece * qty).toFixed(3)) }));
      } else {
        setFormData(prev => ({ ...prev, cubicMeters: 0 }));
      }
    } else {
      setFormData(prev => ({ ...prev, cubicMeters: 0 }));
    }
  }, [formData.diameterFrom, formData.diameterTo, formData.length, formData.quantity]);

  useEffect(() => {
    calculateCubicMeters();
  }, [calculateCubicMeters]);

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

  const suggestAlternativeProductsWithGemini = async (): Promise<AlternativeProduct[] | string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
    if (!formData.diameterType || !formData.diameterFrom || !formData.diameterTo || !formData.length || !formData.quantity) {
        return t('customerNewDemand_error_provideFeaturesForAlternatives');
    }
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const prompt = `A customer is looking for alternatives to the following timber on an online timber marketplace. Provide 2-3 specific alternative product suggestions in ${promptLang}, in JSON format. Each suggestion should include a "name" (product name) and "specs" (short description, e.g., dimensions, quality).
Original demand:
- Diameter type: ${formData.diameterType}
- Diameter: ${formData.diameterFrom}-${formData.diameterTo} cm
- Length: ${formData.length} m
- Quantity: ${formData.quantity} pcs
${formData.notes ? `- Notes: ${formData.notes}` : ''}

The response should only contain the JSON array, [{ "name": "...", "specs": "..." }, ...], without any extra text or markdown. Output in ${promptLang}.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const parsedResult = parseJsonFromGeminiResponse<{name: string; specs: string}[]>(response.text, "customerNewDemand_ai_suggestAlternatives");
      if (typeof parsedResult === 'string') return parsedResult; 
      
      if (Array.isArray(parsedResult)) {
        return parsedResult.map((item, index) => ({ ...item, id: `gemini-alt-${Date.now()}-${index}` }));
      }
      return t('customerNewDemand_error_aiResponseNotArray');
    } catch (error) {
      console.error("Error suggesting alternative products with Gemini:", error);
      return t('customerNewDemand_error_alternativesGeneric');
    }
  };

  const compareProductsWithGemini = async (): Promise<GeminiComparisonResponse | string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
    if (!alternativeProducts || typeof alternativeProducts === 'string' || alternativeProducts.length === 0) {
      return t('customerNewDemand_error_noAlternativesForComparison');
    }
    const alternativeToCompare = alternativeProducts[0]; 
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';

    const prompt = `A customer requests a product comparison between the following two timber items. Provide the comparison in ${promptLang}, in JSON format.
The JSON object should contain an "original" and an "alternative" key. Under each, include the following fields: "name" (string), "dimensions_quantity_notes" (string, summarizing dimensions, quantity, notes), "pros" (string array, advantages from the customer's perspective), and "cons" (string array, disadvantages from the customer's perspective).

Original Demand (Original):
- Product Name: "${t('customerNewDemand_ai_comparisonOriginalName')}"
- Dimensions/Quantity/Notes: "${formData.diameterType}, Ø ${formData.diameterFrom}-${formData.diameterTo}cm, Length: ${formData.length}m, ${formData.quantity}pcs. ${formData.notes || 'No other notes.'}"

Alternative (Alternative):
- Product Name: "${alternativeToCompare.name}"
- Dimensions/Quantity/Notes: "${alternativeToCompare.specs}"

The response should only contain the JSON object, without any extra text or markdown. Output in ${promptLang}.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const parsedResult = parseJsonFromGeminiResponse<GeminiComparisonResponse>(response.text, "customerNewDemand_ai_compareProducts");
      return parsedResult;
    } catch (error) {
      console.error("Error comparing products with Gemini:", error);
      return t('customerNewDemand_error_comparisonGeneric');
    }
  };
  
  const generateAutoCommentWithGemini = async (): Promise<string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
     if (!formData.diameterType || !formData.diameterFrom || !formData.diameterTo || !formData.length || !formData.quantity) {
        return t('customerNewDemand_error_provideFeaturesForComment');
    }
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const prompt = `A customer is looking for timber on an online marketplace. Based on the following data, generate a short, polite, and informative note (notes) in ${promptLang} that the customer can attach to their demand. The note should highlight quality expectations or intended use if inferable from the data. Maximum 2-3 sentences.

Product features:
- Diameter type: ${formData.diameterType}
- Diameter: ${formData.diameterFrom}-${formData.diameterTo} cm
- Length: ${formData.length} m
- Quantity: ${formData.quantity} pcs

The response should only contain the generated note text, without any extra formatting or prefix/suffix. Output in ${promptLang}.`;
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      return response.text || t('customerNewDemand_error_failedToGenerateComment');
    } catch (error) {
      console.error("Error generating auto comment with Gemini:", error);
      return t('customerNewDemand_error_commentGeneric');
    }
  };
  
  const handleAiFeatureClick = async (
    featureKey: 'alternatives' | 'comparison' | 'autoComment',
    actionAsync: () => Promise<any>
  ) => {
    setIsLoading(prev => ({ ...prev, [featureKey]: true }));
    setCurrentAiFeatureKey(featureKey);
    if (featureKey !== 'alternatives') setAlternativeProducts(null);
    if (featureKey !== 'comparison') setProductComparison(null);
    if (featureKey !== 'autoComment' && formData.notes?.startsWith(t('customerNewDemand_ai_notesAiErrorPrefix'))) setFormData(prev => ({...prev, notes: ''}));


    try {
      const result = await actionAsync();
      if (featureKey === 'alternatives') {
        setAlternativeProducts(result);
        if (typeof result === 'string' || result.length === 0) {
            setProductComparison(null); 
        }
      } else if (featureKey === 'comparison') {
        setProductComparison(result);
      } else if (featureKey === 'autoComment') {
        if (typeof result === 'string' && !result.toLowerCase().includes("error") && !result.toLowerCase().includes("failed") && !result.toLowerCase().includes(t('customerNewDemand_error_provideFeaturesForComment').toLowerCase())) {
            setFormData(prev => ({ ...prev, notes: result }));
        } else if (typeof result === 'string') { 
             setFormData(prev => ({ ...prev, notes: `${t('customerNewDemand_ai_notesAiErrorPrefix')} ${result}` }));
        }
      }
    } catch (error) {
        console.error(`Error in AI feature ${featureKey}:`, error);
        const errorMsg = t('customerNewDemand_error_aiUnexpected');
        if (featureKey === 'alternatives') setAlternativeProducts(errorMsg);
        else if (featureKey === 'comparison') setProductComparison(errorMsg);
        else if (featureKey === 'autoComment') setFormData(prev => ({ ...prev, notes: `${t('customerNewDemand_ai_notesAiErrorPrefix')} ${errorMsg}`}));
    } finally {
      setIsLoading(prev => ({ ...prev, [featureKey]: false }));
    }
  };

  const isAnyLoading = Object.values(isLoading).some(status => status);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(prev => ({ ...prev, submit: true }));
    setCurrentAiFeatureKey(null); 

    const newDemand: DemandItem = {
      ...formData,
      id: `DEM-${Date.now()}`,
      submissionDate: new Date().toISOString(),
      status: DemandStatus.RECEIVED,
    };

    try {
      const existingDemandsRaw = localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY);
      const existingDemands: DemandItem[] = existingDemandsRaw ? JSON.parse(existingDemandsRaw) : [];
      localStorage.setItem(CUSTOMER_DEMANDS_STORAGE_KEY, JSON.stringify([newDemand, ...existingDemands]));
    } catch (error) {
      console.error("Error saving demand:", error);
    }
    
    setTimeout(() => {
      alert(t('customerNewDemand_demandSubmittedSuccess', { id: newDemand.id }));
      setFormData(initialFormData);
      setAlternativeProducts(null);
      setProductComparison(null);
      setIsLoading(prev => ({ ...prev, submit: false }));
    }, 1500);
  };
  
  const diameterTypeOptions = DIAMETER_TYPE_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) }));

  return (
    <>
      <PageTitle title={t('customerNewDemand_title')} subtitle={t('customerNewDemand_subtitle')} icon={<ShoppingCartIcon className="h-8 w-8"/>} />
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <Card title={t('customerNewDemand_productFeatures')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label={t('customerNewDemand_diameterType')}
                name="diameterType"
                options={diameterTypeOptions}
                value={formData.diameterType}
                onChange={handleInputChange}
                required
              />
               <div></div> 
              <Input label={t('customerNewDemand_diameterFrom')} name="diameterFrom" type="number" step="0.1" min="0" value={formData.diameterFrom} onChange={handleInputChange} required />
              <Input label={t('customerNewDemand_diameterTo')} name="diameterTo" type="number" step="0.1" min="0" value={formData.diameterTo} onChange={handleInputChange} required />
              <Input label={t('customerNewDemand_length')} name="length" type="number" step="0.1" min="0" value={formData.length} onChange={handleInputChange} required />
              <Input label={t('customerNewDemand_quantity')} name="quantity" type="number" min="1" value={formData.quantity} onChange={handleInputChange} required />
            </div>
            <div className="mt-4">
                <Textarea 
                  label={t('notes')} 
                  name="notes" 
                  value={formData.notes} 
                  onChange={handleInputChange} 
                  rows={4} 
                  placeholder={t('customerNewDemand_notesPlaceholder')}
                  aria-describedby="notes-ai-feedback"
                />
                {formData.notes?.startsWith(t('customerNewDemand_ai_notesAiErrorPrefix')) && <p id="notes-ai-feedback" className="text-xs text-red-400 mt-1">{formData.notes}</p>}
            </div>
            <div className="mt-6 p-4 bg-slate-700 rounded-md">
              <p className="text-lg font-semibold text-cyan-400">{t('calculatedCubicMeters')}: <span className="text-white">{formData.cubicMeters || 0} m³</span></p>
            </div>
          </Card>
          <Button 
            type="submit" 
            className="w-full md:w-auto" 
            isLoading={isLoading['submit']} 
            disabled={isAnyLoading || !formData.diameterType || !formData.diameterFrom || !formData.diameterTo || !formData.length || !formData.quantity}
          >
            {t('customerNewDemand_submitDemandButton')}
          </Button>
        </div>

        <div className="space-y-4">
           <Card title={t('aiAssistant')}>
            <div className="space-y-3">
              <AiFeatureButton
                text={t('customerNewDemand_ai_suggestAlternatives')}
                onClick={() => handleAiFeatureClick('alternatives', suggestAlternativeProductsWithGemini)}
                isLoading={isLoading['alternatives']}
                disabled={Boolean(!ai || isAnyLoading || !formData.diameterType || !formData.diameterFrom || !formData.diameterTo || !formData.length || !formData.quantity)}
              />
              <AiFeatureButton
                text={t('customerNewDemand_ai_compareProducts')}
                onClick={() => handleAiFeatureClick('comparison', compareProductsWithGemini)}
                isLoading={isLoading['comparison']}
                disabled={Boolean(!ai || isAnyLoading || !alternativeProducts || typeof alternativeProducts === 'string' || alternativeProducts.length === 0)}
              />
              <AiFeatureButton
                text={t('customerNewDemand_ai_generateAutoComment')}
                onClick={() => handleAiFeatureClick('autoComment', generateAutoCommentWithGemini)}
                isLoading={isLoading['autoComment']}
                disabled={Boolean(!ai || isAnyLoading || !formData.diameterType || !formData.diameterFrom || !formData.diameterTo || !formData.length || !formData.quantity)}
              />
            </div>
          </Card>

          {isLoading['alternatives'] && currentAiFeatureKey === 'alternatives' && <LoadingSpinner text={t('customerNewDemand_ai_searchingAlternatives')} />}
          {alternativeProducts && currentAiFeatureKey === 'alternatives' && !isLoading['alternatives'] && (
            <Card title={t('customerNewDemand_ai_suggestedAlternativesTitle')} titleClassName={typeof alternativeProducts === 'string' ? "text-red-400" : "text-yellow-400"}>
              {typeof alternativeProducts === 'string' ? (
                <p className="text-slate-300">{alternativeProducts}</p>
              ) : alternativeProducts.length > 0 ? (
                <ul className="space-y-3">
                  {alternativeProducts.map(product => (
                    <li key={product.id} className="p-3 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors">
                      <h4 className="font-semibold text-cyan-300">{product.name}</h4>
                      <p className="text-sm text-slate-300">{product.specs}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-300">{t('customerNewDemand_ai_noAlternativesFound')}</p>
              )}
            </Card>
          )}

          {isLoading['comparison'] && currentAiFeatureKey === 'comparison' && <LoadingSpinner text={t('customerNewDemand_ai_preparingComparison')} />}
          {productComparison && currentAiFeatureKey === 'comparison' && !isLoading['comparison'] && (
             <Card title={t('customerNewDemand_ai_productComparisonTitle')} titleClassName={typeof productComparison === 'string' ? "text-red-400" : "text-yellow-400"}>
                {typeof productComparison === 'string' ? (
                    <p className="text-slate-300">{productComparison}</p>
                ) : (
                    <div className="space-y-4 text-sm">
                        <div>
                            <h4 className="font-semibold text-cyan-300 mb-1">{productComparison.original.name}</h4>
                            <p className="text-slate-300 mb-1"><strong>{t('customerNewDemand_ai_comparisonFeatures')}:</strong> {productComparison.original.dimensions_quantity_notes}</p>
                            {productComparison.original.pros && productComparison.original.pros.length > 0 && <p className="text-green-300"><strong>{t('customerNewDemand_ai_comparisonPros')}:</strong> {productComparison.original.pros.join(', ')}</p>}
                            {productComparison.original.cons && productComparison.original.cons.length > 0 && <p className="text-red-300"><strong>{t('customerNewDemand_ai_comparisonCons')}:</strong> {productComparison.original.cons.join(', ')}</p>}
                        </div>
                        <div className="border-t border-slate-700 pt-4">
                            <h4 className="font-semibold text-cyan-300 mb-1">{productComparison.alternative.name}</h4>
                            <p className="text-slate-300 mb-1"><strong>{t('customerNewDemand_ai_comparisonFeatures')}:</strong> {productComparison.alternative.dimensions_quantity_notes}</p>
                            {productComparison.alternative.pros && productComparison.alternative.pros.length > 0 && <p className="text-green-300"><strong>{t('customerNewDemand_ai_comparisonPros')}:</strong> {productComparison.alternative.pros.join(', ')}</p>}
                            {productComparison.alternative.cons && productComparison.alternative.cons.length > 0 && <p className="text-red-300"><strong>{t('customerNewDemand_ai_comparisonCons')}:</strong> {productComparison.alternative.cons.join(', ')}</p>}
                        </div>
                    </div>
                )}
            </Card>
          )}
           {isLoading['autoComment'] && currentAiFeatureKey === 'autoComment' && <LoadingSpinner text={t('customerNewDemand_ai_generatingComment')} />}
        </div>
      </form>
    </>
  );
};

export default CustomerNewDemandPage;