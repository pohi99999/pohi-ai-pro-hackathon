
import React from 'react';
import { useLocale } from '../LocaleContext';

interface BarChartDataPoint {
  label: string;
  value: number;
  color?: string; 
}

interface SimpleBarChartProps {
  data: BarChartDataPoint[];
  title?: string;
  barHeight?: number; // Intended as visual height units within the viewBox
  gap?: number; // Intended as visual gap units within the viewBox
  labelWidthPx?: number; // Hint for desired pixel width, converted to viewBox units
  showValues?: 'absolute' | 'percentage' | 'none';
  totalForPercentage?: number; 
}

const VIEWBOX_TOTAL_WIDTH_UNITS = 1000; // Define a standard width for the viewBox
const END_PADDING_UNITS = 20; // Padding at the end of the bar area within viewBox

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  title,
  barHeight = 40, // Adjusted for a 1000-unit wide viewBox
  gap = 15,       // Adjusted for a 1000-unit wide viewBox
  labelWidthPx = 120, 
  showValues = 'absolute',
  totalForPercentage,
}) => {
  const { t } = useLocale();
  if (!data || data.length === 0) {
    return <div className="text-center text-slate-400 py-4">{t('adminDashboard_noDataForChart')}</div>;
  }

  const maxValue = Math.max(...data.map(d => d.value), 0);
  // Calculate chart height based on number of items and their height/gap in viewBox units
  const chartHeightViewBox = data.length * (barHeight + gap) - gap;

  if (showValues === 'percentage' && typeof totalForPercentage !== 'number') {
    console.error("SimpleBarChart: 'totalForPercentage' is required when 'showValues' is 'percentage'.");
    return <div className="text-center text-red-400 py-4">{t('adminDashboard_chartConfigError')}</div>;
  }
  
  // Convert labelWidthPx to viewBox units, assuming labelWidthPx is a desired proportion if the chart were ~500px wide.
  // This maintains the spirit of labelWidthPx as a sizing hint.
  const labelAreaWidthUnits = (labelWidthPx / 500) * VIEWBOX_TOTAL_WIDTH_UNITS;
  const valueTextPaddingUnits = 10; // Padding for text inside/outside bar in viewBox units
  const barAreaWidthUnits = VIEWBOX_TOTAL_WIDTH_UNITS - labelAreaWidthUnits - END_PADDING_UNITS;

  return (
    <div className="bg-slate-700/30 p-4 rounded-lg shadow">
      {title && <h3 className="text-md font-semibold text-cyan-300 mb-3 text-center">{title}</h3>}
      <svg 
        width="100%" 
        // Height of SVG element is determined by its content via viewBox aspect ratio
        viewBox={`0 0 ${VIEWBOX_TOTAL_WIDTH_UNITS} ${chartHeightViewBox > 0 ? chartHeightViewBox : barHeight }`} 
        aria-labelledby={title ? title.replace(/\s+/g, '-') : undefined}
        preserveAspectRatio="xMidYMin meet" // Ensures it scales nicely
      >
        <title id={title ? title.replace(/\s+/g, '-') : undefined}>{title || t('adminDashboard_barChart')}</title>
        {data.map((item, index) => {
          const y = index * (barHeight + gap);
          
          let displayValue = '';
          if (showValues === 'absolute') {
            displayValue = item.value.toLocaleString(navigator.language);
          } else if (showValues === 'percentage' && totalForPercentage != null && totalForPercentage > 0) {
            displayValue = `${((item.value / totalForPercentage) * 100).toFixed(1)}%`;
          } else if (showValues === 'percentage') {
             displayValue = `0.0%`; 
          }

          const barRectWidthUnits = maxValue > 0 ? (item.value / maxValue) * barAreaWidthUnits : 0;
          const showTextInsideBar = barRectWidthUnits > (VIEWBOX_TOTAL_WIDTH_UNITS * 0.15); // Heuristic: if bar is >15% of total width

          return (
            <g key={item.label} transform={`translate(0, ${y})`}>
              <text
                x={labelAreaWidthUnits - valueTextPaddingUnits}
                y={barHeight / 2}
                dy=".35em"
                textAnchor="end"
                className="text-xs fill-current text-slate-300"
                aria-label={`${item.label}: ${displayValue}`}
                fontSize="18px" // Adjust fontSize based on viewBox scale
              >
                {item.label.length > (labelAreaWidthUnits / 15)  ? `${item.label.substring(0,Math.floor(labelAreaWidthUnits/15)-3)}...` : item.label}
              </text>
              <rect
                x={labelAreaWidthUnits}
                y={0}
                width={barRectWidthUnits}
                height={barHeight}
                className={item.color || 'fill-current text-cyan-500'}
                rx="3"
                ry="3"
              >
                <title>{`${item.label}: ${displayValue}`}</title>
              </rect>
              {showValues !== 'none' && item.value > 0 && (
                <text
                  x={showTextInsideBar ? (labelAreaWidthUnits + barRectWidthUnits - valueTextPaddingUnits) : (labelAreaWidthUnits + barRectWidthUnits + valueTextPaddingUnits)}
                  y={barHeight / 2}
                  dy=".35em"
                  textAnchor={showTextInsideBar ? "end" : "start"}
                  className={`text-xs font-medium ${showTextInsideBar ? "fill-white" : "fill-slate-200"}`}
                  fontSize="16px" // Adjust fontSize
                >
                  {displayValue}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default SimpleBarChart;
