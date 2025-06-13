
import React, { useState, useEffect, useCallback } from 'react';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import AiFeatureButton from '../../components/AiFeatureButton';
import Input from '../../components/Input';
import Textarea from '../../components/Textarea';
import Select from '../../components/Select';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { MOCK_AI_RESPONSES, CUSTOMER_DEMANDS_STORAGE_KEY, MANUFACTURER_STOCK_STORAGE_KEY, MOCK_COMPANIES_STORAGE_KEY } from '../../constants';
import { RECIPIENT_TYPE_OPTIONS, DIAMETER_TYPE_OPTIONS, getTranslatedUserRole } from '../../locales';
import { UsersIcon, ChatBubbleLeftEllipsisIcon, ShieldCheckIcon, UserGroupIcon, PlusCircleIcon, BuildingStorefrontIcon, BeakerIcon } from '@heroicons/react/24/outline';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { useLocale } from '../../LocaleContext';
import { TranslationKey, MockCompany, UserRole, DemandItem, StockItem, DemandStatus, StockStatus, ProductFeatures } from '../../types';


let ai: GoogleGenAI | null = null;
try {
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } else {
    console.warn("API_KEY environment variable is not set for AdminUsersPage. Real AI features will be limited.");
  }
} catch (error) {
  console.error("Error initializing GoogleGenAI for AdminUsersPage:", error);
}

interface AdminUsersState {
  recipientType?: string;
  scenario?: string;
  communicationDraft?: string;
  contentToCheck?: string;
  contentPolicyResult?: string;
  userActivityAnalysisResult?: string[] | string;
  currentAiFeatureKey?: string; 

  mockCompanies: MockCompany[];
  newCompanyName: string;
  newCompanyRole: UserRole.CUSTOMER | UserRole.MANUFACTURER | ''; 
  newCompanyStreet: string;
  newCompanyCity: string;
  newCompanyZipCode: string;
  newCompanyCountry: string;
  
  showCompanyActionForm: 'demand' | 'stock' | null;
  selectedCompanyForAction: MockCompany | null;
  companyActionFormData: Partial<ProductFeatures & { price?: string; sustainabilityInfo?: string }>;
  companyActionFormLoading: boolean;

  dataGenerationLoading: boolean;
  dataGenerationFeedback: string | null;
}

const initialCompanyActionFormData = {
  diameterType: '',
  diameterFrom: '',
  diameterTo: '',
  length: '',
  quantity: '',
  notes: '',
  price: '',
  sustainabilityInfo: '',
};


