import React, { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import MetricChart from "./MetricChart";
import {
  processMetricData,
  transformToChartData,
  getChartColor,
} from "./utils";
import type { MetricData, ChartConfig, FormattedMetric } from "./types";
import "./MetricCard.css";

export interface MetricCardProps {
  data: MetricData;
  size?: "sm" | "md" | "lg";
  showGraph?: boolean;
  graphType?: "line" | "pie";
  timeRange?: "1m" | "3m" | "6m" | "1y";
  layout?: "vertical" | "horizontal";
  onClick?: (metric: MetricData) => void;
  onToggleGraph?: (show: boolean) => void;
  loading?: boolean;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  data,
  size = "md",
  showGraph = false,
  graphType = "line",
  timeRange = "1y",
  layout = "vertical",
  onClick,
  onToggleGraph,
  loading = false,
  className = "",
}) => {
  const [graphVisible, setGraphVisible] = useState(showGraph);
  const cardRef = useRef<HTMLDivElement>(null);

  const processedData: FormattedMetric = useMemo(() => {
    return processMetricData(data);
  }, [data]);

  const chartData = useMemo(() => {
    if (!data.historicalData || data.historicalData.length === 0) return [];
    return transformToChartData(data.historicalData, timeRange);
  }, [data.historicalData, timeRange]);

  const chartConfig: ChartConfig = useMemo(
    () => ({
      type: graphType,
      color: data.color || getChartColor(processedData.growth.trend),
      showGrid: true,
      showAxes: false,
      animate: true,
    }),
    [graphType, data.color, processedData.growth.trend]
  );

  const handleToggleGraph = () => {
    const newState = !graphVisible;
    setGraphVisible(newState);
    onToggleGraph?.(newState);
    
    // Scroll into view when graph is expanded
    if (newState && cardRef.current) {
      // Use setTimeout to wait for the animation to start
      setTimeout(() => {
        cardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 150); // Small delay to let the expansion animation begin
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(data);
    }
  };

  const renderGrowthIcon = (isPositive: boolean) => {
    if (processedData.growth.trend === "stable")
      return <Minus className="metric-card-growth-icon" />;
    return isPositive ? (
      <TrendingUp className="metric-card-growth-icon" />
    ) : (
      <TrendingDown className="metric-card-growth-icon" />
    );
  };

  if (loading) {
    return (
      <div className={`metric-card-skeleton size-${size} ${className}`}>
        <div className="skeleton-text skeleton-title"></div>
        <div className="skeleton-text skeleton-value"></div>
        <div className="skeleton-text skeleton-description"></div>
      </div>
    );
  }

  const cardClasses = [
    "metric-card",
    `size-${size}`,
    onClick ? "clickable" : "",
    loading ? "loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const contentClasses = [
    "metric-card-content",
    layout === "horizontal" ? "horizontal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const valueSectionClasses = [
    "metric-card-value-section",
    layout === "horizontal" ? "horizontal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const chartContainerClasses = [
    "metric-card-chart-container",
    layout === "horizontal" ? "horizontal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClasses} onClick={handleCardClick} ref={cardRef}>
      {/* Header */}
      <div className="metric-card-header">
        <div className="metric-card-info">
          {data.icon && (
            <div
              className="metric-card-icon"
              style={{
                backgroundColor: `${data.color}20`,
                color: data.color,
              }}
            >
              {data.icon}
            </div>
          )}
          <div className="metric-card-title-section">
            <h3 className={`metric-card-title size-${size}`}>{data.label}</h3>
            {data.description && (
              <p className={`metric-card-description size-${size}`}>
                {data.description}
              </p>
            )}
          </div>
        </div>

        {data.historicalData && data.historicalData.length > 0 && (
          <div className="metric-card-controls">
            <button
              className={`chart-toggle-button ${graphVisible ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleGraph();
              }}
              title={graphVisible ? "Hide graph" : "Show graph"}
            >
              <BarChart3 size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={contentClasses}>
        <div className={valueSectionClasses}>
          {/* Growth Information */}
          {processedData.growth && (
            <div className="metric-card-growth-section">
              <div
                className={`metric-card-growth-badge ${
                  processedData.growth.trend === "stable"
                    ? "neutral"
                    : processedData.growth.isPositive
                    ? "positive"
                    : "negative"
                }`}
              >
                {renderGrowthIcon(processedData.growth.isPositive)}
                <span className={`metric-card-growth-text size-${size}`}>
                  {processedData.formattedGrowth}
                </span>
              </div>
              <span className={`metric-card-period-comparison size-${size}`}>
                {processedData.growth.periodComparison}
              </span>
            </div>
          )}

          {/* Main Value */}
          <div className="metric-card-value-container">
            <h2 className={`metric-card-value size-${size}`}>
              {processedData.displayValue}
            </h2>
          </div>

          {/* Previous Value */}
          <p className={`metric-card-previous size-${size} ${
            data.previousValue !== undefined && data.previousValue !== 0 ? '' : 'invisible'
          }`}>
            {data.previousValue !== undefined && data.previousValue !== 0 
              ? `Previous: ${processedData.displayPrevious}`
              : 'Previous: --'
            }
          </p>
        </div>

        {/* Chart */}
        <AnimatePresence>
          {graphVisible && chartData.length > 0 && (
            <motion.div
              className={chartContainerClasses}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="metric-card-chart-wrapper">
                <MetricChart
                  data={chartData}
                  config={chartConfig}
                  width="100%"
                  height={layout === "horizontal" ? 160 : 200}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MetricCard;
