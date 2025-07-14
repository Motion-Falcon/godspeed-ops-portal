import { useState } from "react";
import { BarChart3, PieChart } from "lucide-react";
import "../../styles/components/header.css";
import "../../styles/pages/Dashboard.css";
import { AppHeader } from "../../components/AppHeader";
import { MetricCardExample } from "../../components/dashboard/MetricCardExample";

export function MetricExamplePage() {
  const [loading, setLoading] = useState(false);
  const [showPieCharts, setShowPieCharts] = useState(false);

  const toggleLoading = () => {
    setLoading(!loading);
  };

  const toggleChartType = () => {
    setShowPieCharts(!showPieCharts);
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <AppHeader 
        title="Metric Card Examples" 
      />

      {/* Main content */}
      <main className="dashboard-main">
        <div className="dashboard-heading">
          <h1 className="dashboard-title">Metric Card Examples</h1>
          <div className="user-role-badge">
            {showPieCharts ? (
              <PieChart className="role-icon" />
            ) : (
              <BarChart3 className="role-icon" />
            )}
            <span>Examples</span>
          </div>
        </div>
        <p className="dashboard-subtitle">
          Explore different configurations and styles of metric cards
        </p>

        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
          {/* Controls Section */}
          <div style={{ 
            marginBottom: 'var(--spacing-6)',
            padding: 'var(--spacing-4)',
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--border-radius)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: '0 0 var(--spacing-1) 0', fontSize: '1.125rem', fontWeight: '600' }}>
                Example Controls
              </h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Toggle loading states and chart types to see different configurations
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
              <button
                onClick={toggleChartType}
                style={{
                  padding: 'var(--spacing-2) var(--spacing-4)',
                  backgroundColor: showPieCharts ? 'var(--success)' : 'var(--muted)',
                  color: showPieCharts ? 'white' : 'var(--text)',
                  border: 'none',
                  borderRadius: 'var(--border-radius)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-small)',
                  fontWeight: 'var(--font-weight-medium)',
                  transition: 'background-color 0.2s ease'
                }}
              >
                {showPieCharts ? 'Pie Charts' : 'Line Charts'}
              </button>
              <button
                onClick={toggleLoading}
                style={{
                  padding: 'var(--spacing-2) var(--spacing-4)',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--border-radius)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-small)',
                  fontWeight: 'var(--font-weight-medium)',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseOver={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-dark, #2563eb)';
                }}
                onMouseOut={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary)';
                }}
              >
                {loading ? 'Stop Loading' : 'Show Loading'}
              </button>
            </div>
          </div>

          {/* MetricCardExample Component */}
          <div style={{ 
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--border-radius)',
            overflow: 'hidden'
          }}>
            <MetricCardExample loading={loading} />
          </div>
        </div>
      </main>
    </div>
  );
} 