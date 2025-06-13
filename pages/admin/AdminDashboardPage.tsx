

import React, { useState, useEffect } from 'react';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import Button from '../../components/Button';
import AiFeatureButton from '../../components/AiFeatureButton';
import Input from '../../components/Input';
import Textarea from '../../components/Textarea';
import Select from '../../components/Select';
import LoadingSpinner from '../../components/LoadingSpinner';
import SimpleBarChart from '../../components/SimpleBarChart'; 
import GeminiAssistantWidget from '../../components/GeminiAssistantWidget'; 
import { MOCK_AI_RESPONSES, CUSTOMER_DEMANDS_STORAGE_KEY, MANUFACTURER_STOCK_STORAGE_KEY } from '../../constants';
import { REGION_OPTIONS, PRODUCT_TYPE_FORECAST_OPTIONS, getTranslatedDemandStatus, getTranslatedStockStatus, getTranslatedUserRole } from '../../locales'; 
import { 
  MarketNewsItem, 
  FaqItem, 
  DemandForecast, 
  FeedbackAnalysisData,
  UserActivitySummary,
  ProductPerformanceData,
  SystemHealthStatusItem,
  UserRole,
  DemandStatus, 
  StockStatus,  
  DemandItem,   
  StockItem,    
  OrderStatusSummaryPoint,
  StockStatusSummaryPoint,
  KeyProductPriceTrend,
  TranslationKey,
  MockCompany // For Top Customers/Manufacturers
} from '../../types';
import { 
  ChartBarIcon, 
  NewspaperIcon, 
  QuestionMarkCircleIcon, 
  MagnifyingGlassIcon, 
  ChatBubbleBottomCenterTextIcon, 
  MapIcon, 
  BellAlertIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckCircleIcon,
  UserGroupIcon,
  StarIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClipboardDocumentListIcon,
  ArchiveBoxIcon,
  BanknotesIcon,
  TrophyIcon // For Top Customers/Manufacturers
} from '@heroicons/react/24/outline';
import { useLocale } from '../../LocaleContext';

const MOCK_COMPANIES_STORAGE_KEY = 'pohi-ai-mock-companies';

interface AdminFeatureState {
  marketNews?: MarketNewsItem[];
  marketInfoQuery?: string;
  marketInfoResponse?: string;
  newFeatureDescription?: string;
  generatedFaqForNewFeature?: FaqItem[];
  faqQuery?: string;
  faqAnswer?: string;
  feedbackText?: string;
  feedbackAnalysis?: FeedbackAnalysisData;
  forecastRegion?: string;
  forecastProductType?: string;
  demandForecast?: DemandForecast;
  detectedAnomalies?: string[] | string | null;
  userActivitySummary?: UserActivitySummary;
  topPerformingProducts?: ProductPerformanceData[];
  systemHealthStatuses?: SystemHealthStatusItem[];
  orderStatusSummary?: OrderStatusSummaryPoint[]; 
  stockStatusSummary?: StockStatusSummaryPoint[]; 
  keyProductPriceTrend?: KeyProductPriceTrend;
  totalDemandsCount?: number; 
  totalStockItemsCount?: number; 
  topCustomersByVolume?: { label: string; value: number; color: string }[]; // For new chart
  topManufacturersByVolume?: { label: string; value: number; color: string }[]; // For new chart
}

