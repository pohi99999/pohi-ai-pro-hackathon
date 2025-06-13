import React from 'react';
import { LoadingPlanItem } from '../types';
import { useLocale } from '../LocaleContext';
import Card from '../components/Card'; // Added import

interface VisualTruckLoadProps {
  items: LoadingPlanItem[];
  truckCapacityM3?: number; // Optional, e.g., 25 for a 25m³ truck
  planDetails?: string;
}

const ITEM_COLORS = [
  'fill-cyan-600', 'fill-blue-600', 'fill-indigo-600', 
  'fill-purple-600', 'fill-pink-600', 'fill-rose-600'
];

const VisualTruckLoad: React.FC<VisualTruckLoadProps> = ({ items, truckCapacityM3 = 25, planDetails }) => {
  const { t } = useLocale();

  if (!items || items.length === 0) {
    return <div className="text-center text-slate-400 py-4">{t('adminTruckPlanning_visualTruck_noItems')}</div>;
  }

  const truckWidth = 600; // SVG viewBox width for the truck bed
  const truckHeight = 100; // SVG viewBox height for the truck bed
  const padding = 5;
  const usableWidth = truckWidth - 2 * padding;
  const usableHeight = truckHeight - 2 * padding;
  const legendHeight = items.length * 20 + 30; // Dynamic legend height

  // Sort items for LIFO display based on dropOffOrder (higher order = loaded earlier, so further from door)
  // If dropOffOrder is the same or undefined, maintain original order or sort by another criteria if needed
  const sortedItems = [...items].sort((a, b) => {
    if (a.dropOffOrder !== undefined && b.dropOffOrder !== undefined) {
      return (b.dropOffOrder || 0) - (a.dropOffOrder || 0); // Higher order first (back of truck)
    }
    return 0;
  });

  let currentX = padding;
  let currentY = padding; // For simple stacking, real packing is complex
  let totalVolumeLoaded = 0;
  sortedItems.forEach(item => {
    totalVolumeLoaded += parseFloat(String(item.volumeM3 || '0').replace(/[^\d.-]/g, ''));
  });
  
  const totalVolumeToDisplay = Math.max(totalVolumeLoaded, truckCapacityM3);


  return (
    <Card title={t('adminTruckPlanning_visualTruck_title')} className="bg-slate-800 shadow-lg">
      <div className="p-4">
        {planDetails && <p className="text-sm text-slate-300 mb-3">{planDetails}</p>}
        <p className="text-xs text-slate-400 mb-1">
          {t('adminTruckPlanning_visualTruck_simulatedView')}
        </p>
        <p className="text-xs text-slate-400 mb-3">
          {t('adminTruckPlanning_visualTruck_totalVolumeLoaded', { volume: totalVolumeLoaded.toFixed(2) })} / {truckCapacityM3} m³
        </p>

        <svg viewBox={`0 0 ${truckWidth} ${truckHeight + legendHeight}`} width="100%" preserveAspectRatio="xMidYMid meet" aria-labelledby="truck-load-title">
          <title id="truck-load-title">{t('adminTruckPlanning_visualTruck_svgTitle')}</title>
          
          {/* Truck Bed Outline */}
          <rect x="0" y="0" width={truckWidth} height={truckHeight} className="fill-slate-700 stroke-slate-500" strokeWidth="1" rx="5" ry="5" />
          <text x={truckWidth / 2} y={truckHeight / 2} dy=".3em" textAnchor="middle" className="text-xs fill-slate-500 opacity-50 select-none">
            {t('adminTruckPlanning_visualTruck_truckBedArea')}
          </text>
           <text x={padding + 5} y={truckHeight - padding - 5} className="text-xs fill-slate-400">{t('adminTruckPlanning_visualTruck_cabEnd')}</text>
           <text x={truckWidth - padding - 5} y={truckHeight - padding - 5} textAnchor="end" className="text-xs fill-slate-400">{t('adminTruckPlanning_visualTruck_doorEnd')}</text>


          {/* Loaded Items - Simplified Representation */}
          {sortedItems.map((item, index) => {
            const itemVolume = parseFloat(String(item.volumeM3 || '0').replace(/[^\d.-]/g, ''));
            const itemWidth = totalVolumeToDisplay > 0 ? (itemVolume / totalVolumeToDisplay) * usableWidth : 0;
            const itemHeight = usableHeight * 0.8; // Assume items take up 80% of height for simplicity
            
            if (currentX + itemWidth > usableWidth + padding) {
              // This basic logic doesn't handle overflow well.
              // A real packing algorithm would be needed. Here, just skip if it overflows.
              console.warn("Item skipped due to simple packing overflow:", item.name);
              return null;
            }

            const itemElement = (
              <g key={`item-${index}`} transform={`translate(${currentX}, ${currentY + (usableHeight - itemHeight) / 2})`}>
                <rect
                  width={itemWidth}
                  height={itemHeight}
                  className={`${ITEM_COLORS[index % ITEM_COLORS.length]} stroke-slate-400`}
                  strokeWidth="0.5"
                  rx="2"
                  ry="2"
                >
                  <title>{`${item.name} (${item.volumeM3 || 'N/A'} m³)${item.destinationName ? ` - ${t('adminTruckPlanning_visualTruck_destination')}: ${item.destinationName}` : ''}${item.dropOffOrder ? ` (${t('adminTruckPlanning_visualTruck_dropOrder')}: ${item.dropOffOrder})` : ''}`}</title>
                </rect>
                {itemWidth > 40 && ( // Only show text if there's enough space
                  <text
                    x={itemWidth / 2}
                    y={itemHeight / 2}
                    dy=".3em"
                    textAnchor="middle"
                    className="text-[8px] fill-white font-medium select-none pointer-events-none"
                  >
                    {item.name.substring(0, itemWidth > 80 ? 15 : 7)}{item.name.length > (itemWidth > 80 ? 15 : 7) ? '...' : ''}
                  </text>
                )}
              </g>
            );
            currentX += itemWidth + 2; // Add a small gap between items
            return itemElement;
          })}

          {/* Legend */}
          <g transform={`translate(${padding}, ${truckHeight + 20})`}>
            <text x="0" y="0" className="text-xs font-semibold fill-slate-300">{t('adminTruckPlanning_visualTruck_legend')}:</text>
            {sortedItems.map((item, index) => (
              <g key={`legend-${index}`} transform={`translate(0, ${15 + index * 20})`}>
                <rect x="0" y="0" width="10" height="10" className={ITEM_COLORS[index % ITEM_COLORS.length]} />
                <text x="15" y="8" className="text-[10px] fill-slate-300">
                  {item.name} ({item.volumeM3 || 'N/A'} m³)
                  {item.destinationName && ` - ${t('adminTruckPlanning_visualTruck_destination')}: ${item.destinationName}`}
                  {item.dropOffOrder !== undefined && ` (${t('adminTruckPlanning_visualTruck_dropOrder')}: ${item.dropOffOrder})`}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </Card>
  );
};

export default VisualTruckLoad;