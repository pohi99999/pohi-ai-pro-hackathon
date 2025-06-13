import React, { useState, useEffect, useCallback } from 'react';
import PageTitle from '../../components/PageTitle';
import Input from '../../components/Input';
import Textarea from '../../components/Textarea';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Select from '../../components/Select';
import AiFeatureButton from '../../components/AiFeatureButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import { StockItem, StockStatus } from '../../types';
import { MOCK_AI_RESPONSES } from '../../constants'; 
import { DIAMETER_TYPE_OPTIONS } from '../../locales'; // Updated import
import { ArchiveBoxArrowDownIcon } from '@heroicons/react/24/outline';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { useLocale } from '../../LocaleContext';

const MANUFACTURER_STOCK_STORAGE_KEY = 'pohi-ai-manufacturer-stock';

let ai: GoogleGenAI | null = null;
try {
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } else {
    console.warn("API_KEY environment variable is not set. Real AI features will not work.");
  }
} catch (error) {
  console.error("Error initializing GoogleGenAI:", error);
}


const ManufacturerNewStockPage: React.FC = () => {
  const { t, locale } = useLocale();
  const initialFormData: StockItem = {
    diameterType: '',
    diameterFrom: '',
    diameterTo: '',
    length: '',
    quantity: '',
    price: '',
    sustainabilityInfo: '',
    notes: '',
    cubicMeters: 0,
  };
  const [formData, setFormData] = useState<StockItem>(initialFormData);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [aiResponse, setAiResponse] = useState<string | string[] | null>(null);
  const [aiResponseTypeKey, setAiResponseTypeKey] = useState<string | null>(null); // Store key for translation
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [currentAiFeatureKey, setCurrentAiFeatureKey] = useState<string | null>(null);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const calculateCubicMeters = useCallback(() => {
    const { diameterFrom, diameterTo, length, quantity } = formData;
    if (diameterFrom && diameterTo && length && quantity) {
      const avgDiameter = (parseFloat(diameterFrom) + parseFloat(diameterTo)) / 2 / 100; // cm to m
      const len = parseFloat(length); // m
      const qty = parseInt(quantity); // pieces
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

  const isFormDataSufficientForImage = (): boolean => {
    const { diameterType, diameterFrom, diameterTo, length } = formData;
    return !!(diameterType && diameterFrom && diameterTo && length);
  };

  const isFormDataSufficientForAnalysis = (): boolean => {
    const { notes, sustainabilityInfo, diameterType, diameterFrom, diameterTo, length } = formData;
    return !!(
        (notes && notes.trim().length >= 5) ||
        (sustainabilityInfo && sustainabilityInfo.trim().length >= 5) ||
        (diameterType && diameterFrom && diameterTo && length)
    );
  };
  
  const isFormDataSufficientForPriceSuggestion = (): boolean => {
    const { diameterType, diameterFrom, diameterTo, length, quantity } = formData;
    return !!(diameterType && diameterFrom && diameterTo && length && quantity);
  };

  const generatePriceSuggestionWithGemini = async (): Promise<string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
    if (!isFormDataSufficientForPriceSuggestion()) {
      return t('manufacturerNewStock_error_provideFeaturesForPrice');
    }
    const { diameterType, diameterFrom, diameterTo, length, quantity, notes, sustainabilityInfo, cubicMeters } = formData;
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    let prompt = `On a timber trading platform, a manufacturer requests a price suggestion for their product. Provide a specific price suggestion in EUR/m³ or EUR/pcs, in ${promptLang}. Consider the given features, sustainability information (if any), and current market trends in the timber industry.
Product features:
- Timber type (e.g., log, lumber): (User might infer this from notes or diameter type, but main focus is on dimensions)
- Diameter type: ${diameterType}
- Diameter: ${diameterFrom}-${diameterTo} cm
- Length: ${length} m
- Quantity: ${quantity} pcs
- Calculated total cubic meters (if relevant): ${cubicMeters?.toFixed(3) || 'N/A'} m³
${sustainabilityInfo ? `- Sustainability information: ${sustainabilityInfo}` : ''}
${notes ? `- Notes/Other description (e.g., wood species, quality): ${notes}` : ''}

Your response should be in this format, in ${promptLang}:
Suggested price: [Price] EUR/[unit, e.g., m³ or pcs]
Justification: [Short, 1-2 sentence justification, which may address quality, demand, or other relevant factors.] The response should only contain the suggested price and justification text, without any extra formatting or prefix/suffix.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      return response.text || t('manufacturerNewStock_error_priceSuggestionGeneric');
    } catch (error) {
      console.error("Error generating price suggestion with Gemini:", error);
      return t('manufacturerNewStock_error_priceSuggestionGeneric');
    }
  };

  const generateSustainabilityReportWithGemini = async (): Promise<string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
    if (!isFormDataSufficientForAnalysis()) {
      return t('manufacturerNewStock_error_provideFeaturesForAnalysis');
    }
    const { diameterType, diameterFrom, diameterTo, length, quantity, sustainabilityInfo, notes } = formData;
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    let productDescription = `The product is: ${diameterType || 'N/A'}, diameter ${diameterFrom || 'N/A'}-${diameterTo || 'N/A'} cm, length ${length || 'N/A'} m, ${quantity || 'N/A'} pcs.`;
    if (sustainabilityInfo) productDescription += ` Sustainability information: ${sustainabilityInfo}.`;
    if (notes) productDescription += ` Other notes: ${notes}.`;

    const prompt = `A sustainability report in ${promptLang} is requested for a timber product (${productDescription}). Create a short, 2-4 sentence summary report. The report should assess potential sustainability aspects based on the product description and sustainability info. If there are signs of certifications (e.g., FSC, PEFC), mention them as positives. If information seems lacking, indicate what further data (e.g., forest management certificates, harvesting methods) could refine the assessment. The response should only contain the generated report text, without any extra formatting or prefix/suffix.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      return response.text || t('manufacturerNewStock_error_sustainabilityReportGeneric');
    } catch (error) {
      console.error("Error generating sustainability report with Gemini:", error);
      return t('manufacturerNewStock_error_sustainabilityReportGeneric');
    }
  };

  const generateMarketingTextWithGemini = async (): Promise<string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const prompt = `Write a short, catchy, and professional marketing text in ${promptLang} for the following timber:
    - Type: ${formData.diameterType}
    - Diameter: ${formData.diameterFrom}-${formData.diameterTo} cm
    - Length: ${formData.length} m
    - Quantity: ${formData.quantity} pcs
    ${formData.price ? `- Price: ${formData.price}` : ''}
    ${formData.sustainabilityInfo ? `- Sustainability info: ${formData.sustainabilityInfo}` : ''}
    ${formData.notes ? `- Notes/description: ${formData.notes}` : ''}

    The text should be concise, highlight the main benefits of the product, and address potential customers (e.g., construction companies, furniture manufacturers). Avoid exaggerations; remain informative and trustworthy. The response should only contain the generated marketing text, without any extra formatting or prefix/suffix.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      return response.text || t('manufacturerNewStock_error_marketingTextGeneric');
    } catch (error) {
      console.error("Error generating marketing text with Gemini:", error);
      return t('manufacturerNewStock_error_marketingTextGeneric');
    }
  };
  
  const generateProductImageWithImagen = async (): Promise<string | null> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
    if (!isFormDataSufficientForImage()) {
        return t('manufacturerNewStock_error_provideFeaturesForImage');
    }
    const { diameterType, diameterFrom, diameterTo, length, notes, quantity } = formData;
    let prompt = `Photo of the following timber: ${diameterType}, diameter ${diameterFrom}-${diameterTo}cm, length ${length}m.`;
    if (quantity) prompt += ` Total ${quantity} pieces.`;
    if (notes) prompt += ` Additional features or intended use: ${notes}.`;
    prompt += ` The timber should appear in a stack or as a single piece. Timber product, lumber, log wood. High-quality, sharp image, natural or neutral background, appropriate lighting.`;

    try {
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: prompt,
            config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
        });
        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image?.imageBytes) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            setGeneratedImageUrl(`data:image/jpeg;base64,${base64ImageBytes}`);
            return null; 
        }
        console.warn("Imagen response did not contain expected image data:", response);
        return t('manufacturerNewStock_error_failedToGenerateImage');
    } catch (error) {
        console.error("Error generating product image with Imagen:", error);
        return t('manufacturerNewStock_error_imageGenerationGeneric');
    }
  };

  const analyzeProductListingWithGemini = async (): Promise<string[] | string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
    if (!isFormDataSufficientForAnalysis()) {
      return t('manufacturerNewStock_error_provideFeaturesForAnalysis');
    }
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const completenessFeedbackLabel = t('manufacturerNewStock_ai_analysisCompleteness');
    const qualityAppealSuggestionLabel = t('manufacturerNewStock_ai_analysisQualityAppeal');
    const potentialTargetAudienceLabel = t('manufacturerNewStock_ai_analysisTargetAudience');

    const prompt = `Analyze the following timber product listing for an online marketplace. Provide feedback on its completeness, suggestions to improve quality and appeal, and identify the potential target audience.
Provide your response in ${promptLang}. Start each part on a new line with the specified labels (use these exact labels):
${completenessFeedbackLabel} [Your feedback on completeness here]
${qualityAppealSuggestionLabel} [Your suggestions for improving quality and appeal here]
${potentialTargetAudienceLabel} [Your potential target audience here]

The response should only contain the analysis lines, without any extra text or markdown.

Product Data:
- Diameter Type: ${formData.diameterType || 'Not specified'}
- Diameter: ${formData.diameterFrom && formData.diameterTo ? `${formData.diameterFrom}-${formData.diameterTo} cm` : 'Not specified'}
- Length: ${formData.length ? `${formData.length} m` : 'Not specified'}
- Quantity: ${formData.quantity ? `${formData.quantity} pcs` : 'Not specified'}
- Price: ${formData.price || 'Not specified'}
- Sustainability Information: ${formData.sustainabilityInfo || 'Not specified'}
- Notes/Description: ${formData.notes || 'Not specified'}
`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      const rawText = response.text;
      const structuredFeedback: string[] = [];
      const analysisRegex = new RegExp(`^(${completenessFeedbackLabel}|${qualityAppealSuggestionLabel}|${potentialTargetAudienceLabel})\\s*([\\s\\S]*?)(?=\\n(?:${completenessFeedbackLabel}|${qualityAppealSuggestionLabel}|${potentialTargetAudienceLabel})|$)`, 'gim');

      let match;
      while ((match = analysisRegex.exec(rawText)) !== null) {
        const header = match[1].trim();
        const content = match[2].trim().replace(/\n+/g, ' ');
        structuredFeedback.push(`${header} ${content}`);
      }

      if (structuredFeedback.length > 0) return structuredFeedback;
      const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.some(line => line.startsWith(completenessFeedbackLabel) || line.startsWith(qualityAppealSuggestionLabel) || line.startsWith(potentialTargetAudienceLabel))) {
         return lines;
      }
      return [t('manufacturerNewStock_ai_analysisFailedExtract', { rawResponse: rawText.substring(0, 200) + (rawText.length > 200 ? "..." : "") })];
    } catch (error) {
      console.error("Error analyzing product listing with Gemini:", error);
      return t('manufacturerNewStock_error_listingAnalysisGeneric');
    }
  };

  const handleAiFeatureClick = async (
    featureKey: string,
    responseGenerator: () => Promise<string | string[] | null>,
    responseTypeKeyForTranslation: string 
  ) => {
    setIsLoading(prev => ({ ...prev, [featureKey]: true }));
    setCurrentAiFeatureKey(featureKey);
    setGeneratedImageUrl(null);
    setAiResponse(null);
    setAiResponseTypeKey(null);

    try {
      const result = await responseGenerator();
      if (featureKey === 'productImage') {
         if (typeof result === 'string') { 
            setAiResponse(result); 
            setAiResponseTypeKey("manufacturerNewStock_ai_imageGenErrorTitle");
        }
      } else {
        setAiResponse(result);
        setAiResponseTypeKey(responseTypeKeyForTranslation);
      }
    } catch (error) {
      console.error(`Error in AI feature ${featureKey}:`, error);
      setAiResponse(t('manufacturerNewStock_error_aiFeatureError'));
      setAiResponseTypeKey("error");
    } finally {
      setIsLoading(prev => ({ ...prev, [featureKey]: false }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(prev => ({...prev, submit: true}));
    setCurrentAiFeatureKey(null);
    const newStockItem: StockItem = {
      ...formData,
      id: `STK-${Date.now()}`,
      uploadDate: new Date().toISOString(),
      status: StockStatus.AVAILABLE,
    };
    try {
      const existingStockRaw = localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY);
      const existingStock: StockItem[] = existingStockRaw ? JSON.parse(existingStockRaw) : [];
      localStorage.setItem(MANUFACTURER_STOCK_STORAGE_KEY, JSON.stringify([newStockItem, ...existingStock]));
    } catch (error) {
      console.error("Error saving stock:", error);
    }
    setTimeout(() => {
      alert(t('manufacturerNewStock_stockUploadedSuccess', { id: newStockItem.id || 'N/A' }));
      setFormData(initialFormData);
      setAiResponse(null);
      setAiResponseTypeKey(null);
      setGeneratedImageUrl(null);
      setIsLoading(prev => ({...prev, submit: false}));
    }, 1500);
  };
  
  const isAnyLoading = Object.values(isLoading).some(s => s);
  const diameterTypeOptions = DIAMETER_TYPE_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) }));

  return (
    <>
      <PageTitle title={t('manufacturerNewStock_title')} subtitle={t('manufacturerNewStock_subtitle')} icon={<ArchiveBoxArrowDownIcon className="h-8 w-8"/>} />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <Card title={t('manufacturerNewStock_productFeaturesAndPricing')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label={t('customerNewDemand_diameterType')} name="diameterType" options={diameterTypeOptions} value={formData.diameterType} onChange={handleInputChange} required />
              <div></div>
              <Input label={t('customerNewDemand_diameterFrom')} name="diameterFrom" type="number" step="0.1" min="0" value={formData.diameterFrom} onChange={handleInputChange} required />
              <Input label={t('customerNewDemand_diameterTo')} name="diameterTo" type="number" step="0.1" min="0" value={formData.diameterTo} onChange={handleInputChange} required />
              <Input label={t('customerNewDemand_length')} name="length" type="number" step="0.1" min="0" value={formData.length} onChange={handleInputChange} required />
              <Input label={t('customerNewDemand_quantity')} name="quantity" type="number" min="1" value={formData.quantity} onChange={handleInputChange} required />
              <Input label={`${t('manufacturerMyStock_price')} (${t('manufacturerNewStock_pricePlaceholder')})`} name="price" type="text" value={formData.price || ''} onChange={handleInputChange} placeholder={t('manufacturerNewStock_pricePlaceholder')}/>
              <Textarea label={t('manufacturerNewStock_sustainabilityInfo')} name="sustainabilityInfo" value={formData.sustainabilityInfo || ''} onChange={handleInputChange} rows={3} className="sm:col-span-2" placeholder={t('manufacturerNewStock_sustainabilityPlaceholder')}/>
            </div>
             <div className="mt-4">
                <Textarea label={t('notes')} name="notes" value={formData.notes || ''} onChange={handleInputChange} rows={4} placeholder={t('manufacturerNewStock_notesPlaceholder')}/>
            </div>
            <div className="mt-6 p-4 bg-slate-700 rounded-md">
              <p className="text-lg font-semibold text-cyan-400">{t('calculatedCubicMeters')}: <span className="text-white">{formData.cubicMeters || 0} m³</span></p>
            </div>
          </Card>
          <Button
            type="submit"
            className="w-full md:w-auto"
            isLoading={isLoading['submit']}
            disabled={Boolean(isAnyLoading || !formData.diameterType || !formData.diameterFrom || !formData.diameterTo || !formData.length || !formData.quantity)}
          >
            {t('manufacturerNewStock_uploadStockButton')}
          </Button>
        </div>

        <div className="space-y-4">
           <Card title={t('manufacturerNewStock_ai_title')}>
            <div className="space-y-3">
              <AiFeatureButton
                text={t('manufacturerNewStock_ai_requestPriceSuggestion')}
                onClick={() => handleAiFeatureClick('priceSuggestion', generatePriceSuggestionWithGemini, 'manufacturerNewStock_ai_priceSuggestionTitle')}
                isLoading={isLoading['priceSuggestion']}
                disabled={Boolean(!ai || isAnyLoading || !isFormDataSufficientForPriceSuggestion())}
              />
              <AiFeatureButton
                text={t('manufacturerNewStock_ai_requestSustainabilityReport')}
                onClick={() => handleAiFeatureClick('sustainabilityReport', generateSustainabilityReportWithGemini, 'manufacturerNewStock_ai_sustainabilityReportTitle')}
                isLoading={isLoading['sustainabilityReport']}
                disabled={Boolean(!ai || isAnyLoading || !isFormDataSufficientForAnalysis())}
              />
              <AiFeatureButton
                text={t('manufacturerNewStock_ai_generateMarketingText')}
                onClick={() => handleAiFeatureClick('marketingText', generateMarketingTextWithGemini, 'manufacturerNewStock_ai_marketingTextTitle')}
                isLoading={isLoading['marketingText']}
                disabled={Boolean(!ai || isAnyLoading || !isFormDataSufficientForAnalysis())}
              />
              <AiFeatureButton
                text={t('manufacturerNewStock_ai_generateProductPhoto')}
                onClick={() => handleAiFeatureClick('productImage', generateProductImageWithImagen, 'manufacturerNewStock_ai_generatedPhotoTitle')}
                isLoading={isLoading['productImage']}
                disabled={Boolean(!ai || isAnyLoading || !isFormDataSufficientForImage())}
              />
              <AiFeatureButton
                text={t('manufacturerNewStock_ai_analyzeProductListing')}
                onClick={() => handleAiFeatureClick('listingAnalysis', analyzeProductListingWithGemini, 'manufacturerNewStock_ai_listingAnalysisTitle')}
                isLoading={isLoading['listingAnalysis']}
                disabled={Boolean(!ai || isAnyLoading || !isFormDataSufficientForAnalysis())}
              />
              {/* Mock AI features kept for demonstration, can be removed if not needed */}
              <AiFeatureButton text={t('manufacturerNewStock_ai_datasheetSuggestions')} onClick={() => { setCurrentAiFeatureKey('datasheetSuggestions'); handleAiFeatureClick('datasheetSuggestions', () => Promise.resolve(MOCK_AI_RESPONSES.datasheetSuggestions), 'manufacturerNewStock_ai_datasheetSuggestionsTitle'); }} isLoading={isLoading['datasheetSuggestions']} disabled={isAnyLoading} />
              <AiFeatureButton text={t('manufacturerNewStock_ai_keywordSuggestions')} onClick={() => { setCurrentAiFeatureKey('keywordSuggestions'); handleAiFeatureClick('keywordSuggestions', () => Promise.resolve(MOCK_AI_RESPONSES.keywordSuggestions), 'manufacturerNewStock_ai_keywordSuggestionsTitle'); }} isLoading={isLoading['keywordSuggestions']} disabled={isAnyLoading} />
              <AiFeatureButton text={t('manufacturerNewStock_ai_translateDescription')} onClick={() => {
                setCurrentAiFeatureKey('translation');
                handleAiFeatureClick('translation', () => Promise.resolve(formData.notes || t('manufacturerNewStock_error_noNotesToTranslate')), 'manufacturerNewStock_ai_translationTitle');
              }} isLoading={isLoading['translation']} disabled={isAnyLoading} />
            </div>
          </Card>

          { isLoading[currentAiFeatureKey || ''] && currentAiFeatureKey !== 'submit' && currentAiFeatureKey !== 'productImage' &&
             <LoadingSpinner text={t('manufacturerNewStock_ai_generatingResponse')} />
          }
           {isLoading['productImage'] && currentAiFeatureKey === 'productImage' && <LoadingSpinner text={t('manufacturerNewStock_ai_generatingPhoto')} />}

          {aiResponse && aiResponseTypeKey && !isAnyLoading && !generatedImageUrl && currentAiFeatureKey && !isLoading[currentAiFeatureKey] && (
            <Card title={t(aiResponseTypeKey as any)} titleClassName={aiResponse.toString().toLowerCase().includes("error") || aiResponse.toString().toLowerCase().includes("hiba") || aiResponse.toString().includes(t('manufacturerNewStock_error_provideFeaturesForAnalysis').substring(0,20)) || aiResponse.toString().includes(t('manufacturerNewStock_error_provideFeaturesForPrice').substring(0,20)) || aiResponse.toString().includes(t('manufacturerNewStock_error_provideFeaturesForImage').substring(0,20)) || aiResponseTypeKey === 'error' || aiResponseTypeKey === "manufacturerNewStock_ai_imageGenErrorTitle" ? "text-red-400" : "text-yellow-400"}>
              {typeof aiResponse === 'string' && <p className="text-slate-300 whitespace-pre-wrap">{aiResponse}</p>}
              {Array.isArray(aiResponse) && (
                <ul className="space-y-2 text-slate-300">
                  {aiResponse.map((item, index) => {
                    const isHeader = item.includes(t('manufacturerNewStock_ai_analysisCompleteness')) || item.includes(t('manufacturerNewStock_ai_analysisQualityAppeal')) || item.includes(t('manufacturerNewStock_ai_analysisTargetAudience'));
                    let headerText = "";
                    let content = item;
                    if(isHeader) {
                        const colonIndex = item.indexOf(":");
                        if (colonIndex !== -1) {
                            headerText = item.substring(0, colonIndex + 1);
                            content = item.substring(colonIndex + 1).trim();
                        }
                    }
                    return (
                      <li key={index} className="whitespace-pre-wrap">
                        {isHeader && headerText && <strong className="text-cyan-300">{headerText}</strong>}
                        {content}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          {generatedImageUrl && currentAiFeatureKey === 'productImage' && !isLoading['productImage'] && (
            <Card title={t('manufacturerNewStock_ai_generatedPhotoTitle')} titleClassName="text-yellow-400">
                <img src={generatedImageUrl} alt={t('manufacturerNewStock_ai_generatedPhotoTitle')} className="w-full h-auto rounded-md shadow-lg" />
            </Card>
          )}
        </div>
      </form>
    </>
  );
};

export default ManufacturerNewStockPage;