import React from 'react';
import { Waypoint } from '../types';
import { MapPinIcon, TruckIcon } from '@heroicons/react/24/solid'; // Using solid for more distinct icons
import { useLocale } from '../LocaleContext';
import Card from '../components/Card';

interface SimulatedRouteMapProps {
  waypoints: Waypoint[];
  optimizedRouteDescription?: string;
}

const SimulatedRouteMap: React.FC<SimulatedRouteMapProps> = ({ waypoints, optimizedRouteDescription }) => {
  const { t } = useLocale();

  if (!waypoints || waypoints.length === 0) {
    return <div className="text-center text-slate-400 py-4">{t('adminTruckPlanning_routeMap_noWaypoints')}</div>;
  }

  const mapWidth = 600;
  const mapHeight = 300;
  const padding = 30;

  // Simple positioning logic - distribute points horizontally, vary vertically
  const getPosition = (index: number, total: number) => {
    const divisor = (total - 1 === 0) ? 1 : (total - 1); // Ensure divisor is not zero, explicitly
    const xRatio = total > 1 ? index / divisor : 0.5; // Place in middle if only one point
    const x = padding + xRatio * (mapWidth - 2 * padding);
    
    const yBase = mapHeight / 2;
    // Alternate y position slightly for visual separation if many points
    const yOffset = total > 2 ? (index % 2 === 0 ? -20 : 20) : 0; 
    const yRandomOffset = (Math.random() * 20 - 10); // Add some randomness
    const y = yBase + yOffset + yRandomOffset;
    
    return { 
      x: Math.max(padding, Math.min(x, mapWidth - padding)), 
      y: Math.max(padding, Math.min(y, mapHeight - padding)) 
    };
  };
  
  const points = waypoints.map((wp, i) => getPosition(i, waypoints.length));

  return (
    <Card title={t('adminTruckPlanning_routeMap_title')} className="bg-slate-800 shadow-lg">
      <div className="p-4">
        {optimizedRouteDescription && (
          <p className="text-sm text-slate-300 mb-3">{t('adminTruckPlanning_routeMap_description')}: {optimizedRouteDescription}</p>
        )}
        <div className="bg-slate-700/50 p-2 rounded-lg">
          <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} width="100%" preserveAspectRatio="xMidYMid meet" aria-labelledby="route-map-title">
            <title id="route-map-title">{t('adminTruckPlanning_routeMap_svgTitle')}</title>
            
            {/* Background (Optional: can add more detail like subtle grid or landmass shapes) */}
            <rect width={mapWidth} height={mapHeight} className="fill-slate-600" rx="5" ry="5"/>
            <text x={mapWidth / 2} y={mapHeight / 2} dy=".3em" textAnchor="middle" className="text-2xl fill-slate-500 opacity-30 select-none font-semibold">
              {t('adminTruckPlanning_routeMap_simulatedMapArea')}
            </text>

            {/* Route Lines */}
            {points.slice(0, -1).map((p, i) => (
              <line
                key={`line-${i}`}
                x1={p.x}
                y1={p.y}
                x2={points[i+1].x}
                y2={points[i+1].y}
                className="stroke-cyan-400"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
            ))}

            {/* Waypoints */}
            {waypoints.map((waypoint, i) => {
              const { x, y } = points[i];
              const IconComponent = waypoint.type === 'pickup' ? TruckIcon : MapPinIcon;
              const iconColor = waypoint.type === 'pickup' ? 'text-emerald-400' : 'text-red-400';

              return (
                <g key={`waypoint-${i}`} transform={`translate(${x - 8}, ${y - 16})`}> {/* Adjust for icon center */}
                   <IconComponent className={`h-6 w-6 fill-current ${iconColor}`} />
                   <title>{`${waypoint.order}. ${waypoint.name} (${t(waypoint.type === 'pickup' ? 'adminTruckPlanning_routeMap_pickup' : 'adminTruckPlanning_routeMap_dropoff')})`}</title>
                   <text x="10" y="20" className="text-[10px] fill-slate-200" textAnchor="middle">
                     {waypoint.order}. {waypoint.name.length > 15 ? `${waypoint.name.substring(0,12)}...` : waypoint.name}
                   </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="mt-3">
            <h4 className="text-sm font-semibold text-cyan-300 mb-1">{t('adminTruckPlanning_routeMap_waypointList')}:</h4>
            <ul className="text-xs text-slate-300 space-y-0.5">
                {waypoints.map(wp => (
                    <li key={`${wp.order}-${wp.name}`}>
                       {wp.order}. {wp.name} ({t(wp.type === 'pickup' ? 'adminTruckPlanning_routeMap_pickup' : 'adminTruckPlanning_routeMap_dropoff')})
                    </li>
                ))}
            </ul>
        </div>
      </div>
    </Card>
  );
};

export default SimulatedRouteMap;