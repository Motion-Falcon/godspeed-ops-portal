export interface HistoricalDataPoint {
  period: string; // "2024-01", "2023-12", etc.
  value: number; // actual count/value for that period
  date: Date; // for proper chronological ordering
  label?: string; // optional display label
}

export interface MetricData {
  id: string; // unique identifier
  label: string; // display name
  currentValue: number; // current period value
  previousValue: number; // comparison period value
  unit?: string; // 'jobs', '$', '%', 'days', etc.
  formatType?: "number" | "currency" | "percentage" | "duration";

  historicalData: HistoricalDataPoint[];

  // Visual customization
  color?: string;
  icon?: string | React.ReactNode;
  description?: string;
}

export interface MetricCardProps {
  data: MetricData;

  // Display options (optional)
  size?: "sm" | "md" | "lg";
  showGraph?: boolean;
  graphType?: "line" | "pie";
  timeRange?: "1m" | "3m" | "6m" | "1y";

  // Layout options
  orientation?: "horizontal" | "vertical";
  showComparison?: boolean;
  showTrend?: boolean;

  // Interaction
  onToggleGraph?: () => void;
  onClick?: (metric: MetricData) => void;
  onTimeRangeChange?: (range: string) => void;

  // Styling
  className?: string;
  cardClassName?: string;

  // Loading state
  isLoading?: boolean;
}

export interface ChartConfig {
  type: "line" | "pie";
  color: string;
  height?: number;
  showGrid?: boolean;
  showAxes?: boolean;
  animate?: boolean;
  responsive?: boolean;
  // Pie chart specific options
  innerRadius?: number;
  outerRadius?: number;
  showLabels?: boolean;
  showLegend?: boolean;
}

export interface GrowthData {
  value: number; // percentage change
  isPositive: boolean; // true for positive growth
  trend: "up" | "down" | "stable" | "unknown";
  periodComparison: string; // "vs last month", "vs last quarter"
}

export interface FormattedMetric {
  displayValue: string; // formatted current value
  displayPrevious: string; // formatted previous value
  growth: GrowthData;
  formattedGrowth: string; // "+15%", "-5%", etc.
}

export type MetricFormatter = (
  value: number,
  formatType?: string,
  unit?: string
) => string;

export interface MetricConfig {
  id: string;
  label: string;
  formatType: "number" | "currency" | "percentage" | "duration";
  unit?: string;
  color: string;
  icon?: string;
  description?: string;
}

// Chart data interfaces
export interface ChartDataPoint {
  period: string;
  value: number;
  label?: string;
  date?: Date;
  // Pie chart specific
  name?: string;
  fill?: string;
}

// Hook return types
export interface UseMetricReturn {
  formattedMetric: FormattedMetric;
  chartData: ChartDataPoint[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}
