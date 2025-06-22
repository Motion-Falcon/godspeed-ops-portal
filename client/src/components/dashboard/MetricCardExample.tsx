import React from "react";
import { MetricCard } from "./MetricCard";
import { generateMockData, generateMockPieData } from "./utils";
import type { MetricData } from "./types";
import "./MetricCard.css";

interface MetricCardExampleProps {
  loading?: boolean;
}

export const MetricCardExample: React.FC<MetricCardExampleProps> = ({
  loading = false,
}) => {
  // Sample metrics data
  const sampleMetrics: MetricData[] = [
    {
      id: "total-applications",
      label: "Total Applications",
      currentValue: 1247,
      previousValue: 1095,
      unit: "applications",
      formatType: "number",
      color: "#3B82F6",
      icon: "📄",
      description: "All job applications received",
      historicalData: generateMockData(12, 1000, "up"),
    },
    {
      id: "response-rate",
      label: "Response Rate",
      currentValue: 73.5,
      previousValue: 68.2,
      unit: "%",
      formatType: "percentage",
      color: "#10B981",
      icon: "💬",
      description: "Candidate response to outreach",
      historicalData: generateMockData(12, 70, "up"),
    },
    {
      id: "avg-salary",
      label: "Average Salary Offered",
      currentValue: 85000,
      previousValue: 82500,
      unit: "",
      formatType: "currency",
      color: "#F59E0B",
      icon: "💰",
      description: "Mean salary across all positions",
      historicalData: generateMockData(12, 80000, "up"),
    },
    {
      id: "time-to-hire",
      label: "Time to Hire",
      currentValue: 18,
      previousValue: 24,
      unit: "days",
      formatType: "duration",
      color: "#EF4444",
      icon: "⏱️",
      description: "Average days from application to offer",
      historicalData: generateMockData(12, 25, "down"),
    },
    {
      id: "placement-rate",
      label: "Placement Rate",
      currentValue: 42.3,
      previousValue: 39.8,
      unit: "%",
      formatType: "percentage",
      color: "#8B5CF6",
      icon: "🎯",
      description: "Successful job placements",
      historicalData: generateMockData(12, 40, "up"),
    },
    {
      id: "candidate-satisfaction",
      label: "Candidate Satisfaction",
      currentValue: 4.7,
      previousValue: 4.5,
      unit: "/5",
      formatType: "number",
      color: "#06B6D4",
      icon: "⭐",
      description: "Average rating from candidates",
      historicalData: generateMockData(12, 4.5, "stable"),
    },
  ];

  // Sample pie chart metrics data
  const pieChartMetrics: MetricData[] = [
    {
      id: "job-categories",
      label: "Job Categories",
      currentValue: 150,
      previousValue: 140,
      unit: "positions",
      formatType: "number",
      color: "#3B82F6",
      icon: "📊",
      description: "Distribution of job categories",
      historicalData: generateMockPieData([
        "Engineering",
        "Marketing",
        "Sales",
        "Design",
        "Operations",
        "Support"
      ], 25),
    },
    {
      id: "application-sources",
      label: "Application Sources",
      currentValue: 892,
      previousValue: 756,
      unit: "applications",
      formatType: "number",
      color: "#10B981",
      icon: "🔗",
      description: "Where applications come from",
      historicalData: generateMockPieData([
        "Direct Apply",
        "LinkedIn",
        "Referrals",
        "Job Boards",
        "Company Website"
      ], 180),
    },
    {
      id: "candidate-experience",
      label: "Experience Levels",
      currentValue: 425,
      previousValue: 398,
      unit: "candidates",
      formatType: "number",
      color: "#F59E0B",
      icon: "📈",
      description: "Candidate experience distribution",
      historicalData: generateMockPieData([
        "Entry Level",
        "Mid Level",
        "Senior",
        "Lead/Principal",
        "Executive"
      ], 85),
    },
    {
      id: "skills-demand",
      label: "Top Skills in Demand",
      currentValue: 342,
      previousValue: 310,
      unit: "requests",
      formatType: "number",
      color: "#8B5CF6",
      icon: "🛠️",
      description: "Most requested skills",
      historicalData: generateMockPieData([
        "JavaScript",
        "Python",
        "React",
        "AWS",
        "SQL",
        "Project Management"
      ], 57),
    }
  ];

  console.log(sampleMetrics);
  
  // Event handlers
  const handleMetricClick = (metric: MetricData) => {
    console.log("Metric clicked:", metric.label);
  };

  const handleToggleGraph = (show: boolean) => {
    console.log("Graph toggled:", show);
  };

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "var(--background)",
        minHeight: "100vh",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            marginBottom: "32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h1
            style={{
              fontSize: "var(--font-size-header)",
              fontWeight: "var(--font-weight-bold)",
              color: "var(--text)",
            }}
          >
            MetricCard Examples
          </h1>
        </div>

        {/* Small Size Cards */}
        <section style={{ marginBottom: "48px" }}>
          <h2
            style={{
              fontSize: "var(--font-size-subheader)",
              marginBottom: "24px",
              color: "var(--text)",
            }}
          >
            Small Size Cards - Line Charts
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {sampleMetrics.slice(0, 3).map((metric) => (
              <MetricCard
                key={metric.id}
                data={metric}
                size="sm"
                showGraph={false}
                graphType="line"
                timeRange="1y"
                onClick={handleMetricClick}
                onToggleGraph={handleToggleGraph}
                loading={loading}
              />
            ))}
          </div>
        </section>

        {/* Pie Chart Examples */}
        <section style={{ marginBottom: "48px" }}>
          <h2
            style={{
              fontSize: "var(--font-size-subheader)",
              marginBottom: "24px",
              color: "var(--text)",
            }}
          >
            Pie Chart Examples
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
              gap: "24px",
            }}
          >
            {pieChartMetrics.map((metric) => (
              <MetricCard
                key={metric.id}
                data={metric}
                size="md"
                showGraph={true}
                graphType="pie"
                timeRange="1y"
                onClick={handleMetricClick}
                onToggleGraph={handleToggleGraph}
                loading={loading}
              />
            ))}
          </div>
        </section>

        {/* Horizontal Layout */}
        <section style={{ marginBottom: "48px" }}>
          <h2
            style={{
              fontSize: "var(--font-size-subheader)",
              marginBottom: "24px",
              color: "var(--text)",
            }}
          >
            Horizontal Layout - Line Charts
          </h2>
          <div style={{ display: "grid", gap: "24px" }}>
            {sampleMetrics.slice(2, 4).map((metric) => (
              <MetricCard
                key={`horizontal-${metric.id}`}
                data={metric}
                size="md"
                layout="horizontal"
                showGraph={true}
                timeRange="1y"
                graphType="line"
                onClick={handleMetricClick}
                onToggleGraph={handleToggleGraph}
                loading={loading}
              />
            ))}
          </div>
        </section>

        {/* Mixed Configuration Dashboard */}
        <section>
          <h2
            style={{
              fontSize: "var(--font-size-subheader)",
              marginBottom: "24px",
              color: "var(--text)",
            }}
          >
            Mixed Configuration Dashboard
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gap: "24px",
            }}
          >
            {/* Large Line Chart */}
            <div style={{ gridColumn: "span 6" }}>
              <MetricCard
                data={sampleMetrics[0]}
                size="lg"
                showGraph={true}
                timeRange="1y"
                graphType="line"
                onClick={handleMetricClick}
                onToggleGraph={handleToggleGraph}
                loading={loading}
              />
            </div>

            {/* Large Pie Chart */}
            <div style={{ gridColumn: "span 6" }}>
              <MetricCard
                data={pieChartMetrics[0]}
                size="lg"
                showGraph={true}
                timeRange="1y"
                graphType="pie"
                onClick={handleMetricClick}
                onToggleGraph={handleToggleGraph}
                loading={loading}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MetricCardExample;
