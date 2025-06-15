
import React, { useRef, useEffect, useState } from 'react';
import { DemandItem, StockItem, MatchmakingSuggestion, DemandStatus, StockStatus } from '../types';
import { useLocale } from '../LocaleContext';
import { InformationCircleIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

interface MatchmakingVisualizationProps {
  suggestions: MatchmakingSuggestion[];
  demands: DemandItem[];
  stockItems: StockItem[];
}

const MatchmakingVisualization: React.FC<MatchmakingVisualizationProps> = ({
  suggestions,
  demands,
  stockItems,
}) => {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [lineCoordinates, setLineCoordinates] = useState<
    Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      midX: number;
      midY: number;
      suggestion: MatchmakingSuggestion;
    }>
  >([]);
  const [hoveredSuggestionId, setHoveredSuggestionId] = useState<string | null>(null);

  const activeDemands = demands.filter(d => d.status === DemandStatus.RECEIVED);
  const availableStock = stockItems.filter(s => s.status === StockStatus.AVAILABLE);

  useEffect(() => {
    const calculateLines = () => {
      if (!containerRef.current || suggestions.length === 0) {
        setLineCoordinates([]);
        return;
      }

      const newCoordinates: typeof lineCoordinates = [];
      const containerRect = containerRef.current.getBoundingClientRect();

      suggestions.forEach(suggestion => {
        const demandElement = document.getElementById(`demand-${suggestion.demandId}`);
        const stockElement = document.getElementById(`stock-${suggestion.stockId}`);

        if (demandElement && stockElement) {
          const demandRect = demandElement.getBoundingClientRect();
          const stockRect = stockElement.getBoundingClientRect();

          const x1 = demandRect.right - containerRect.left;
          const y1 = demandRect.top + demandRect.height / 2 - containerRect.top;
          const x2 = stockRect.left - containerRect.left;
          const y2 = stockRect.top + stockRect.height / 2 - containerRect.top;
          
          newCoordinates.push({
            id: suggestion.id,
            x1, y1, x2, y2,
            midX: (x1 + x2) / 2,
            midY: (y1 + y2) / 2,
            suggestion,
          });
        }
      });
      setLineCoordinates(newCoordinates);
    };
    
    calculateLines();
    window.addEventListener('resize', calculateLines);
    
    // Recalculate if the item lists change (e.g., after initial load)
    const observer = new MutationObserver(calculateLines);
    if (containerRef.current) {
        observer.observe(containerRef.current, { childList: true, subtree: true });
    }

    return () => {
      window.removeEventListener('resize', calculateLines);
      observer.disconnect();
    };
  }, [suggestions, demands, stockItems, t]); // Add t to dependencies if any text inside useEffect depends on it

  const getMatchColor = (strength?: string, score?: number) => {
    if (typeof score === 'number') {
      if (score >= 0.8) return 'stroke-green-400';
      if (score >= 0.5) return 'stroke-yellow-400';
      return 'stroke-red-400';
    }
    if (strength) {
      if (strength.toLowerCase().includes('high') || strength.includes('100') || strength.includes('9') || strength.includes('8')) return 'stroke-green-400';
      if (strength.toLowerCase().includes('medium') || strength.includes('7') || strength.includes('6') || strength.includes('5')) return 'stroke-yellow-400';
      if (strength.toLowerCase().includes('low') || strength.includes('4') || strength.includes('3') || strength.includes('2')) return 'stroke-red-400';
    }
    return 'stroke-cyan-500'; // Default
  };


  if (suggestions.length === 0) {
    return (
      <div className="text-center text-slate-400 py-6">
        <InformationCircleIcon className="h-10 w-10 mx-auto mb-2 text-cyan-500" />
        {t('adminMatchmaking_noPairingSuggestions')}
      </div>
    );
  }
  
  const renderItemCard = (item: DemandItem | StockItem, type: 'demand' | 'stock') => {
    const isDemand = type === 'demand';
    const companyName = isDemand ? (item as DemandItem).submittedByCompanyName : (item as StockItem).uploadedByCompanyName;

    return (
        <div 
            id={`${type}-${item.id}`} 
            className={`p-2.5 rounded-md shadow-md text-xs mb-3 transition-all duration-200 ease-in-out
                        ${isDemand ? 'bg-sky-800/70 hover:bg-sky-700/90' : 'bg-emerald-800/70 hover:bg-emerald-700/90'}
                        ${lineCoordinates.some(lc => (isDemand && lc.suggestion.demandId === item.id) || (!isDemand && lc.suggestion.stockId === item.id)) ? 'ring-2 ring-yellow-400' : 'ring-1 ring-slate-600'}`}
            style={{ minHeight: '80px' }} // Ensure cards have some height for line connection points
        >
            <p className={`font-semibold ${isDemand ? 'text-sky-300' : 'text-emerald-300'}`}>
                {isDemand ? t('adminMatchmaking_demand') : t('adminMatchmaking_stock')}: {item.id?.substring(0, 8)}...
            </p>
            {companyName && <p className="text-slate-300 text-[11px] truncate" title={companyName}>{companyName}</p>}
            <p className="text-slate-200">{item.diameterType}, Ø{item.diameterFrom}-{item.diameterTo}cm</p>
            <p className="text-slate-200">{t('customerNewDemand_length')}: {item.length}m, {item.quantity}pcs</p>
            <p className="text-slate-200">{t('customerMyDemands_cubicMeters')}: {item.cubicMeters?.toFixed(2) ?? 'N/A'} m³</p>
            {(item as StockItem).price && <p className="text-slate-200">{t('manufacturerMyStock_price')}: {(item as StockItem).price}</p>}
        </div>
    );
  };


  return (
    <div ref={containerRef} className="relative grid grid-cols-2 gap-x-8 md:gap-x-16 p-4 bg-slate-800 rounded-lg min-h-[400px]">
      {/* Demands Column */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        <h3 className="text-lg font-semibold text-sky-400 mb-3 sticky top-0 bg-slate-800 py-1 z-10">{t('adminMatchmaking_demandsByCompanyTitle')} ({activeDemands.length})</h3>
        {activeDemands.length > 0 ? activeDemands.map(demand => renderItemCard(demand, 'demand')) : <p className="text-slate-400 text-sm">{t('adminMatchmaking_noDemandsForCompany')}</p>}
      </div>

      {/* Stock Items Column */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        <h3 className="text-lg font-semibold text-emerald-400 mb-3 sticky top-0 bg-slate-800 py-1 z-10">{t('adminMatchmaking_stockByCompanyTitle')} ({availableStock.length})</h3>
        {availableStock.length > 0 ? availableStock.map(stock => renderItemCard(stock, 'stock')) : <p className="text-slate-400 text-sm">{t('adminMatchmaking_noStockForCompany')}</p>}
      </div>

      {/* SVG for Lines and Tooltips */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ top: 0, left: 0 }}>
        {lineCoordinates.map(coords => (
          <g key={coords.id}>
            <line
              x1={coords.x1}
              y1={coords.y1}
              x2={coords.x2}
              y2={coords.y2}
              className={`${getMatchColor(coords.suggestion.matchStrength, coords.suggestion.similarityScore)} transition-all duration-300`}
              strokeWidth={hoveredSuggestionId === coords.id ? 4 : 2.5}
              markerEnd="url(#arrowhead)"
            />
            <defs>
                <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="4" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" className="fill-current text-cyan-500" />
                </marker>
            </defs>
            <circle 
                cx={coords.midX} 
                cy={coords.midY} 
                r="8" 
                className="fill-yellow-400 hover:fill-yellow-300 cursor-pointer pointer-events-auto"
                onMouseEnter={() => setHoveredSuggestionId(coords.id)}
                onMouseLeave={() => setHoveredSuggestionId(null)}
            />
             <PaperAirplaneIcon 
                x={coords.midX - 5} 
                y={coords.midY - 5} 
                className="h-2.5 w-2.5 text-slate-800 pointer-events-none" 
                style={{ transform: `scale(2)` }} // Scale up the icon itself a bit
            />

          </g>
        ))}
      </svg>
      
      {/* Tooltip Display */}
      {lineCoordinates.map(coords => {
        if (hoveredSuggestionId === coords.id) {
            const isLeftHalf = coords.midX < containerRef.current!.clientWidth / 2;
            const tooltipStyle: React.CSSProperties = {
                position: 'absolute',
                top: `${coords.midY + 15}px`,
                left: isLeftHalf ? `${coords.midX + 15}px` : undefined,
                right: !isLeftHalf ? `${containerRef.current!.clientWidth - coords.midX + 15}px` : undefined,
                transform: 'translateY(-50%)',
                zIndex: 50,
            };

            return (
                <div 
                    key={`tooltip-${coords.id}`}
                    className="p-3 bg-slate-900 border border-yellow-400 rounded-lg shadow-2xl text-xs w-64 md:w-72" // Increased width
                    style={tooltipStyle}
                >
                    <p className="font-bold text-yellow-300 mb-1.5">{t('adminMatchmaking_reason')}</p>
                    <p className="text-slate-200 mb-1 whitespace-pre-wrap leading-snug">{coords.suggestion.reason}</p>
                    {coords.suggestion.matchStrength && (
                        <p className="text-slate-300"><strong className="text-yellow-300">{t('adminMatchmaking_matchStrength')}</strong> {coords.suggestion.matchStrength}</p>
                    )}
                    {coords.suggestion.similarityScore !== undefined && (
                        <p className="text-slate-300"><strong className="text-yellow-300">{t('adminMatchmaking_similarityScoreLabel')}</strong> {(coords.suggestion.similarityScore * 100).toFixed(0)}%</p>
                    )}
                </div>
            );
        }
        return null;
      })}
    </div>
  );
};

export default MatchmakingVisualization;
