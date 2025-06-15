
import React, { useState } from 'react';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import AiFeatureButton from '../../components/AiFeatureButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import VisualTruckLoad from '../../components/VisualTruckLoad'; 
import SimulatedRouteMap from '../../components/SimulatedRouteMap'; 
import { 
  LoadingPlan, 
  CostEstimation, 
  OptimizationTip, 
  LoadingPlanResponse, 
  CostEstimationResponse, 
  LoadingPlanItem,
  Waypoint 
} from '../../types';
import { TruckIcon, CurrencyEuroIcon, CogIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { useLocale } from '../../LocaleContext';

let ai: GoogleGenAI | null = null;
try {
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } else {
    console.warn("API_KEY environment variable is not set for AdminTruckPlanningPage. Real AI features will be limited.");
  }
} catch (error) {
  console.error("Error initializing GoogleGenAI for AdminTruckPlanningPage:", error);
}

interface AdminTruckPlanningState {
  loadingPlan?: LoadingPlan | string;
  costEstimation?: CostEstimation | string;
  freightOptimizationTips?: OptimizationTip[] | string;
  currentAiFeatureKey?: string; // To track active AI feature operation
}

const AdminTruckPlanningPage: React.FC = () => {
  const { t, locale } = useLocale();
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<AdminTruckPlanningState>({});

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
      return t('adminTruckPlanning_error_parsing_truck', { featureName: t(featureNameKey as any), rawResponse: text.substring(0,300) });
    }
  };

  const generateOptimalLoadingPlanWithGemini = async (): Promise<LoadingPlan | string> => {
    if (!ai) return t('adminTruckPlanning_error_aiUnavailable_truck');
    const productNameKey = 'productType_acaciaDebarkedSandedPost';
    const productName = t(productNameKey);
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';

    const prompt = `An admin of a timber company requests an optimal loading and transport plan for a 25m³ (approx. 24-ton, 13.5m flatbed) truck in ${promptLang}.
The product to be transported is exclusively "${productName}". This is a specialized timber product, potentially sourced from specific manufacturers and delivered to distinct project sites or demanding customers.
Products are transported in "crates" of approx. 1.2m x 1.2m base. The height of a crate and the number of posts in it depend on the product's length and diameter (e.g., 4m long, 14-18cm mid-diameter posts, about 25 pcs fit in a crate, so 175 pcs means approx. 7 crates).
The transport task involves consolidating partial orders from multiple (simulate 2-3) "Customers" onto one truck and delivering them.
The required quantities may need to be picked up from multiple (simulate 2-3) different "Manufacturers".
Generate simulated, realistic company names for Manufacturers and Customers (e.g., "Forest King Timber Kft.", "ProBuild Construction Zrt.").

The response MUST be in JSON format, in ${promptLang}, and include the following fields:
- "planDetails": string (brief description, e.g., "Optimized multi-pickup and multi-drop loading plan for ${productName} in crates, for a 25m³ truck.")
- "items": LoadingPlanItem[] (array of loaded items, where each object represents a group of crates or a single crate for a specific Customer loaded onto the truck. Each LoadingPlanItem object MUST include:
    - "name": string (e.g., "${productName} - for Customer X Ltd., 3 crates")
    - "volumeM3": string (total volume of this customer's crates, e.g., "8" or "8 m³")
    - "destinationName": string (Customer/drop-off location name, e.g., "Customer X Ltd. warehouse")
    - "dropOffOrder": number (drop-off sequence, e.g., 1 for the first to be dropped off)
    - "loadingSuggestion": string (a full, coherent textual suggestion in ${promptLang} for loading these crates, considering LIFO for that drop-off, e.g., "Place these crates closest to the truck door as they will be unloaded first.")
    - "quality": string (optional, e.g., "Debarked, sanded, Prima A")
    - "notesOnItem": string (optional, e.g., "3 crates, total 75 pcs 4m 14-18cm posts")
  )
- "capacityUsed": string (truck capacity utilization in percentage, e.g., "92%")
- "waypoints": Waypoint[] (an array containing all pickup locations (at Manufacturers) and all drop-off locations (at Customers) in the correct logistical sequence. Each Waypoint object MUST include:
    - "name": string (Manufacturer or Customer company name and site, e.g., "Manufacturer Big Timber Inc. - Loading Yard" or "Customer X Ltd. - Central Warehouse")
    - "type": "'pickup'" | "'dropoff'" (type of stop, ensure quotes are present in the JSON string value)
    - "order": number (sequence in the route, e.g., 0, 1 for pickups, 2, 3, 4 for drop-offs)
  )
- "optimizedRouteDescription": string (a short textual description of the optimized route in ${promptLang}, considering multiple pickup and drop-off locations, e.g., "The route starts from Manufacturer A, then visits Manufacturer B pickup. Subsequently, Customer X, Customer Y, and finally Customer Z drop-off locations follow in logical order.")

CRITICAL: The response must ONLY contain the JSON object described above. No other text, explanations, or markdown formatting (like \`\`\`) is allowed OUTSIDE the JSON object. The JSON must be perfectly valid. Strings within the JSON must have quotes and newlines properly escaped.
It is CRITICAL that the 'items' field is an array of fully populated 'LoadingPlanItem' objects and the 'waypoints' field is an array of 'Waypoint' objects. These structures are directly used for visualization in the user interface, so their correctness and completeness are paramount.
In the "items" array, each element represents the entire shipment for a specific Customer and includes all specified fields.
The "waypoints" array must list all pickup and drop-off locations in the correct operational order.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const parsed = parseJsonFromGeminiResponse<LoadingPlanResponse>(response.text, "adminTruckPlanning_optimalLoadingPlan");
      if (typeof parsed === 'string') return parsed;
      return { ...parsed, id: `gemini-multidrop-${Date.now()}` };
    } catch (error) {
      console.error("Error generating multi-drop loading plan with Gemini:", error);
      return t('adminTruckPlanning_error_planGeneric');
    }
  };


  const estimateLogisticsCostWithGemini = async (): Promise<CostEstimation | string> => {
    if (!ai) return t('adminTruckPlanning_error_aiUnavailable_truck');
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const prompt = `An admin of a timber company requests a logistics cost estimation for an approx. 300 km domestic transport within Hungary, for a full truckload (24 tons) of spruce logs. 
Provide an estimation in JSON format, in ${promptLang}, in EUR, with the following fields: "totalCost" (the total estimated cost, e.g., "450-550 EUR"), "factors" (an array of main cost factors, e.g., ["Fuel price", "Road tolls", "Driver's wages", "Loading time", "Administrative costs"]).
Important: The response should only contain the JSON object, without any extra text or markdown.`;
    
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const parsed = parseJsonFromGeminiResponse<CostEstimationResponse>(response.text, "adminTruckPlanning_logisticsCostEstimation");
      if (typeof parsed === 'string') return parsed;
      return { ...parsed, id: `gemini-cost-${Date.now()}` };
    } catch (error) {
      console.error("Error estimating logistics cost with Gemini:", error);
      return t('adminTruckPlanning_error_costGeneric');
    }
  };

  const generateFreightOptimizationTipsWithGemini = async (): Promise<OptimizationTip[] | string> => {
    if (!ai) return t('adminTruckPlanning_error_aiUnavailable_truck');
    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const prompt = `An admin of a timber company requests freight optimization tips. Provide at least 3-5 specific, practical tips in ${promptLang} for optimizing timber transport. The tips should be in a list, each tip on a new line, prefixed with '- ' (hyphen and space). The response should contain nothing else.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      const rawText = response.text;
      const tips = rawText.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- '))
        .map(line => line.substring(2).trim())
        .filter(tip => tip.length > 0)
        .map((tip, index) => ({ id: `gemini-fopt-${index}`, tip }));
      
      return tips.length > 0 ? tips : t('adminTruckPlanning_error_failedToParseTipsGeneric');
    } catch (error) {
      console.error("Error generating freight optimization tips with Gemini:", error);
      return t('adminTruckPlanning_error_tipsGeneric');
    }
  };

  const handleAiFeatureClick = async (
    featureKey: keyof AdminTruckPlanningState,
    aiOperationKey: string 
  ) => {
    setIsLoading(prev => ({ ...prev, [aiOperationKey]: true }));
    setState(prev => ({ 
      ...prev, 
      loadingPlan: featureKey === 'loadingPlan' ? undefined : prev.loadingPlan,
      costEstimation: featureKey === 'costEstimation' ? undefined : prev.costEstimation,
      freightOptimizationTips: featureKey === 'freightOptimizationTips' ? undefined : prev.freightOptimizationTips,
      currentAiFeatureKey: aiOperationKey 
    })); 

    let result;
    try {
        if (featureKey === 'loadingPlan') {
            result = await generateOptimalLoadingPlanWithGemini();
        } else if (featureKey === 'costEstimation') {
            result = await estimateLogisticsCostWithGemini();
        } else if (featureKey === 'freightOptimizationTips') {
            result = await generateFreightOptimizationTipsWithGemini();
        }
      setState(prev => ({ ...prev, [featureKey]: result }));
    } catch (error) {
        console.error(`Error in AI feature ${featureKey}:`, error);
        setState(prev => ({ ...prev, [featureKey]: t('adminTruckPlanning_error_critical_truck', {featureName: t(aiOperationKey as any) || featureKey}) }));
    } finally {
        setIsLoading(prev => ({ ...prev, [aiOperationKey]: false }));
    }
  };
  
  const isAnyLoading = Object.values(isLoading).some(s => s);

  const renderLoadingPlanResult = (plan: LoadingPlan | string) => {
    if (typeof plan === 'string') {
      return <p className="text-sm text-red-400 whitespace-pre-wrap">{plan}</p>;
    }
    if (!plan || !plan.planDetails) return null;

    return (
      <>
        <h5 className="font-semibold text-cyan-300 mb-1">{t('adminTruckPlanning_aiSuggestionLoadingPlan', {id: plan.id?.substring(0,16) || 'N/A'})}</h5>
        <p className="text-sm text-slate-200"><strong>{t('adminTruckPlanning_planDetails')}</strong> {plan.planDetails}</p>
        
        {plan.items && Array.isArray(plan.items) && plan.items.length > 0 && typeof plan.items[0] === 'object' &&
          <div className="my-4">
            <VisualTruckLoad items={plan.items as LoadingPlanItem[]} planDetails={plan.planDetails} />
          </div>
        }

        {plan.waypoints && plan.waypoints.length > 0 &&
            <div className="my-4">
                <SimulatedRouteMap waypoints={plan.waypoints} optimizedRouteDescription={plan.optimizedRouteDescription} />
            </div>
        }
        
        {typeof plan.items === 'string' ? (
          <p className="text-sm text-slate-200"><strong>{t('adminTruckPlanning_planItems')}</strong> {plan.items}</p>
        ) : Array.isArray(plan.items) && plan.items.length > 0 ? (
           (plan.items as Array<any>).every(item => typeof item === 'object' && item !== null && 'name' in item) ? (
              <div>
                  <h6 className="text-sm font-semibold text-slate-100 mt-2">{t('adminTruckPlanning_planItems')}</h6>
                  <ul className="space-y-2 mt-1 max-h-60 overflow-y-auto pr-2">
                      {(plan.items as LoadingPlanItem[]).map((item, index) => (
                          <li key={index} className="p-2 bg-slate-600/50 rounded">
                              <span className="font-medium text-cyan-400 block">{item.name}</span>
                              {item.quality && <span className="text-xs text-slate-300 block">{t('adminTruckPlanning_planItemQuality')}: {item.quality}</span>}
                              {item.volumeM3 && <span className="text-xs text-slate-300 block">{t('adminTruckPlanning_planItemVolume')}: {item.volumeM3}</span>}
                              {item.destinationName && <span className="text-xs text-slate-300 block">{t('adminTruckPlanning_visualTruck_destination')}: {item.destinationName}</span>}
                              {item.dropOffOrder !== undefined && <span className="text-xs text-slate-300 block">{t('adminTruckPlanning_visualTruck_dropOrder')}: {item.dropOffOrder}</span>}
                              {item.notesOnItem && <span className="text-xs text-slate-300 block">{t('notes')}: {item.notesOnItem}</span>}
                              {item.loadingSuggestion && <p className="text-xs text-slate-300 mt-1 italic">{t('adminTruckPlanning_planItemLoadingSuggestion')}: {item.loadingSuggestion}</p>}
                          </li>
                      ))}
                  </ul>
              </div>
          ) : (plan.items as Array<any>).every(item => typeof item === 'string') ? (
              <div>
                  <h6 className="text-sm font-semibold text-slate-100 mt-2">{t('adminTruckPlanning_planItems')}</h6>
                  <ul className="list-disc list-inside text-sm text-slate-300 pl-1 space-y-1">
                      {(plan.items as string[]).map((item, index) => (
                          <li key={index}>{item}</li>
                      ))}
                  </ul>
              </div>
          ) : (
              <p className="text-sm text-slate-200"><strong>{t('adminTruckPlanning_planItems')}</strong> {t('adminTruckPlanning_unknownResultType')}</p>
          )
        ) : (
            <p className="text-sm text-slate-200"><strong>{t('adminTruckPlanning_planItems')}</strong> N/A</p>
        )}
        <p className="text-sm text-slate-200 mt-2"><strong>{t('adminTruckPlanning_planCapacityUsed')}</strong> {plan.capacityUsed}</p>
      </>
    );
  };

  const renderCostEstimationResult = (estimation: CostEstimation | string) => {
    if (typeof estimation === 'string') {
      return <p className="text-sm text-red-400 whitespace-pre-wrap">{estimation}</p>;
    }
    if (!estimation || !estimation.totalCost) return null;
    return (
      <>
        <h5 className="font-semibold text-cyan-300 mb-1">{t('adminTruckPlanning_aiSuggestionCostEstimation', {id: estimation.id?.substring(0,15) || 'N/A'})}</h5>
        <p className="text-xl font-bold text-white">{estimation.totalCost}</p>
        <p className="text-xs text-slate-400 mt-1">{t('adminTruckPlanning_influencingFactors')}</p>
        <ul className="list-disc list-inside text-xs text-slate-300">
          {estimation.factors.map((factor, idx) => <li key={idx}>{factor}</li>)}
        </ul>
      </>
    );
  };
  
  const renderFreightOptimizationTipsResult = (tips: OptimizationTip[] | string) => {
    if (typeof tips === 'string') {
       return <p className="text-sm text-red-400 whitespace-pre-wrap">{tips}</p>;
    }
    if (!tips || tips.length === 0) return <p className="text-sm text-slate-300">{t('adminTruckPlanning_noDisplayableTips')}</p>;
    return (
      <>
          <h5 className="font-semibold text-cyan-300 mb-1">{t('adminTruckPlanning_aiSuggestionOptimizationTips')}</h5>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
          {tips.map(tip => (
              <div key={tip.id} className={`p-2 bg-slate-700/50 rounded text-sm ${tip.tip.includes("Hiba") || tip.tip.includes("Error") ? "text-red-300" : "text-slate-200"}`}>
              <CogIcon className={`h-4 w-4 inline mr-2 ${tip.tip.includes("Hiba") || tip.tip.includes("Error") ? "text-red-400" : "text-yellow-400"}`}/>{tip.tip}
              </div>
          ))}
          </div>
      </>
    );
  };


  return (
    <>
      <PageTitle title={t('adminTruckPlanning_title')} subtitle={t('adminTruckPlanning_subtitle')} icon={<TruckIcon className="h-8 w-8"/>}/>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card title={t('adminTruckPlanning_optimalLoadingPlan')}>
          <p className="text-sm text-slate-300 mb-3">{t('adminTruckPlanning_optimalLoadingPlanDescription', { productName: t('productType_acaciaDebarkedSandedPost') })}</p>
          <AiFeatureButton
            text={t('adminTruckPlanning_requestMultiDropPlan', { productName: t('productType_acaciaDebarkedSandedPost') })} 
            onClick={() => handleAiFeatureClick('loadingPlan', 'loadingPlanOp')}
            isLoading={isLoading.loadingPlanOp}
            disabled={!ai || isAnyLoading}
            leftIcon={<ArrowPathIcon className="h-5 w-5"/>}
          />
          {isLoading.loadingPlanOp && state.currentAiFeatureKey === 'loadingPlanOp' && <LoadingSpinner text={t('adminTruckPlanning_generatingPlan')} />}
          {state.loadingPlan && !isLoading.loadingPlanOp && state.currentAiFeatureKey === 'loadingPlanOp' && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded">
              {renderLoadingPlanResult(state.loadingPlan)}
            </div>
          )}
        </Card>

        <Card title={t('adminTruckPlanning_logisticsCostEstimation')}>
          <p className="text-sm text-slate-300 mb-3">{t('adminTruckPlanning_logisticsCostEstimationDescription')}</p>
          <AiFeatureButton
            text={t('adminTruckPlanning_requestCostEstimation')}
            onClick={() => handleAiFeatureClick('costEstimation', 'costEstimationOp')}
            isLoading={isLoading.costEstimationOp}
            disabled={!ai || isAnyLoading}
            leftIcon={<CurrencyEuroIcon className="h-5 w-5" />}
          />
          {isLoading.costEstimationOp && state.currentAiFeatureKey === 'costEstimationOp' && <LoadingSpinner text={t('adminTruckPlanning_estimatingCost')} />}
          {state.costEstimation && !isLoading.costEstimationOp && state.currentAiFeatureKey === 'costEstimationOp' && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded">
              {renderCostEstimationResult(state.costEstimation)}
            </div>
          )}
        </Card>
        
        <Card title={t('adminTruckPlanning_freightOptimizationTips')}>
            <p className="text-sm text-slate-300 mb-3">{t('adminTruckPlanning_freightOptimizationTipsDescription')}</p>
          <AiFeatureButton
            text={t('adminTruckPlanning_requestOptimizationTips')}
            onClick={() => handleAiFeatureClick('freightOptimizationTips', 'freightOptimizationTipsOp')}
            isLoading={isLoading.freightOptimizationTipsOp}
            disabled={!ai || isAnyLoading}
            leftIcon={<CogIcon className="h-5 w-5" />}
          />
          {isLoading.freightOptimizationTipsOp && state.currentAiFeatureKey === 'freightOptimizationTipsOp' && <LoadingSpinner text={t('adminTruckPlanning_searchingTips')} />}
          {state.freightOptimizationTips && !isLoading.freightOptimizationTipsOp && state.currentAiFeatureKey === 'freightOptimizationTipsOp' && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded">
              {renderFreightOptimizationTipsResult(state.freightOptimizationTips)}
            </div>
          )}
        </Card>
      </div>
    </>
  );
};

export default AdminTruckPlanningPage;
