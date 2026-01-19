import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'primary',
}: StatCardProps) {
  const colorClasses = {
    primary: 'from-blue-500 to-blue-600',
    success: 'from-green-500 to-green-600',
    warning: 'from-yellow-500 to-yellow-600',
    danger: 'from-red-500 to-red-600',
    info: 'from-cyan-500 to-cyan-600',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div className={`h-2 bg-gradient-to-r ${colorClasses[color]}`} />
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              {title}
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {value}
            </p>
          </div>
          {icon && (
            <div className="text-3xl opacity-80">
              {icon}
            </div>
          )}
        </div>
        
        {subtitle && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {subtitle}
          </p>
        )}
        
        {trend && (
          <div className={`flex items-center gap-1 text-sm mt-2 ${
            trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span className="font-semibold">{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProgressBarProps {
  label: string;
  value: number;
  maxValue: number;
  color?: string;
  showPercentage?: boolean;
  subtitle?: string;
}

export function ProgressBar({
  label,
  value,
  maxValue,
  color = 'bg-blue-500',
  showPercentage = true,
  subtitle,
}: ProgressBarProps) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <span className="text-gray-900 dark:text-white font-semibold">
          {showPercentage ? `${percentage.toFixed(1)}%` : value.toLocaleString('tr-TR')}
        </span>
      </div>
      <div className="relative h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`absolute h-full ${color} transition-all duration-500 ease-out rounded-full`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}

interface PieChartSegment {
  label: string;
  value: number;
  color: string;
}

interface SimplePieChartProps {
  segments: PieChartSegment[];
  size?: number;
}

export function SimplePieChart({ segments, size = 200 }: SimplePieChartProps) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  
  if (total === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full"
        style={{ width: size, height: size }}
      >
        <span className="text-gray-400 dark:text-gray-500 text-sm">Veri yok</span>
      </div>
    );
  }

  let currentAngle = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((segment, index) => {
          const percentage = (segment.value / total) * 100;
          const angle = (percentage / 100) * 360;
          const startAngle = currentAngle;
          currentAngle += angle;

          // Convert to radians
          const startRad = (startAngle - 90) * (Math.PI / 180);
          const endRad = (currentAngle - 90) * (Math.PI / 180);
          
          const radius = size / 2;
          const x1 = radius + radius * Math.cos(startRad);
          const y1 = radius + radius * Math.sin(startRad);
          const x2 = radius + radius * Math.cos(endRad);
          const y2 = radius + radius * Math.sin(endRad);
          
          const largeArc = angle > 180 ? 1 : 0;

          return (
            <path
              key={index}
              d={`M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={segment.color}
              className="hover:opacity-80 transition-opacity"
            />
          );
        })}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 4}
          fill="white"
          className="dark:fill-gray-800"
        />
      </svg>
      
      <div className="space-y-2">
        {segments.map((segment, index) => {
          const percentage = ((segment.value / total) * 100).toFixed(1);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-gray-700 dark:text-gray-300">
                {segment.label}: {percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TimelineItem {
  date: string;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
}

interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                item.color || 'bg-blue-100 dark:bg-blue-900'
              }`}
            >
              {item.icon || '📌'}
            </div>
            {index < items.length - 1 && (
              <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-2" />
            )}
          </div>
          <div className="flex-1 pb-8">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {item.date}
            </p>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
              {item.title}
            </h4>
            {item.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {item.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