const AdminDashboardPage: React.FC = () => {
  const { t } = useLocale();
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<AdminFeatureState>({});

  const DemandStatusColorMap: Record<DemandStatus, string> = {
    [DemandStatus.RECEIVED]: 'text-sky-500',
    [DemandStatus.PROCESSING]: 'text-amber-500',
    [DemandStatus.COMPLETED]: 'text-green-500',
    [DemandStatus.CANCELLED]: 'text-red-500',
  };

  const StockStatusColorMap: Record<StockStatus, string> = {
    [StockStatus.AVAILABLE]: 'text-green-600',
    [StockStatus.RESERVED]: 'text-yellow-600',
    [StockStatus.SOLD]: 'text-red-600',
  };

  const loadOrderStatusSummary = (): OrderStatusSummaryPoint[] => {
    const demandsRaw = localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY);
    const demands: DemandItem[] = demandsRaw ? JSON.parse(demandsRaw) : [];
    const counts: Record<DemandStatus, number> = {
      [DemandStatus.RECEIVED]: 0,
      [DemandStatus.PROCESSING]: 0,
      [DemandStatus.COMPLETED]: 0,
      [DemandStatus.CANCELLED]: 0,
    };
    demands.forEach(d => {
      if (counts[d.status] !== undefined) {
        counts[d.status]++;
      }
    });
    const total = demands.length;
    setState(prev => ({...prev, totalDemandsCount: total})); 

    if (total === 0) {
        return Object.keys(counts).map(statusKey => ({
            status: statusKey as DemandStatus,
            count: 0,
            percentage: 0,
            colorClass: DemandStatusColorMap[statusKey as DemandStatus] || 'bg-slate-500' 
        }));
    }
    return [
      { status: DemandStatus.RECEIVED, count: counts[DemandStatus.RECEIVED], percentage: parseFloat(((counts[DemandStatus.RECEIVED]/total)*100).toFixed(1)), colorClass: DemandStatusColorMap[DemandStatus.RECEIVED] },
      { status: DemandStatus.PROCESSING, count: counts[DemandStatus.PROCESSING], percentage: parseFloat(((counts[DemandStatus.PROCESSING]/total)*100).toFixed(1)), colorClass: DemandStatusColorMap[DemandStatus.PROCESSING] },
      { status: DemandStatus.COMPLETED, count: counts[DemandStatus.COMPLETED], percentage: parseFloat(((counts[DemandStatus.COMPLETED]/total)*100).toFixed(1)), colorClass: DemandStatusColorMap[DemandStatus.COMPLETED] },
      { status: DemandStatus.CANCELLED, count: counts[DemandStatus.CANCELLED], percentage: parseFloat(((counts[DemandStatus.CANCELLED]/total)*100).toFixed(1)), colorClass: DemandStatusColorMap[DemandStatus.CANCELLED] },
    ];
  };

  const loadStockStatusSummary = (): StockStatusSummaryPoint[] => {
    const stockRaw = localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY);
    const stockItems: StockItem[] = stockRaw ? JSON.parse(stockRaw) : [];
    const counts: Record<StockStatus, number> = {
      [StockStatus.AVAILABLE]: 0,
      [StockStatus.RESERVED]: 0,
      [StockStatus.SOLD]: 0,
    };
    stockItems.forEach(s => {
      if (s.status && counts[s.status] !== undefined) {
        counts[s.status]++;
      }
    });
    const total = stockItems.length;
     setState(prev => ({...prev, totalStockItemsCount: total})); 

    if (total === 0) {
        return Object.keys(counts).map(statusKey => ({
            status: statusKey as StockStatus,
            count: 0,
            percentage: 0,
            colorClass: StockStatusColorMap[statusKey as StockStatus] || 'bg-slate-500' 
        }));
    }
    return [
      { status: StockStatus.AVAILABLE, count: counts[StockStatus.AVAILABLE], percentage: parseFloat(((counts[StockStatus.AVAILABLE]/total)*100).toFixed(1)), colorClass: StockStatusColorMap[StockStatus.AVAILABLE] },
      { status: StockStatus.RESERVED, count: counts[StockStatus.RESERVED], percentage: parseFloat(((counts[StockStatus.RESERVED]/total)*100).toFixed(1)), colorClass: StockStatusColorMap[StockStatus.RESERVED] },
      { status: StockStatus.SOLD, count: counts[StockStatus.SOLD], percentage: parseFloat(((counts[StockStatus.SOLD]/total)*100).toFixed(1)), colorClass: StockStatusColorMap[StockStatus.SOLD] },
    ];
  };

  const loadTopCompaniesByVolume = (role: UserRole.CUSTOMER | UserRole.MANUFACTURER, topN: number = 5) => {
      const companiesRaw = localStorage.getItem(MOCK_COMPANIES_STORAGE_KEY);
      const allCompanies: MockCompany[] = companiesRaw ? JSON.parse(companiesRaw) : [];
      const relevantCompanies = allCompanies.filter(c => c.role === role);
      
      const itemsRaw = role === UserRole.CUSTOMER 
          ? localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY) 
          : localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY);
      const allItems: (DemandItem[] | StockItem[]) = itemsRaw ? JSON.parse(itemsRaw) : [];

      const companyVolumes: Record<string, number> = {};

      allItems.forEach((item: DemandItem | StockItem) => {
          const companyId = 'submittedByCompanyId' in item ? item.submittedByCompanyId : ('uploadedByCompanyId' in item ? item.uploadedByCompanyId : undefined);
          if (companyId && item.cubicMeters) {
              if (!companyVolumes[companyId]) companyVolumes[companyId] = 0;
              companyVolumes[companyId] += item.cubicMeters;
          }
      });
      
      const sortedCompanies = relevantCompanies
          .map(company => ({
              company,
              totalVolume: companyVolumes[company.id] || 0
          }))
          .filter(cv => cv.totalVolume > 0)
          .sort((a, b) => b.totalVolume - a.totalVolume)
          .slice(0, topN);

      const chartData = sortedCompanies.map((cv, index) => ({
          label: cv.company.companyName.length > 15 ? `${cv.company.companyName.substring(0,12)}...` : cv.company.companyName,
          value: parseFloat(cv.totalVolume.toFixed(2)),
          color: role === UserRole.CUSTOMER ? `text-sky-${700 - index * 100}` : `text-emerald-${700 - index * 100}`
      }));

      if (role === UserRole.CUSTOMER) {
          setState(prev => ({...prev, topCustomersByVolume: chartData}));
      } else {
          setState(prev => ({...prev, topManufacturersByVolume: chartData}));
      }
  };


  const handleAiFeatureClick = (
    featureKey: keyof AdminFeatureState,
    dataGenerator: () => any,
    delay: number = 500 
  ) => {
    setIsLoading(prev => ({ ...prev, [featureKey]: true }));
    setState(prev => ({ ...prev, [featureKey as string]: undefined } as AdminFeatureState));


    setTimeout(() => {
      let result;
      if (featureKey === 'orderStatusSummary') {
        result = loadOrderStatusSummary();
      } else if (featureKey === 'stockStatusSummary') {
        result = loadStockStatusSummary();
      } else if (featureKey === 'topCustomersByVolume') {
        loadTopCompaniesByVolume(UserRole.CUSTOMER); // This updates state directly
        setIsLoading(prev => ({ ...prev, [featureKey]: false }));
        return; 
      } else if (featureKey === 'topManufacturersByVolume') {
        loadTopCompaniesByVolume(UserRole.MANUFACTURER); // This updates state directly
        setIsLoading(prev => ({ ...prev, [featureKey]: false }));
        return;
      }
      else {
        result = dataGenerator();
        if (featureKey === 'marketNews' && Array.isArray(result)) {
            result = result.map((news: MarketNewsItem) => ({
            ...news,
            title: t(news.title as TranslationKey),
            content: t(news.content as TranslationKey),
            }));
        }
        if (featureKey === 'marketInfoResponse' && typeof result === 'string') {
            result = t(result as TranslationKey);
        }
        if (featureKey === 'generatedFaqForNewFeature' && Array.isArray(result)) {
            result = result.map((faq: FaqItem) => ({
            ...faq,
            question: t(faq.question as TranslationKey),
            answer: t(faq.answer as TranslationKey),
            }));
        }
        if (featureKey === 'faqAnswer' && typeof result === 'string') {
            result = t(result as TranslationKey);
        }
        if (featureKey === 'detectedAnomalies' && typeof result === 'string' && result === MOCK_AI_RESPONSES.noAnomaliesFoundMessage) {
            result = t(result as TranslationKey);
        }
      }
      setState(prev => ({ ...prev, [featureKey as string]: result } as AdminFeatureState));
      setIsLoading(prev => ({ ...prev, [featureKey]: false }));
    }, delay);
  };
  
  useEffect(() => { 
    handleAiFeatureClick('orderStatusSummary', loadOrderStatusSummary, 0);
    handleAiFeatureClick('stockStatusSummary', loadStockStatusSummary, 0);
    handleAiFeatureClick('userActivitySummary', () => MOCK_AI_RESPONSES.userActivitySummary, 0);
    handleAiFeatureClick('topCustomersByVolume', () => {}, 0); 
    handleAiFeatureClick('topManufacturersByVolume', () => {}, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setState(prev => ({ ...prev, [name]: value } as AdminFeatureState));
  };

  const generateAnomalyDetectionData = () => {
    const shouldFindAnomalies = Math.random() > 0.3; 
    if (shouldFindAnomalies) {
      const shuffledAnomalies = [...MOCK_AI_RESPONSES.anomalyDetectionResults].sort(() => 0.5 - Math.random());
      return shuffledAnomalies.slice(0, Math.floor(Math.random() * 3) + 2); 
    } else {
      return MOCK_AI_RESPONSES.noAnomaliesFoundMessage; 
    }
  };
  
  const maxPriceTrendValue = state.keyProductPriceTrend ? Math.max(...state.keyProductPriceTrend.dataPoints.map(dp => dp.price), 0) : 0;

  const regionOptions = REGION_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) }));
  const productTypeOptions = PRODUCT_TYPE_FORECAST_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) }));
  
  const demandChartData = state.orderStatusSummary?.map(item => ({
    label: getTranslatedDemandStatus(item.status, t),
    value: item.count,
    color: DemandStatusColorMap[item.status] 
  })) || [];

  const stockChartData = state.stockStatusSummary?.map(item => ({
    label: getTranslatedStockStatus(item.status, t),
    value: item.count,
    color: StockStatusColorMap[item.status] 
  })) || [];

  const totalDemandsVsStockData = [
    { label: t('adminDashboard_totalDemands'), value: state.totalDemandsCount || 0, color: 'text-sky-500' },
    { label: t('adminDashboard_totalStock'), value: state.totalStockItemsCount || 0, color: 'text-emerald-500' },
  ];


  return (
    <>
      <PageTitle title={t('adminDashboard_title')} subtitle={t('adminDashboard_subtitle')} icon={<ChartBarIcon className="h-8 w-8"/>}/>
      
      <Card title={t('adminDashboard_geminiAssistantTitle')} className="mb-6">
        <GeminiAssistantWidget />
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        
        <Card title={t('adminDashboard_currentDemandStatuses')} className="xl:col-span-1">
          {isLoading.orderStatusSummary && <LoadingSpinner text={t('adminDashboard_loadingStatuses')} />}
          {!isLoading.orderStatusSummary && state.orderStatusSummary && (
            <SimpleBarChart 
              data={demandChartData} 
              title={t('adminDashboard_demandStatusChartTitle')} 
              showValues="percentage"
              totalForPercentage={state.totalDemandsCount}
            />
          )}
           {!isLoading.orderStatusSummary && state.totalDemandsCount === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">{t('adminDashboard_noDemandsYet')}</p>
          )}
        </Card>
        
        <Card title={t('adminDashboard_currentStockStatuses')} className="xl:col-span-1">
          {isLoading.stockStatusSummary && <LoadingSpinner text={t('adminDashboard_loadingStatuses')} />}
          {!isLoading.stockStatusSummary && state.stockStatusSummary && (
             <SimpleBarChart 
                data={stockChartData} 
                title={t('adminDashboard_stockStatusChartTitle')}
                showValues="percentage"
                totalForPercentage={state.totalStockItemsCount}
             />
          )}
          {!isLoading.stockStatusSummary && state.totalStockItemsCount === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">{t('adminDashboard_noStockYet')}</p>
          )}
        </Card>

        <Card title={t('adminDashboard_totalDemandsVsStockChartTitle')} className="xl:col-span-1">
          {(isLoading.orderStatusSummary || isLoading.stockStatusSummary) && <LoadingSpinner text={t('adminDashboard_loadingStatuses')} />}
          {!(isLoading.orderStatusSummary || isLoading.stockStatusSummary) && (
            <SimpleBarChart
              data={totalDemandsVsStockData}
              title="" 
              showValues="absolute"
            />
          )}
        </Card>
        
        <Card title={t('adminDashboard_topCustomersByVolumeTitle')} className="lg:col-span-1">
          {isLoading.topCustomersByVolume && <LoadingSpinner text={t('adminDashboard_loadingTopCompanies')} />}
          {state.topCustomersByVolume && state.topCustomersByVolume.length > 0 && !isLoading.topCustomersByVolume && (
            <SimpleBarChart data={state.topCustomersByVolume} title="" showValues="absolute" />
          )}
          {(!state.topCustomersByVolume || state.topCustomersByVolume.length === 0) && !isLoading.topCustomersByVolume && (
            <p className="text-sm text-slate-400 text-center py-4">{t('adminDashboard_noDataYet')}</p>
          )}
        </Card>

        <Card title={t('adminDashboard_topManufacturersByVolumeTitle')} className="lg:col-span-1">
          {isLoading.topManufacturersByVolume && <LoadingSpinner text={t('adminDashboard_loadingTopCompanies')} />}
          {state.topManufacturersByVolume && state.topManufacturersByVolume.length > 0 && !isLoading.topManufacturersByVolume && (
            <SimpleBarChart data={state.topManufacturersByVolume} title="" showValues="absolute" />
          )}
           {(!state.topManufacturersByVolume || state.topManufacturersByVolume.length === 0) && !isLoading.topManufacturersByVolume && (
            <p className="text-sm text-slate-400 text-center py-4">{t('adminDashboard_noDataYet')}</p>
          )}
        </Card>


        <Card title={t('adminDashboard_userActivitySummary')} className="lg:col-span-1">
          {isLoading.userActivitySummary && <LoadingSpinner text={t('adminDashboard_loadingActivity')} />}
          {state.userActivitySummary && !isLoading.userActivitySummary && (
            <div className="mt-1 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-cyan-300 mb-1">{t('adminDashboard_newRegistrations')}</h4>
                <div className="flex justify-around bg-slate-700/50 p-2 rounded items-end h-24">
                  {state.userActivitySummary.newRegistrations.map(data => (
                    <div key={data.date} className="text-center">
                      <div className="bg-cyan-500 hover:bg-cyan-400 transition-all" style={{ height: `${data.count * 6}px`, width: '10px', margin: '0 auto' }} title={`${data.count} new users`}></div>
                      <p className="text-xs text-slate-400 mt-1">{data.date.substring(0,3)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-cyan-300 mb-1">{t('adminDashboard_activeUsersByRole')}</h4>
                {state.userActivitySummary.activeByRole.map(roleData => (
                  <div key={roleData.role} className="flex justify-between items-center text-sm p-1 bg-slate-700/30 rounded mt-1">
                    <span className="text-slate-200">{getTranslatedUserRole(roleData.role, t)}:</span>
                    <span className="font-semibold text-white">{roleData.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title={t('adminDashboard_topPerformingProducts')} className="lg:col-span-1">
          <AiFeatureButton
            text={t('adminDashboard_loadTopProducts')}
            onClick={() => handleAiFeatureClick('topPerformingProducts', () => MOCK_AI_RESPONSES.topPerformingProducts)}
            isLoading={isLoading.topPerformingProducts}
            leftIcon={<StarIcon className="h-5 w-5 text-yellow-400" />}
          />
          {isLoading.topPerformingProducts && <LoadingSpinner text={t('adminDashboard_loadingProducts')} />}
          {state.topPerformingProducts && !isLoading.topPerformingProducts && (
            <ul className="mt-4 space-y-2">
              {state.topPerformingProducts.slice(0, 4).map(product => (
                <li key={product.id} className="p-2 bg-slate-700/50 rounded text-sm">
                  <span className="font-medium text-cyan-300 block">{product.productName}</span>
                  <span className="text-slate-300">{product.metricValue} {product.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('adminDashboard_keyProductPriceTrend')} className="lg:col-span-1">
          <AiFeatureButton
            text={t('adminDashboard_loadPriceTrend')}
            onClick={() => handleAiFeatureClick('keyProductPriceTrend', () => MOCK_AI_RESPONSES.keyProductPriceTrend)}
            isLoading={isLoading.keyProductPriceTrend}
            leftIcon={<BanknotesIcon className="h-5 w-5 text-emerald-400" />}
          />
          {isLoading.keyProductPriceTrend && <LoadingSpinner text={t('adminDashboard_loadingTrend')} />}
          {state.keyProductPriceTrend && !isLoading.keyProductPriceTrend && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-cyan-300 mb-1">{state.keyProductPriceTrend.productName} ({state.keyProductPriceTrend.unit})</h4>
              <div className="bg-slate-700/50 p-3 rounded h-32 flex items-end space-x-2 justify-around">
                {state.keyProductPriceTrend.dataPoints.map(dp => (
                  <div key={dp.periodLabel} className="text-center flex-grow">
                    <div 
                      className={`bg-emerald-500 hover:bg-emerald-400 transition-all mx-auto rounded-t-sm`}
                      style={{ height: `${(dp.price / (maxPriceTrendValue > 0 ? maxPriceTrendValue : 1)) * 100 * 0.8}%`, width: '60%' }} 
                      title={`${dp.price} ${state.keyProductPriceTrend?.unit}`}
                    ></div>
                    <p className="text-xs text-slate-400 mt-1">{dp.periodLabel}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
        
        <Card title={t('adminDashboard_systemHealthStatus')} className="lg:col-span-1">
          <AiFeatureButton
            text={t('adminDashboard_loadSystemHealth')}
            onClick={() => handleAiFeatureClick('systemHealthStatuses', () => MOCK_AI_RESPONSES.systemHealthStatuses)}
            isLoading={isLoading.systemHealthStatuses}
            leftIcon={<CheckCircleIcon className="h-5 w-5 text-green-400" />}
          />
          {isLoading.systemHealthStatuses && <LoadingSpinner text={t('adminDashboard_loadingHealth')} />}
          {state.systemHealthStatuses && !isLoading.systemHealthStatuses && (
            <ul className="mt-4 space-y-2">
              {state.systemHealthStatuses.map(item => (
                <li key={item.id} className="p-2 bg-slate-700/50 rounded">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-200">{item.componentName}</span>
                    {item.status === 'OK' && <CheckCircleIcon className="h-5 w-5 text-green-400" />}
                    {item.status === 'Warning' && <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />}
                    {item.status === 'Error' && <XCircleIcon className="h-5 w-5 text-red-400" />}
                  </div>
                  {item.details && <p className="text-xs text-slate-400 mt-0.5">{item.details}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('adminDashboard_marketNews')} className="lg:col-span-1 xl:col-span-1">
          <AiFeatureButton
            text={t('adminDashboard_loadMarketNews')}
            onClick={() => handleAiFeatureClick('marketNews', () => MOCK_AI_RESPONSES.marketNews)}
            isLoading={isLoading.marketNews}
            leftIcon={<NewspaperIcon className="h-5 w-5 text-indigo-400" />}
          />
          {isLoading.marketNews && <LoadingSpinner text={t('adminDashboard_loadingNews')} />}
          {state.marketNews && !isLoading.marketNews && (
            <div className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-2">
              {state.marketNews.map(news => (
                <div key={news.id} className="p-2 bg-slate-700/50 rounded">
                  <h5 className="font-semibold text-cyan-300 text-sm">{news.title}</h5>
                  <p className="text-xs text-slate-300">{news.content}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(news.date).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={t('adminDashboard_marketInfoQuery')} className="lg:col-span-1 xl:col-span-1">
          <Input
            label={t('adminDashboard_marketQueryLabel')}
            name="marketInfoQuery"
            value={state.marketInfoQuery || ''}
            onChange={handleInputChange}
            placeholder={t('adminDashboard_marketQueryPlaceholder')}
          />
          <AiFeatureButton
            text={t('adminDashboard_getMarketInfo')}
            onClick={() => handleAiFeatureClick('marketInfoResponse', () => MOCK_AI_RESPONSES.marketInfoResponse)}
            isLoading={isLoading.marketInfoResponse}
            disabled={!state.marketInfoQuery}
            leftIcon={<MagnifyingGlassIcon className="h-5 w-5 text-purple-400" />}
          />
          {isLoading.marketInfoResponse && <LoadingSpinner text={t('adminDashboard_fetchingInfo')} />}
          {state.marketInfoResponse && !isLoading.marketInfoResponse && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded">
              <h5 className="font-semibold text-cyan-400 mb-1">{t('adminDashboard_aiResponse')}</h5>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{state.marketInfoResponse}</p>
            </div>
          )}
        </Card>
        
        <Card title={t('adminDashboard_generateFaqForNewFeature')} className="lg:col-span-1 xl:col-span-1">
          <Textarea
            label={t('adminDashboard_newFeatureDescriptionLabel')}
            name="newFeatureDescription"
            value={state.newFeatureDescription || ''}
            onChange={handleInputChange}
            rows={2}
            placeholder={t('adminDashboard_newFeatureDescriptionPlaceholder')}
          />
          <AiFeatureButton
            text={t('adminDashboard_generateFaq')}
            onClick={() => handleAiFeatureClick('generatedFaqForNewFeature', () => MOCK_AI_RESPONSES.faqForNewFeature)}
            isLoading={isLoading.generatedFaqForNewFeature}
            disabled={!state.newFeatureDescription}
            leftIcon={<QuestionMarkCircleIcon className="h-5 w-5 text-orange-400" />}
          />
          {isLoading.generatedFaqForNewFeature && <LoadingSpinner text={t('adminDashboard_generatingFaq')} />}
          {state.generatedFaqForNewFeature && !isLoading.generatedFaqForNewFeature && (
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-2">
              {state.generatedFaqForNewFeature.map(faq => (
                <div key={faq.id} className="p-2 bg-slate-700/50 rounded">
                  <p className="text-sm font-medium text-cyan-300">{faq.question}</p>
                  <p className="text-xs text-slate-300">{faq.answer}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={t('adminDashboard_faqAnswering')} className="lg:col-span-1 xl:col-span-1">
          <Input
            label={t('adminDashboard_userQuestionLabel')}
            name="faqQuery"
            value={state.faqQuery || ''}
            onChange={handleInputChange}
            placeholder={t('adminDashboard_userQuestionPlaceholder')}
          />
          <AiFeatureButton
            text={t('adminDashboard_getAnswer')}
            onClick={() => handleAiFeatureClick('faqAnswer', () => MOCK_AI_RESPONSES.faqAnswer)}
            isLoading={isLoading.faqAnswer}
            disabled={!state.faqQuery}
            leftIcon={<ChatBubbleBottomCenterTextIcon className="h-5 w-5 text-pink-400" />}
          />
          {isLoading.faqAnswer && <LoadingSpinner text={t('adminDashboard_findingAnswer')} />}
          {state.faqAnswer && !isLoading.faqAnswer && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded">
              <h5 className="font-semibold text-cyan-400 mb-1">{t('adminDashboard_aiAnswer')}</h5>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{state.faqAnswer}</p>
            </div>
          )}
        </Card>
        
        <Card title={t('adminDashboard_feedbackAnalysis')} className="lg:col-span-1 xl:col-span-1">
          <Textarea
            label={t('adminDashboard_userFeedbackLabel')}
            name="feedbackText"
            value={state.feedbackText || ''}
            onChange={handleInputChange}
            rows={3}
            placeholder={t('adminDashboard_userFeedbackPlaceholder')}
          />
          <AiFeatureButton
            text={t('adminDashboard_analyzeFeedback')}
            onClick={() => handleAiFeatureClick('feedbackAnalysis', () => MOCK_AI_RESPONSES.feedbackAnalysis)}
            isLoading={isLoading.feedbackAnalysis}
            disabled={!state.feedbackText}
          />
          {isLoading.feedbackAnalysis && <LoadingSpinner text={t('adminDashboard_analyzing')} />}
          {state.feedbackAnalysis && !isLoading.feedbackAnalysis && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded">
              <h5 className="font-semibold text-cyan-400 mb-2">{t('adminDashboard_feedbackAnalysisResults')}</h5>
              <div className="space-y-1 text-sm">
                <p>{t('adminDashboard_positive')} <span className="font-semibold text-green-400">{state.feedbackAnalysis.positive}%</span></p>
                <p>{t('adminDashboard_neutral')} <span className="font-semibold text-yellow-400">{state.feedbackAnalysis.neutral}%</span></p>
                <p>{t('adminDashboard_negative')} <span className="font-semibold text-red-400">{state.feedbackAnalysis.negative}%</span></p>
                <p className="mt-1 pt-1 border-t border-slate-600">{t('adminDashboard_summary')} <span className="text-slate-300">{state.feedbackAnalysis.summary}</span></p>
                {state.feedbackAnalysis.keyThemes && <p>{t('adminDashboard_keyThemes')} <span className="text-slate-300">{state.feedbackAnalysis.keyThemes.join(', ')}</span></p>}
                {state.feedbackAnalysis.improvementSuggestions && <p>{t('adminDashboard_improvementSuggestions')} <span className="text-slate-300">{state.feedbackAnalysis.improvementSuggestions.join(', ')}</span></p>}
              </div>
            </div>
          )}
        </Card>

        <Card title={t('adminDashboard_demandForecast')} className="lg:col-span-1 xl:col-span-1">
          <Select
            label={t('adminDashboard_regionLabel')}
            name="forecastRegion"
            options={regionOptions}
            value={state.forecastRegion || ''}
            onChange={handleInputChange}
          />
          <Select
            label={t('adminDashboard_productTypeLabel')}
            name="forecastProductType"
            options={productTypeOptions}
            value={state.forecastProductType || ''}
            onChange={handleInputChange}
          />
          <AiFeatureButton
            text={t('adminDashboard_generateForecast')}
            onClick={() => {
              const baseForecast = MOCK_AI_RESPONSES.demandForecast;
              const generatedForecast = {
                ...baseForecast,
                region: state.forecastRegion || baseForecast.region,
                productType: state.forecastProductType || baseForecast.productType,
                // Translate direction if it's from mock
                forecastDirection: t(`adminDashboard_forecastDirection_${baseForecast.forecastDirection}` as TranslationKey) as 'increase' | 'decrease' | 'stagnation',
              };
              handleAiFeatureClick('demandForecast', () => generatedForecast);
            }}
            isLoading={isLoading.demandForecast}
            disabled={!state.forecastRegion || !state.forecastProductType}
            leftIcon={<MapIcon className="h-5 w-5 text-teal-400" />}
          />
          {isLoading.demandForecast && <LoadingSpinner text={t('adminDashboard_forecasting')} />}
          {state.demandForecast && !isLoading.demandForecast && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded">
              <h5 className="font-semibold text-cyan-400 mb-1">
                {t('adminDashboard_forecastFor', { productType: state.demandForecast.productType, region: state.demandForecast.region, timePeriod: state.demandForecast.timePeriod})}
              </h5>
              <div className="flex items-center text-lg">
                {state.demandForecast.forecastDirection === t('adminDashboard_forecastDirection_increase') && <ArrowUpIcon className="h-6 w-6 text-green-400 mr-1" />}
                {state.demandForecast.forecastDirection === t('adminDashboard_forecastDirection_decrease') && <ArrowDownIcon className="h-6 w-6 text-red-400 mr-1" />}
                <span className="font-bold text-white">{state.demandForecast.forecastValue}{state.demandForecast.forecastUnit} {state.demandForecast.forecastDirection}</span>
              </div>
              {state.demandForecast.reason && <p className="text-xs text-slate-300 mt-1">{t('adminDashboard_reason')} {state.demandForecast.reason}</p>}
            </div>
          )}
        </Card>

         <Card title={t('adminDashboard_anomalyDetection')} className="lg:col-span-2 xl:col-span-full">
          <p className="text-sm text-slate-300 mb-3">{t('adminDashboard_anomalyDetectionDescription')}</p>
          <AiFeatureButton
            text={t('adminDashboard_checkAnomalies')}
            onClick={() => handleAiFeatureClick('detectedAnomalies', generateAnomalyDetectionData)}
            isLoading={isLoading.detectedAnomalies}
            leftIcon={<BellAlertIcon className="h-5 w-5 text-red-400" />}
          />
          {isLoading.detectedAnomalies && <LoadingSpinner text={t('adminDashboard_detectingAnomalies')} />}
          {state.detectedAnomalies && !isLoading.detectedAnomalies && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded">
              <h5 className="font-semibold text-cyan-400 mb-2">{t('adminDashboard_anomalyDetectionResults')}</h5>
              {typeof state.detectedAnomalies === 'string' ? (
                 <p className="text-sm text-green-300"><CheckCircleIcon className="h-5 w-5 inline mr-2"/>{state.detectedAnomalies}</p>
              ) : (
                <ul className="space-y-2">
                  {state.detectedAnomalies.map((anomaly, index) => (
                    <li key={index} className="text-sm text-yellow-300">
                      <ExclamationTriangleIcon className="h-5 w-5 inline mr-2 text-yellow-400"/>{anomaly}
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

export default AdminDashboardPage;
