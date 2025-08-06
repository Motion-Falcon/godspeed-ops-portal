import { MetricData, GrowthData, FormattedMetric, HistoricalDataPoint, ChartDataPoint } from './types';

/**
 * Format numbers based on type and value
 */
export const formatValue = (
  value: number, 
  formatType: string = 'number', 
  unit: string = ''
): string => {
  if (isNaN(value) || value === null || value === undefined) {
    return '0';
  }

  switch (formatType) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: value >= 1000 ? 0 : 2,
        maximumFractionDigits: value >= 1000 ? 0 : 2,
      }).format(value);

    case 'percentage':
      return `${value.toFixed(1)}%`;

    case 'duration':
      if (value < 1) {
        return `${Math.round(value * 24)} hours`;
      } else if (value === 1) {
        return '1 day';
      } else if (value < 7) {
        return `${Math.round(value)} days`;
      } else if (value < 30) {
        return `${Math.round(value / 7)} weeks`;
      } else {
        return `${Math.round(value / 30)} months`;
      }

    case 'number':
    default: {
      const abs = Math.abs(value);
      if (abs >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M${unit ? ` ${unit}` : ''}`;
      } else if (abs >= 1000) {
        return `${(value / 1000).toFixed(1)}K${unit ? ` ${unit}` : ''}`;
      } else {
        return `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`;
      }
    }
  }
};

/**
 * Calculate growth percentage and trend
 */
export const calculateGrowth = (
  currentValue: number, 
  previousValue: number,
  periodComparison: string = 'vs last month'
): GrowthData => {
  if (previousValue === 0) {
    return {
      value: currentValue > 0 ? 100 : 0,
      isPositive: currentValue > 0,
      trend: currentValue > 0 ? 'up' : 'stable',
      periodComparison,
    };
  }

  const growthValue = ((currentValue - previousValue) / previousValue) * 100;
  const isPositive = growthValue >= 0;
  
  let trend: 'up' | 'down' | 'stable' | 'unknown';
  if (Math.abs(growthValue) < 1) {
    trend = 'stable';
  } else if (growthValue > 0) {
    trend = 'up';
  } else {
    trend = 'down';
  }

  return {
    value: Math.abs(growthValue),
    isPositive,
    trend,
    periodComparison,
  };
};

/**
 * Format growth percentage
 */
export const formatGrowth = (growth: GrowthData): string => {
  const sign = growth.isPositive ? '+' : '-';
  return `${sign}${growth.value.toFixed(1)}%`;
};

/**
 * Process metric data for display
 */
export const processMetricData = (data: MetricData): FormattedMetric => {
  const growth = calculateGrowth(data.currentValue, data.previousValue);
  
  return {
    displayValue: formatValue(data.currentValue, data.formatType, data.unit),
    displayPrevious: formatValue(data.previousValue, data.formatType, data.unit),
    growth,
    formattedGrowth: formatGrowth(growth),
  };
};

/**
 * Transform historical data for chart consumption
 */
export const transformToChartData = (
  historicalData: HistoricalDataPoint[],
  timeRange?: string
): ChartDataPoint[] => {
  // Filter data based on time range
  let filteredData = [...historicalData];
  
  if (timeRange) {
    const now = new Date();
    const monthsBack = {
      '1m': 1,
      '3m': 3,
      '6m': 6,
      '1y': 12,
    }[timeRange] || 12;
    
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    filteredData = historicalData.filter(point => point.date >= cutoffDate);
  }

  // Sort by date
  filteredData.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Transform for chart
  return filteredData.map(point => ({
    period: point.period,
    value: point.value,
    label: point.label || point.period,
    date: point.date,
  }));
};

/**
 * Get appropriate chart color based on trend
 */
export const getChartColor = (
  trend: 'up' | 'down' | 'stable' | 'unknown',
  customColor?: string
): string => {
  if (customColor) return customColor;
  
  switch (trend) {
    case 'up':
      return '#10B981'; // green
    case 'down':
      return '#EF4444'; // red
    case 'stable':
      return '#6B7280'; // gray
    default:
      return '#3B82F6'; // blue
  }
};

/**
 * Generate gradient colors for area charts
 */
export const generateGradient = (color: string, opacity: number = 0.3): string => {
  // Convert hex to rgba for gradient
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Calculate trend direction from historical data
 */
export const calculateTrendFromHistory = (
  historicalData: HistoricalDataPoint[]
): 'up' | 'down' | 'stable' | 'unknown' => {
  if (historicalData.length < 2) return 'unknown';
  
  const sortedData = [...historicalData].sort((a, b) => a.date.getTime() - b.date.getTime());
  const recent = sortedData.slice(-3); // Last 3 data points
  
  if (recent.length < 2) return 'unknown';
  
  const firstValue = recent[0].value;
  const lastValue = recent[recent.length - 1].value;
  
  const change = ((lastValue - firstValue) / firstValue) * 100;
  
  if (Math.abs(change) < 5) return 'stable';
  return change > 0 ? 'up' : 'down';
};

/**
 * Debounce function for performance optimization
 */
export const debounce = <T extends (...args: never[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Generate mock historical data for testing
 */
export const generateMockData = (
  months: number = 12,
  baseValue: number = 100,
  trend: 'up' | 'down' | 'stable' = 'up'
): HistoricalDataPoint[] => {
  const data: HistoricalDataPoint[] = [];
  const now = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = date.toISOString().substr(0, 7); // YYYY-MM format
    
    let value = baseValue;
    const progress = (months - i) / months; // 0 to 1
    
    if (trend === 'up') {
      // Create an upward trend with more variation
      value += progress * (baseValue * 0.5); // 50% growth over the period
      value += Math.sin(progress * Math.PI * 2) * (baseValue * 0.15); // Add sine wave variation
      value += (Math.random() - 0.5) * (baseValue * 0.3); // Add random variation (±30%)
    } else if (trend === 'down') {
      // Create a downward trend with variation
      value -= progress * (baseValue * 0.3); // 30% decline over the period
      value += Math.sin(progress * Math.PI * 2) * (baseValue * 0.1); // Add sine wave variation
      value += (Math.random() - 0.5) * (baseValue * 0.2); // Add random variation (±20%)
    } else {
      // Stable with realistic fluctuations
      value += Math.sin(progress * Math.PI * 3) * (baseValue * 0.1); // Multiple cycles
      value += Math.cos(progress * Math.PI * 1.5) * (baseValue * 0.08); // Different frequency
      value += (Math.random() - 0.5) * (baseValue * 0.25); // Add random variation (±25%)
    }
    
    // Ensure value is reasonable and not negative
    value = Math.max(baseValue * 0.1, Math.round(value));
    
    data.push({
      period,
      value,
      date,
      label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    });
  }
  
  return data;
};

/**
 * Generate pie chart data from historical data
 * Groups data by category or uses recent time periods
 */
export const generatePieChartData = (
  historicalData: HistoricalDataPoint[],
  type: 'category' | 'time' = 'time',
  maxSlices: number = 6
): ChartDataPoint[] => {
  if (!historicalData || historicalData.length === 0) {
    return [];
  }

  if (type === 'time') {
    // Use the most recent time periods
    const sortedData = [...historicalData]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, maxSlices)
      .reverse();

    return sortedData.map((point) => ({
      period: point.period,
      value: point.value,
      label: point.label || point.period,
      name: point.label || point.period,
      date: typeof point.date === 'string' ? new Date(point.date) : point.date,
    }));
  }

  // For category type, you can extend this based on your needs
  return historicalData.slice(0, maxSlices).map((point) => ({
    period: point.period,
    value: point.value,
    label: point.label || point.period,
    name: point.label || point.period,
    date: typeof point.date === 'string' ? new Date(point.date) : point.date,
  }));
};

/**
 * Generate mock pie chart data for testing
 */
export const generateMockPieData = (
  categories: string[],
  baseValue: number = 100
): HistoricalDataPoint[] => {
  return categories.map((category) => {
    const variation = (Math.random() - 0.5) * 0.4; // ±20% variation
    const value = Math.round(baseValue * (1 + variation));
    
    return {
      period: category,
      value: Math.max(1, value), // Ensure positive values
      label: category,
      date: new Date(),
    };
  });
}; 