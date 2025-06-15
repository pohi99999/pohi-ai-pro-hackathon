
// Import for local usage within this file
// Note: TranslationKey will be imported from the updated locales.ts
import type { TranslationKey } from './locales'; 

// export { TranslationKey } from './locales'; // Old way, prefer 'export type' for types
export type { TranslationKey } from './locales'; // Re-export TranslationKey from locales for other modules


export enum UserRole {
  ADMIN = 'Administrator',
  CUSTOMER = 'Customer', // Updated from BUYER
  MANUFACTURER = 'Manufacturer',
}

export interface MenuItem {
  label: string; // Will hold the translated label
  labelKey: TranslationKey; // Holds the key for translation
  path: string;
  icon?: React.ReactNode; 
}

export interface ProductFeatures {
  diameterType: string;
  diameterFrom: string;
  diameterTo: string;
  length: string;
  quantity: string;
  cubicMeters?: number;
  notes?: string;
}

export enum DemandStatus {
  RECEIVED = 'Received',
  PROCESSING = 'Processing',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

export interface DemandItem extends ProductFeatures {
  id: string;
  submissionDate: string; 
  status: DemandStatus;
  submittedByCompanyId?: string; 
  submittedByCompanyName?: string; 
}

export enum StockStatus {
  AVAILABLE = 'Available',
  RESERVED = 'Reserved', 
  SOLD = 'Sold',
}

export interface StockItem extends ProductFeatures {
  id?: string; 
  uploadDate?: string; 
  status?: StockStatus; 
  price?: string;
  sustainabilityInfo?: string;
  uploadedByCompanyId?: string; 
  uploadedByCompanyName?: string; 
}

export interface MockCompany {
  id: string;
  companyName: string;
  role: UserRole.CUSTOMER | UserRole.MANUFACTURER; 
  contactPerson?: string; 
  email?: string; 
  address?: { // New address field
    street?: string;
    city?: string;
    zipCode?: string;
    country?: string;
  };
}

export interface AlternativeProduct {
  id: string;
  name: string;
  specs: string;
}

export interface ComparisonData {
  original: { name: string; [key: string]: any };
  alternative: { name: string; [key: string]: any };
}

export interface GeminiComparisonItemDetails {
    name: string;
    dimensions_quantity_notes?: string; 
    pros?: string[];
    cons?: string[];
}

export interface GeminiComparisonResponse {
  original: GeminiComparisonItemDetails;
  alternative: GeminiComparisonItemDetails;
}


export interface MarketNewsItem {
  id: string;
  title: string | TranslationKey; 
  content: string | TranslationKey; 
  date: string;
}

export interface FaqItem {
  id: string;
  question: string | TranslationKey; 
  answer: string | TranslationKey; 
}

export interface DemandForecast {
  region: string;
  productType: string;
  forecastValue: number;
  forecastUnit: string; 
  forecastDirection: 'increase' | 'decrease' | 'stagnation'; 
  timePeriod: string; 
  reason?: string; 
}

export interface FeedbackAnalysisData {
  positive: number; 
  neutral: number;  
  negative: number; 
  summary: string;
  keyThemes?: string[];
  improvementSuggestions?: string[];
}


export interface OptimizationTip {
  id: string;
  tip: string;
}

export interface MatchmakingSuggestion {
  id: string; 
  demandId: string;
  stockId: string;
  reason: string;
  matchStrength?: string; 
  similarityScore?: number; 
}

export interface AiStockSuggestion {
  stockItemId: string;
  reason: string;
  matchStrength?: string;
  similarityScore?: number;
}

export interface DisputeResolutionSuggestion {
  id:string;
  suggestion: string;
}

export interface Waypoint {
  name: string; 
  type: 'pickup' | 'dropoff'; 
  order: number; 
}

export interface LoadingPlanItem {
  name: string;
  quality?: string;
  volumeM3?: string;
  densityTonPerM3?: string;
  weightTon?: string;
  loadingSuggestion?: string;
  destinationName?: string; 
  dropOffOrder?: number;    
  notesOnItem?: string; // Added for more detailed item info in loading plan
}

export interface LoadingPlanResponse {
  planDetails: string;
  items: string | LoadingPlanItem[] | string[];
  capacityUsed: string;
  waypoints?: Waypoint[]; 
  optimizedRouteDescription?: string; 
}

export interface LoadingPlan extends LoadingPlanResponse {
  id: string;
}


export interface CostEstimationResponse {
  totalCost: string;
  factors: string[];
}
export interface CostEstimation extends CostEstimationResponse {
  id: string;
}

export interface UserActivityDataPoint {
  date: string; 
  count: number;
}

export interface UserActivitySummary {
  newRegistrations: UserActivityDataPoint[];
  activeByRole: { role: UserRole; count: number }[];
}

export interface ProductPerformanceData {
  id: string;
  productName: string;
  metricValue: number;
  unit: string; 
}

export interface SystemHealthStatusItem {
  id: string;
  componentName: string;
  status: 'OK' | 'Warning' | 'Error';
  details?: string;
}

export interface OrderStatusSummaryPoint {
  status: DemandStatus;
  count: number;
  percentage: number;
  colorClass: string; 
}

export interface StockStatusSummaryPoint {
  status: StockStatus;
  count: number;
  percentage: number;
  colorClass: string; 
}

export interface PriceTrendDataPoint {
  periodLabel: string; 
  price: number;
}

export interface KeyProductPriceTrend {
  productName: string;
  dataPoints: PriceTrendDataPoint[];
  unit: string; 
}

export interface MonthlyPlatformSummaryData {
  month: string;
  newDemands: number;
  newStockItems: number;
  successfulMatches: number;
  aiInterpretation: string;
}

export interface GeneratedDataReport {
  newCustomers: number;
  newManufacturers: number;
  newDemands: number;
  newStockItems: number;
  productName: string;
}