const AdminUsersPage: React.FC = () => {
  const { t, locale } = useLocale();
  const [isLoadingAi, setIsLoadingAi] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<AdminUsersState>({
    mockCompanies: [],
    newCompanyName: '',
    newCompanyRole: '',
    newCompanyStreet: '',
    newCompanyCity: '',
    newCompanyZipCode: '',
    newCompanyCountry: '',
    showCompanyActionForm: null,
    selectedCompanyForAction: null,
    companyActionFormData: { ...initialCompanyActionFormData },
    companyActionFormLoading: false,
    dataGenerationLoading: false,
    dataGenerationFeedback: null,
  });

  useEffect(() => {
    try {
      const storedCompanies = localStorage.getItem(MOCK_COMPANIES_STORAGE_KEY);
      if (storedCompanies) {
        setState(prev => ({ ...prev, mockCompanies: JSON.parse(storedCompanies) }));
      }
    } catch (e) {
      console.error("Failed to load mock companies from localStorage", e);
    }
  }, []);

  const saveMockCompanies = (companies: MockCompany[]) => {
    localStorage.setItem(MOCK_COMPANIES_STORAGE_KEY, JSON.stringify(companies));
  };

  const generateCommunicationDraftWithGemini = async (): Promise<string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
    if (!state.recipientType || !state.scenario) return t('adminUsers_error_formIncomplete'); // Or a more specific error

    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const prompt = `Generate a professional and polite communication draft in ${promptLang}.
Recipient Type: ${state.recipientType}
Scenario/Purpose: ${state.scenario}
The draft should be suitable for a timber trading platform.
Include placeholders like [Partner Name], [Order Number], [Date], [Time] if relevant to the scenario.
The response should only contain the generated draft text, without any extra formatting or prefix/suffix.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      return response.text || t('adminUsers_error_aiFeatureGeneric');
    } catch (error) {
      console.error("Error generating communication draft with Gemini:", error);
      return t('adminUsers_error_aiFeatureGeneric');
    }
  };
  
  const checkContentPolicyWithGemini = async (): Promise<string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
    if (!state.contentToCheck) return t('adminUsers_error_formIncomplete'); // Or a specific error for empty content

    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const prompt = `Check the following text for compliance with general content policies appropriate for a business platform (timber trading).
Text to check: "${state.contentToCheck}"
Provide a brief assessment in ${promptLang}, highlighting any potential issues (e.g., misleading claims, unprofessional language) or confirming compliance. Suggest improvements if necessary.
The response should only contain the assessment text, without any extra formatting or prefix/suffix.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      return response.text || t('adminUsers_error_aiFeatureGeneric');
    } catch (error) {
      console.error("Error checking content policy with Gemini:", error);
      return t('adminUsers_error_aiFeatureGeneric');
    }
  };

  const generateUserActivityAnalysisWithGemini = async (): Promise<string[] | string> => {
    if (!ai) {
      return t('customerNewDemand_error_aiUnavailable');
    }
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const prompt = `For an admin of an online timber marketplace, generate an analysis of user activities. Identify examples in the following categories, in ${promptLang}, as a list. Separate each category and use example usernames or IDs.

Categories:
1. ${t('adminUsers_activityAnalysis_topActive')} [Example of most active users and their activities]
2. ${t('adminUsers_activityAnalysis_inactive')} [Example of inactive users and their last activity]
3. ${t('adminUsers_activityAnalysis_unusualSearch')} [Example of unusual searches, possibly by IP address or search keywords]
4. ${t('adminUsers_activityAnalysis_potentialMisuse')} [Example of suspicious activities, e.g., multiple accounts, sudden large volume of low-priced listings]

The response should only contain the list, with each item on a new line, starting with the category name if possible, or clearly separating the categories. No extra text or markdown outside the list itself.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      const rawText = response.text;
      const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      return lines.length > 0 ? lines : t('adminUsers_error_failedToParseAnalysis');
    } catch (error) {
      console.error("Error generating user activity analysis with Gemini:", error);
      return t('adminUsers_error_activityAnalysisGeneric');
    }
  };


  const handleAiFeatureClick = async (
    featureKey: Extract<keyof AdminUsersState, 'communicationDraft' | 'contentPolicyResult' | 'userActivityAnalysisResult'>,
    aiFeatureOperationKey: string 
  ) => {
    setIsLoadingAi(prev => ({ ...prev, [aiFeatureOperationKey]: true }));
    // Clear previous results for this specific feature key only
    setState(prev => ({ 
        ...prev, 
        communicationDraft: featureKey === 'communicationDraft' ? undefined : prev.communicationDraft,
        contentPolicyResult: featureKey === 'contentPolicyResult' ? undefined : prev.contentPolicyResult,
        userActivityAnalysisResult: featureKey === 'userActivityAnalysisResult' ? undefined : prev.userActivityAnalysisResult,
        currentAiFeatureKey: aiFeatureOperationKey 
    }));
    
    let result;
    try {
        if (featureKey === 'communicationDraft') {
            result = await generateCommunicationDraftWithGemini();
        } else if (featureKey === 'contentPolicyResult') {
            result = await checkContentPolicyWithGemini();
        } else if (featureKey === 'userActivityAnalysisResult') {
            result = await generateUserActivityAnalysisWithGemini();
        }
        setState(prev => ({ ...prev, [featureKey]: result }));
    } catch (error) { 
        console.error(`Error in AI feature ${featureKey}:`, error);
        setState(prev => ({ ...prev, [featureKey]: t('adminUsers_error_aiFeatureGeneric') }));
    } finally {
        setIsLoadingAi(prev => ({ ...prev, [aiFeatureOperationKey]: false }));
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setState(prev => ({ ...prev, [name]: value }));
  };

  const handleCompanyActionFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setState(prev => ({ ...prev, companyActionFormData: { ...prev.companyActionFormData, [name]: value } }));
  };
  
  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.newCompanyName || !state.newCompanyRole) {
      alert(t('adminUsers_error_formIncomplete'));
      return;
    }
    if (state.mockCompanies.find(c => c.companyName.toLowerCase() === state.newCompanyName.toLowerCase())) {
        alert(t('adminUsers_error_companyNameExists'));
        return;
    }

    const newCompany: MockCompany = {
      id: `comp-${Date.now()}`,
      companyName: state.newCompanyName,
      role: state.newCompanyRole as UserRole.CUSTOMER | UserRole.MANUFACTURER, 
      address: {
        street: state.newCompanyStreet,
        city: state.newCompanyCity,
        zipCode: state.newCompanyZipCode,
        country: state.newCompanyCountry,
      }
    };
    const updatedCompanies = [...state.mockCompanies, newCompany];
    setState(prev => ({ 
        ...prev, 
        mockCompanies: updatedCompanies, 
        newCompanyName: '', 
        newCompanyRole: '',
        newCompanyStreet: '',
        newCompanyCity: '',
        newCompanyZipCode: '',
        newCompanyCountry: '',
    }));
    saveMockCompanies(updatedCompanies);
    alert(t('adminUsers_companyAddedSuccess', { companyName: newCompany.companyName }));
  };

  const openCompanyActionForm = (company: MockCompany, type: 'demand' | 'stock') => {
    setState(prev => ({
      ...prev,
      showCompanyActionForm: type,
      selectedCompanyForAction: company,
      companyActionFormData: { ...initialCompanyActionFormData },
    }));
  };

  const handleCompanyActionFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.selectedCompanyForAction || !state.showCompanyActionForm) return;

    const { diameterType, diameterFrom, diameterTo, length, quantity } = state.companyActionFormData;
    if (!diameterType || !diameterFrom || !diameterTo || !length || !quantity) {
      alert(t('adminUsers_error_formIncomplete'));
      return;
    }
    
    setState(prev => ({...prev, companyActionFormLoading: true}));

    const avgDiameter = (parseFloat(diameterFrom || '0') + parseFloat(diameterTo || '0')) / 2 / 100;
    const len = parseFloat(length || '0');
    const qty = parseInt(quantity || '0');
    const cubicMeters = (Math.PI * Math.pow(avgDiameter / 2, 2) * len * qty) || 0;
    const productName = t('productType_acaciaDebarkedSandedPost');

    if (state.showCompanyActionForm === 'demand') {
      const newDemand: DemandItem = {
        id: `DEM-ADM-${Date.now()}`,
        diameterType: diameterType!,
        diameterFrom: diameterFrom!,
        diameterTo: diameterTo!,
        length: length!,
        quantity: quantity!,
        notes: state.companyActionFormData.notes || `${productName} ${t('adminUsers_demand_submitted_by_admin', { companyName: state.selectedCompanyForAction.companyName })}`,
        cubicMeters: parseFloat(cubicMeters.toFixed(3)),
        status: DemandStatus.RECEIVED,
        submissionDate: new Date().toISOString(),
        submittedByCompanyId: state.selectedCompanyForAction.id,
        submittedByCompanyName: state.selectedCompanyForAction.companyName,
      };
      try {
        const existingDemandsRaw = localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY);
        const existingDemands: DemandItem[] = existingDemandsRaw ? JSON.parse(existingDemandsRaw) : [];
        localStorage.setItem(CUSTOMER_DEMANDS_STORAGE_KEY, JSON.stringify([newDemand, ...existingDemands]));
        alert(t('customerNewDemand_demandSubmittedSuccess', { id: newDemand.id }));
      } catch (err) { console.error("Error saving admin-submitted demand", err); alert(t('error'));}

    } else if (state.showCompanyActionForm === 'stock') {
      const newStock: StockItem = {
        id: `STK-ADM-${Date.now()}`,
        diameterType: diameterType!,
        diameterFrom: diameterFrom!,
        diameterTo: diameterTo!,
        length: length!,
        quantity: quantity!,
        notes: state.companyActionFormData.notes || `${productName} ${t('adminUsers_stock_uploaded_by_admin', { companyName: state.selectedCompanyForAction.companyName })}`,
        price: state.companyActionFormData.price,
        sustainabilityInfo: state.companyActionFormData.sustainabilityInfo,
        cubicMeters: parseFloat(cubicMeters.toFixed(3)),
        status: StockStatus.AVAILABLE,
        uploadDate: new Date().toISOString(),
        uploadedByCompanyId: state.selectedCompanyForAction.id,
        uploadedByCompanyName: state.selectedCompanyForAction.companyName,
      };
      try {
        const existingStockRaw = localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY);
        const existingStock: StockItem[] = existingStockRaw ? JSON.parse(existingStockRaw) : [];
        localStorage.setItem(MANUFACTURER_STOCK_STORAGE_KEY, JSON.stringify([newStock, ...existingStock]));
        alert(t('manufacturerNewStock_stockUploadedSuccess', { id: newStock.id || 'N/A' }));
      } catch (err) { console.error("Error saving admin-submitted stock", err); alert(t('error'));}
    }
    
    setState(prev => ({
        ...prev, 
        showCompanyActionForm: null, 
        selectedCompanyForAction: null, 
        companyActionFormData: {...initialCompanyActionFormData},
        companyActionFormLoading: false,
    }));
  };

  const handleGenerateSimulatedData = () => {
    setState(prev => ({ ...prev, dataGenerationLoading: true, dataGenerationFeedback: null }));

    let currentMockCompanies = [...state.mockCompanies];
    const generatedCompanies: MockCompany[] = [];
    const productName = t('productType_acaciaDebarkedSandedPost'); 

    let customers = currentMockCompanies.filter(c => c.role === UserRole.CUSTOMER);
    let manufacturers = currentMockCompanies.filter(c => c.role === UserRole.MANUFACTURER);

    for (let i = customers.length; i < 2; i++) {
        const newCustomer: MockCompany = { 
            id: `comp-cust-${Date.now()}-${i}`, 
            companyName: `${t('adminUsers_generatedMockCompanyPrefix')} ${t('userRole_CUSTOMER')} ${i+1}`, 
            role: UserRole.CUSTOMER,
            address: { city: `${t('city_sample')} ${i+1}`, country: t('country_sample') }
        };
        generatedCompanies.push(newCustomer);
        customers.push(newCustomer);
    }
    for (let i = manufacturers.length; i < 2; i++) {
        const newMan: MockCompany = { 
            id: `comp-man-${Date.now()}-${i}`, 
            companyName: `${t('adminUsers_generatedMockCompanyPrefix')} ${t('userRole_MANUFACTURER')} ${i+1}`, 
            role: UserRole.MANUFACTURER,
            address: { city: `${t('city_sample')} ${t('userRole_MANUFACTURER')} ${i+1}`, country: t('country_sample') }
        };
        generatedCompanies.push(newMan);
        manufacturers.push(newMan);
    }
    
    if (generatedCompanies.length > 0) {
        currentMockCompanies = [...currentMockCompanies, ...generatedCompanies];
        saveMockCompanies(currentMockCompanies);
        setState(prev => ({...prev, mockCompanies: currentMockCompanies}));
    }

    const generatedDemands: DemandItem[] = [];
    const generatedStockItems: StockItem[] = [];

    customers.forEach(customer => {
        const numDemands = Math.floor(Math.random() * 2) + 2; 
        for (let i = 0; i < numDemands; i++) {
            const dFrom = Math.floor(Math.random() * 11) + 10; 
            const dTo = dFrom + Math.floor(Math.random() * 5); 
            const len = (Math.random() * 3 + 2).toFixed(1); 
            const qtyOptions = [Math.floor(Math.random() * 11) + 10, Math.floor(Math.random() * 81) + 20, Math.floor(Math.random() * 101) + 75]; // Smaller, medium, and larger partial loads
            const qty = qtyOptions[Math.floor(Math.random() * qtyOptions.length)];
            
            const avgDiameter = (dFrom + dTo) / 2 / 100;
            const volume = parseFloat((Math.PI * Math.pow(avgDiameter / 2, 2) * parseFloat(len) * qty).toFixed(3));

            generatedDemands.push({
                id: `DEM-SIM-${customer.id.slice(-4)}-${Date.now() + i}`,
                diameterType: DIAMETER_TYPE_OPTIONS[1].value, 
                diameterFrom: String(dFrom),
                diameterTo: String(dTo),
                length: String(len),
                quantity: String(qty),
                notes: `${t('adminUsers_simulatedDemandNotePrefix')} ${productName}, ${dFrom}-${dTo}cm ${t('diameterType_mid')}, ${len}m ${t('customerNewDemand_length')}.`,
                cubicMeters: volume,
                status: DemandStatus.RECEIVED,
                submissionDate: new Date().toISOString(),
                submittedByCompanyId: customer.id,
                submittedByCompanyName: customer.companyName,
            });
        }
    });

    manufacturers.forEach(manufacturer => {
        const numStock = Math.floor(Math.random() * 2) + 2; 
        for (let i = 0; i < numStock; i++) {
            const dFrom = Math.floor(Math.random() * 11) + 10;
            const dTo = dFrom + Math.floor(Math.random() * 5);
            const len = (Math.random() * 3 + 2).toFixed(1);
            const qtyOptions = [Math.floor(Math.random() * 31) + 20, Math.floor(Math.random() * 101) + 50, Math.floor(Math.random() * 151) + 100];
            const qty = qtyOptions[Math.floor(Math.random() * qtyOptions.length)];
            const price = `${(Math.random() * 15 + 8).toFixed(2)} EUR/db`; 
            const avgDiameter = (dFrom + dTo) / 2 / 100;
            const volume = parseFloat((Math.PI * Math.pow(avgDiameter / 2, 2) * parseFloat(len) * qty).toFixed(3));

            generatedStockItems.push({
                id: `STK-SIM-${manufacturer.id.slice(-4)}-${Date.now() + i}`,
                diameterType: DIAMETER_TYPE_OPTIONS[1].value, 
                diameterFrom: String(dFrom),
                diameterTo: String(dTo),
                length: String(len),
                quantity: String(qty),
                price: price,
                sustainabilityInfo: `${t('adminUsers_simulatedSustainabilityInfoPrefix')} PEFC ${t('adminUsers_simulatedSustainabilityInfoSuffix')}.`,
                notes: `${t('adminUsers_simulatedStockNotePrefix')} ${productName}, ${dFrom}-${dTo}cm ${t('diameterType_mid')}, ${len}m ${t('customerNewDemand_length')}. ${t('adminUsers_simulatedStockQuality')}.`,
                cubicMeters: volume,
                status: StockStatus.AVAILABLE,
                uploadDate: new Date().toISOString(),
                uploadedByCompanyId: manufacturer.id,
                uploadedByCompanyName: manufacturer.companyName,
            });
        }
    });

    try {
        const existingDemandsRaw = localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY);
        const existingDemands: DemandItem[] = existingDemandsRaw ? JSON.parse(existingDemandsRaw) : [];
        localStorage.setItem(CUSTOMER_DEMANDS_STORAGE_KEY, JSON.stringify([...generatedDemands, ...existingDemands]));

        const existingStockRaw = localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY);
        const existingStock: StockItem[] = existingStockRaw ? JSON.parse(existingStockRaw) : [];
        localStorage.setItem(MANUFACTURER_STOCK_STORAGE_KEY, JSON.stringify([...generatedStockItems, ...existingStock]));
        
        setState(prev => ({ 
            ...prev, 
            dataGenerationLoading: false, 
            dataGenerationFeedback: t('adminUsers_dataGenerationSuccess_specific', { 
                demandCount: generatedDemands.length, 
                stockCount: generatedStockItems.length,
                companyCount: customers.length + manufacturers.length,
                productName: productName
            })
        }));
    } catch (error) {
        console.error("Error saving simulated data:", error);
        setState(prev => ({ ...prev, dataGenerationLoading: false, dataGenerationFeedback: t('adminUsers_dataGenerationFailure') }));
    }
  };
  
  const recipientTypeOptions = RECIPIENT_TYPE_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) }));
  const companyRoleOptions = [
    { value: UserRole.CUSTOMER, label: t('adminUsers_user_customer') }, 
    { value: UserRole.MANUFACTURER, label: t('adminUsers_user_manufacturer') },
  ];
  const diameterTypeOptions = DIAMETER_TYPE_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) }));

  const currentFormTitle = state.showCompanyActionForm === 'demand' 
    ? t('adminUsers_newDemandFor', { companyName: state.selectedCompanyForAction?.companyName || '' })
    : state.showCompanyActionForm === 'stock'
    ? t('adminUsers_newStockFor', { companyName: state.selectedCompanyForAction?.companyName || '' })
    : '';
  
  const isAnyAiLoading = Object.values(isLoadingAi).some(s => s);

  return (
    <>
      <PageTitle title={t('adminUsers_title')} subtitle={t('adminUsers_subtitle')} icon={<UsersIcon className="h-8 w-8"/>}/>
      
      {state.showCompanyActionForm && state.selectedCompanyForAction && (
         <Card title={currentFormTitle} className="mb-6 bg-slate-700/50">
           <form onSubmit={handleCompanyActionFormSubmit} className="space-y-4">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label={t('customerNewDemand_diameterType')} name="diameterType" options={diameterTypeOptions} value={state.companyActionFormData.diameterType || ''} onChange={handleCompanyActionFormInputChange} required />
                <div></div>
                <Input label={t('customerNewDemand_diameterFrom')} name="diameterFrom" type="number" step="0.1" min="0" value={state.companyActionFormData.diameterFrom || ''} onChange={handleCompanyActionFormInputChange} required />
                <Input label={t('customerNewDemand_diameterTo')} name="diameterTo" type="number" step="0.1" min="0" value={state.companyActionFormData.diameterTo || ''} onChange={handleCompanyActionFormInputChange} required />
                <Input label={t('customerNewDemand_length')} name="length" type="number" step="0.1" min="0" value={state.companyActionFormData.length || ''} onChange={handleCompanyActionFormInputChange} required />
                <Input label={t('customerNewDemand_quantity')} name="quantity" type="number" min="1" value={state.companyActionFormData.quantity || ''} onChange={handleCompanyActionFormInputChange} required />
                {state.showCompanyActionForm === 'stock' && (
                  <Input label={`${t('manufacturerMyStock_price')}`} name="price" value={state.companyActionFormData.price || ''} onChange={handleCompanyActionFormInputChange} placeholder={t('adminUsers_form_stockPricePlaceholder')} />
                )}
             </div>
             <Textarea label={t('notes')} name="notes" value={state.companyActionFormData.notes || ''} onChange={handleCompanyActionFormInputChange} rows={3} placeholder={state.showCompanyActionForm === 'demand' ? t('adminUsers_form_demandNotePlaceholder') : t('adminUsers_form_stockNotePlaceholder')} />
             {state.showCompanyActionForm === 'stock' && (
                <Textarea label={t('manufacturerNewStock_sustainabilityInfo')} name="sustainabilityInfo" value={state.companyActionFormData.sustainabilityInfo || ''} onChange={handleCompanyActionFormInputChange} rows={3} placeholder={t('manufacturerNewStock_sustainabilityPlaceholder')}/>
             )}
             <div className="flex justify-end space-x-3">
                <Button type="button" variant="secondary" onClick={() => setState(prev => ({...prev, showCompanyActionForm: null, selectedCompanyForAction: null}))} disabled={state.companyActionFormLoading}>
                    {t('cancel')}
                </Button>
                <Button type="submit" variant="primary" isLoading={state.companyActionFormLoading}>
                    {t('submit')}
                </Button>
             </div>
           </form>
         </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card title={t('adminUsers_manageCompanies')} className="lg:col-span-1">
            <form onSubmit={handleAddCompany} className="space-y-4 mb-6 p-1 border-b border-slate-700 pb-4">
                <h3 className="text-md font-semibold text-cyan-300">{t('adminUsers_addNewCompany')}</h3>
                <Input label={t('adminUsers_companyName')} name="newCompanyName" value={state.newCompanyName} onChange={handleInputChange} placeholder={t('adminUsers_form_companyNamePlaceholder')} required />
                <Input label={t('adminUsers_companyStreet')} name="newCompanyStreet" value={state.newCompanyStreet} onChange={handleInputChange} placeholder={t('adminUsers_form_companyStreetPlaceholder')} />
                <div className="grid grid-cols-2 gap-4">
                    <Input label={t('adminUsers_companyCity')} name="newCompanyCity" value={state.newCompanyCity} onChange={handleInputChange} placeholder={t('adminUsers_form_companyCityPlaceholder')} />
                    <Input label={t('adminUsers_companyZipCode')} name="newCompanyZipCode" value={state.newCompanyZipCode} onChange={handleInputChange} placeholder={t('adminUsers_form_companyZipCodePlaceholder')} />
                </div>
                <Input label={t('adminUsers_companyCountry')} name="newCompanyCountry" value={state.newCompanyCountry} onChange={handleInputChange} placeholder={t('adminUsers_form_companyCountryPlaceholder')} />
                <Select label={t('adminUsers_role')} name="newCompanyRole" options={companyRoleOptions} value={state.newCompanyRole} onChange={handleInputChange} required />
                <Button type="submit" leftIcon={<PlusCircleIcon className="h-5 w-5"/>} className="w-full">
                    {t('adminUsers_addCompanyButton')}
                </Button>
            </form>

            <h3 className="text-md font-semibold text-cyan-300 mb-2">{t('adminUsers_registeredCompanies')}</h3>
            {state.mockCompanies.length === 0 ? (
                <p className="text-sm text-slate-400">{t('adminUsers_noCompanies')}</p>
            ) : (
                <ul className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {state.mockCompanies.map(company => (
                        <li key={company.id} className="p-3 bg-slate-700/70 rounded-md">
                            <div className="flex justify-between items-start">
                                <span className="font-medium text-slate-100">{company.companyName}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-600 text-white">{getTranslatedUserRole(company.role, t)}</span>
                            </div>
                            {company.address && (company.address.city || company.address.country) && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {company.address.street && `${company.address.street}, `}
                                    {company.address.zipCode && `${company.address.zipCode} `}
                                    {company.address.city && `${company.address.city}, `}
                                    {company.address.country}
                                </p>
                            )}
                            <div className="mt-2 flex space-x-2">
                                {company.role === UserRole.CUSTOMER && ( 
                                    <Button size="sm" variant="ghost" onClick={() => openCompanyActionForm(company, 'demand')} className="flex-1">
                                        {t('adminUsers_submitDemandForCompany')}
                                    </Button>
                                )}
                                {company.role === UserRole.MANUFACTURER && (
                                    <Button size="sm" variant="ghost" onClick={() => openCompanyActionForm(company, 'stock')} className="flex-1">
                                        {t('adminUsers_uploadStockForCompany')}
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Card>

        <Card title={t('adminUsers_aiCommunicationAssistant')} className="lg:col-span-1">
          <Select
            label={t('adminUsers_recipientTypeLabel')}
            name="recipientType"
            options={recipientTypeOptions}
            value={state.recipientType || ''}
            onChange={handleInputChange}
          />
          <Textarea
            label={t('adminUsers_scenarioLabel')}
            name="scenario"
            value={state.scenario || ''}
            onChange={handleInputChange}
            rows={3}
            placeholder={t('adminUsers_scenarioPlaceholder')}
          />
          <AiFeatureButton
            text={t('adminUsers_generateMessageDraft')}
            onClick={() => handleAiFeatureClick('communicationDraft', 'communicationDraftOp')}
            isLoading={isLoadingAi.communicationDraftOp}
            disabled={!ai || !state.recipientType || !state.scenario || isAnyAiLoading}
            leftIcon={<ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-blue-400" />}
          />
          {isLoadingAi.communicationDraftOp && state.currentAiFeatureKey === 'communicationDraftOp' && <LoadingSpinner text={t('adminUsers_generatingDraft')} />}
          {state.communicationDraft && !isLoadingAi.communicationDraftOp && state.currentAiFeatureKey === 'communicationDraftOp' && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded">
              <h5 className="font-semibold text-cyan-400 mb-1">{t('adminUsers_generatedDraft')}</h5>
              <pre className="text-sm text-slate-200 whitespace-pre-wrap">{state.communicationDraft}</pre>
            </div>
          )}
        </Card>

        <Card title={t('adminUsers_aiContentPolicyChecker')} className="lg:col-span-1">
          <Textarea
            label={t('adminUsers_textToCheckLabel')}
            name="contentToCheck"
            value={state.contentToCheck || ''}
            onChange={handleInputChange}
            rows={5}
            placeholder={t('adminUsers_textToCheckPlaceholder')}
          />
          <AiFeatureButton
            text={t('adminUsers_checkContent')}
            onClick={() => handleAiFeatureClick('contentPolicyResult', 'contentPolicyOp')}
            isLoading={isLoadingAi.contentPolicyOp}
            disabled={!ai || !state.contentToCheck || isAnyAiLoading}
            leftIcon={<ShieldCheckIcon className="h-5 w-5 text-green-400" />}
          />
          {isLoadingAi.contentPolicyOp && state.currentAiFeatureKey === 'contentPolicyOp' && <LoadingSpinner text={t('adminUsers_checkingContent')} />}
          {state.contentPolicyResult && !isLoadingAi.contentPolicyOp && state.currentAiFeatureKey === 'contentPolicyOp' && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded">
              <h5 className="font-semibold text-cyan-400 mb-1">{t('adminUsers_checkResult')}</h5>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{state.contentPolicyResult}</p>
            </div>
          )}
        </Card>

        <Card title={t('adminUsers_generateSimulatedData')} className="lg:col-span-full mt-6">
            <p className="text-sm text-slate-300 mb-3">{t('adminUsers_generateSimulatedDataDescriptionSpecific', {productName: t('productType_acaciaDebarkedSandedPost')})}</p>
            <Button
                onClick={handleGenerateSimulatedData}
                isLoading={state.dataGenerationLoading}
                leftIcon={<BeakerIcon className="h-5 w-5" />}
                className="w-full"
            >
                {t('adminUsers_generateAcaciaDataButton', {productName: t('productType_acaciaDebarkedSandedPost')})}
            </Button>
            {state.dataGenerationLoading && <LoadingSpinner text={t('adminUsers_dataGenerationInProgress')} />}
            {state.dataGenerationFeedback && !state.dataGenerationLoading && (
                <div className={`mt-4 p-3 rounded text-sm ${state.dataGenerationFeedback.includes(t('error')) || state.dataGenerationFeedback.includes(t('adminUsers_dataGenerationFailure')) ? 'bg-red-800/80 text-red-200' : 'bg-green-800/80 text-green-200'}`}>
                    {state.dataGenerationFeedback}
                </div>
            )}
        </Card>
        
        <Card title={t('adminUsers_aiUserActivityAnalyzer')} className="lg:col-span-full mt-6">
            <p className="text-sm text-slate-300 mb-3">{t('adminUsers_analyzerDescription')}</p>
            <AiFeatureButton
                text={t('adminUsers_analyzeActivity')}
                onClick={() => handleAiFeatureClick('userActivityAnalysisResult', 'userActivityOp')}
                isLoading={isLoadingAi.userActivityOp}
                disabled={!ai || isAnyAiLoading}
                leftIcon={<UserGroupIcon className="h-5 w-5 text-purple-400" />}
            />
            {isLoadingAi.userActivityOp && state.currentAiFeatureKey === 'userActivityOp' && <LoadingSpinner text={t('adminUsers_analyzingActivity')} />}
            {state.userActivityAnalysisResult && !isLoadingAi.userActivityOp && state.currentAiFeatureKey === 'userActivityOp' && (
                <div className="mt-4 p-3 bg-slate-700/50 rounded max-h-96 overflow-y-auto pr-2">
                    <h5 className="font-semibold text-cyan-400 mb-2">{t('adminUsers_analysisResult')}</h5>
                    {typeof state.userActivityAnalysisResult === 'string' ? (
                        <p className="text-sm text-slate-200 whitespace-pre-wrap">{state.userActivityAnalysisResult}</p>
                    ) : (
                        <ul className="space-y-2">
                            {state.userActivityAnalysisResult.map((item, index) => (
                                <li key={index} className="text-sm text-slate-200 whitespace-pre-wrap">
                                  {item.match(new RegExp(`^(${t('adminUsers_activityAnalysis_topActive')}|${t('adminUsers_activityAnalysis_inactive')}|${t('adminUsers_activityAnalysis_unusualSearch')}|${t('adminUsers_activityAnalysis_potentialMisuse')})`, 'i')) 
                                    ? <strong className="text-cyan-300 block mt-1">{item}</strong> 
                                    : <span className="ml-2">{item}</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </Card>
      </div>
    </>
  );
};

export default AdminUsersPage;
