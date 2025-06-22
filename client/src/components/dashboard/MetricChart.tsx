import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useTheme } from "../theme-provider";
import { ChartDataPoint, ChartConfig } from "./types";

interface MetricChartProps {
  data: ChartDataPoint[];
  config: ChartConfig;
  width?: string | number;
  height?: number;
  className?: string;
}

// Custom tooltip component for line charts
interface LineTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

const CustomLineTooltip: React.FC<LineTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {label}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Value:{" "}
          <span className="font-semibold">
            {payload[0].value.toLocaleString()}
          </span>
        </p>
      </div>
    );
  }
  return null;
};

// Custom tooltip component for pie charts
interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: ChartDataPoint }>;
}

const CustomPieTooltip: React.FC<PieTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {data.name}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Value:{" "}
          <span className="font-semibold">
            {data.value.toLocaleString()}
          </span>
        </p>
      </div>
    );
  }
  return null;
};

// Color palette for pie charts
const PIE_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#F97316", // Orange
  "#EC4899", // Pink
  "#6B7280", // Gray
];

const MetricChart: React.FC<MetricChartProps> = ({
  data,
  config,
  width = "100%",
  height = 300,
  className = "",
}) => {
  const { 
    type, 
    color, 
    showGrid = true, 
    animate = true,
    innerRadius = 0,
    outerRadius,
    showLabels = true,
    showLegend = false
  } = config;

  // Use theme provider to detect current theme
  const { theme } = useTheme();
  const isDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  // Theme-based colors
  const themeColors = {
    grid: isDarkMode ? "#9ca3af" : "#2d3748",
    gridOpacity: 1,
    text: isDarkMode ? "#ffffff" : "#2d3748",
    axis: isDarkMode ? "#f7fafc" : "#1a202c",
  };

  // Prepare data for charts
  const chartData = data.map((point, index) => ({
    ...point,
    name: point.label || point.period,
    fill: point.fill || PIE_COLORS[index % PIE_COLORS.length],
  }));

  // Format Y-axis values
  const formatYAxisTick = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  // Format X-axis values for better readability
  const formatXAxisTick = (value: string) => {
    // For month-year format like "Jan 2024", return just "Jan"
    return value.split(" ")[0];
  };

  // Render pie chart label
  const renderPieLabel = (entry: ChartDataPoint) => {
    if (!showLabels) return null;
    return `${entry.name}: ${entry.value}`;
  };

  // Switch between chart types
  const renderChart = () => {
    switch (type) {
      case "pie":
        return (
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={showLabels ? renderPieLabel : false}
              outerRadius={outerRadius || Math.min(height * 0.35, 120)}
              innerRadius={innerRadius}
              fill={color}
              dataKey="value"
              animationDuration={animate ? 1000 : 0}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomPieTooltip />} />
            {showLegend && (
              <Legend 
                wrapperStyle={{ 
                  fontSize: '12px', 
                  color: themeColors.text,
                  fontFamily: 'var(--font-family)'
                }} 
              />
            )}
          </PieChart>
        );

      case "line":
      default:
        return (
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={themeColors.grid}
                opacity={themeColors.gridOpacity}
              />
            )}
            <XAxis
              dataKey="name"
              tick={{
                fontSize: 11,
                fill: themeColors.text,
                fontFamily: "var(--font-family)",
              }}
              tickLine={{ stroke: themeColors.axis }}
              axisLine={{ stroke: themeColors.axis }}
              tickFormatter={formatXAxisTick}
              interval={0}
            />
            <YAxis
              tick={{
                fontSize: 11,
                fill: themeColors.text,
                fontFamily: "var(--font-family)",
              }}
              tickLine={{ stroke: themeColors.axis }}
              axisLine={{ stroke: themeColors.axis }}
              tickFormatter={formatYAxisTick}
              width={40}
            />
            <Tooltip content={<CustomLineTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              dot={{
                fill: color,
                strokeWidth: 2,
                r: 3,
                fillOpacity: 0.8,
              }}
              activeDot={{
                r: 5,
                stroke: color,
                strokeWidth: 2,
                fill: "white",
              }}
              animationDuration={animate ? 1000 : 0}
              connectNulls={false}
            />
          </LineChart>
        );
    }
  };

  return (
    <ResponsiveContainer width={width} height={height} className={className}>
      {renderChart()}
    </ResponsiveContainer>
  );
};

export default MetricChart;
