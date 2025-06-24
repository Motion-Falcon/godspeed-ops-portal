import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  UserCheck,
  Users,
  CheckCircle,
  RotateCcw,
  BarChart3,
  X,
  Building2,
  Briefcase,
  Target,
  CheckSquare,
  Brain,
  FileText,
  DollarSign,
  Gift,
  MinusCircle,
  Clock,
  Timer,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { AppHeader } from "../../components/AppHeader";
import { MetricCard } from "../../components/dashboard/MetricCard";
import {
  getAllRecruitersMetrics,
  getAllRecruitersClientMetrics,
  getAllRecruitersPositionMetrics,
} from "../../services/api/recruiterMetrics";
import {
  getAIInsightsWithTimeRange,
  getAIInsights,
  type AIInsightsResponse,
} from "../../services/api/aiInsights";
import { MetricData } from "../../components/dashboard/types";
import { useRecentActivities } from "../../hooks/useRecentActivities";
import "../../styles/components/header.css";
import "../../styles/pages/Dashboard.css";
import { RecentActivities } from "../../components/dashboard/RecentActivities";
import {
  getTimesheetMetrics,
  TimesheetMetric,
} from "../../services/api/timesheetMetrics";
import {
  getInvoiceMetrics,
  InvoiceMetric,
} from "../../services/api/invoiceMetrics";

// Constants
const CACHE_DURATION = 30000; // 30 seconds

// Configuration objects
const METRIC_CONFIGS = {
  recruiter: {
    total_profiles: { color: "#3B82F6", icon: <Users size={20} /> },
    pending_profiles: { color: "#F59E0B", icon: <RotateCcw size={20} /> },
    verified_profiles: { color: "#10B981", icon: <CheckCircle size={20} /> },
    rejected_profiles: { color: "#EF4444", icon: <X size={20} /> },
  },
  client: {
    total_clients: { color: "#8B5CF6", icon: <Building2 size={20} /> },
  },
  position: {
    total_positions_added: { color: "#6366F1", icon: <Briefcase size={20} /> },
    total_position_slots: { color: "#F59E0B", icon: <Target size={20} /> },
    total_positions_filled: {
      color: "#10B981",
      icon: <CheckSquare size={20} />,
    },
  },
  ai: {
    documents_scanned: { color: "#8B5CF6", icon: <FileText size={20} /> },
    jobseekers_matched: { color: "#06B6D4", icon: <Brain size={20} /> },
  },
} as const;

// Types
interface UserData {
  id: string;
  email: string | null | undefined;
  name: string;
  userType: string;
  createdAt: string;
  lastSignIn: string;
}

interface DataViewToggleProps {
  id: string;
  checked?: boolean;
  onChange?: () => void;
  label: string;
  description: string;
}

interface MetricsState {
  data: MetricData[];
  loading: boolean;
  error: string | null;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface MetricResponse {
  id: string;
  label: string;
  currentValue: number;
  previousValue: number;
  unit: string;
  formatType: string;
  description: string;
  historicalData: Array<{
    period: string;
    value: number;
    date: string | Date;
  }>;
}

interface APIResponse {
  metrics: MetricResponse[];
}

// Utility functions
const getCacheKey = (
  type: "metrics" | "clients" | "positions" | "aiInsights",
  showAll?: boolean,
  userId?: string
) => {
  if (type === "aiInsights") {
    return "aiInsights_all";
  }
  return showAll ? `${type}_all` : `${type}_${userId}`;
};

const isCacheValid = (timestamp: number) => {
  return Date.now() - timestamp < CACHE_DURATION;
};

const transformMetricsResponse = (
  response: APIResponse,
  configType: keyof typeof METRIC_CONFIGS
): MetricData[] => {
  const config = METRIC_CONFIGS[configType];

  return response.metrics.map((metric) => {
    // Type-safe config lookup
    const metricConfig = config as Record<
      string,
      { color: string; icon: JSX.Element }
    >;
    const metricInfo = metricConfig[metric.id];

    return {
      id: metric.id,
      label: metric.label,
      currentValue: metric.currentValue,
      previousValue: metric.previousValue,
      unit: metric.unit,
      formatType: metric.formatType as
        | "number"
        | "currency"
        | "percentage"
        | "duration",
      color: metricInfo?.color || "#666666",
      icon: metricInfo?.icon || <BarChart3 size={20} />,
      description: metric.description,
      historicalData: metric.historicalData.map((point) => ({
        period: point.period,
        value: point.value,
        date:
          typeof point.date === "string" ? new Date(point.date) : point.date,
      })),
    };
  });
};

// Custom hooks
function useCache<T>() {
  const cache = useRef<Map<string, CacheEntry<T>>>(new Map());

  const getFromCache = useCallback((key: string): T | null => {
    const cached = cache.current.get(key);
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }
    return null;
  }, []);

  const setCache = useCallback((key: string, data: T) => {
    cache.current.set(key, { data, timestamp: Date.now() });
  }, []);

  const clearCache = useCallback((key?: string) => {
    if (key) {
      cache.current.delete(key);
    } else {
      cache.current.clear();
    }
  }, []);

  return { getFromCache, setCache, clearCache };
}

const useMetricsFetch = (
  type: "metrics" | "clients" | "positions" | "aiInsights"
) => {
  const [state, setState] = useState<MetricsState>({
    data: [],
    loading: false,
    error: null,
  });

  const { getFromCache, setCache, clearCache } = useCache<MetricData[]>();
  const fetchingRef = useRef(false);

  const fetchData = useCallback(async () => {
    const cacheKey = getCacheKey(type, true, undefined);

    // Return cached data if valid
    const cached = getFromCache(cacheKey);
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    // Prevent multiple simultaneous requests
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      let response: APIResponse;
      let configType: keyof typeof METRIC_CONFIGS;

      switch (type) {
        case "metrics":
          response = await getAllRecruitersMetrics({ timeRange: "12" });
          configType = "recruiter";
          break;
        case "clients":
          response = await getAllRecruitersClientMetrics({ timeRange: "12" });
          configType = "client";
          break;
        case "positions":
          response = await getAllRecruitersPositionMetrics({ timeRange: "12" });
          configType = "position";
          break;
        case "aiInsights":
          response = await getAIInsightsWithTimeRange({ months: "12" });
          configType = "ai";
          break;
      }

      const transformedData = transformMetricsResponse(response, configType);

      setCache(cacheKey, transformedData);
      setState({ data: transformedData, loading: false, error: null });
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      setState({
        data: [],
        loading: false,
        error:
          error instanceof Error ? error.message : `Failed to fetch ${type}`,
      });
    } finally {
      fetchingRef.current = false;
    }
  }, [type, getFromCache, setCache]);

  const retry = useCallback(() => {
    const cacheKey = getCacheKey(type);
    clearCache(cacheKey);
    fetchingRef.current = false;
    fetchData();
  }, [type, clearCache, fetchData]);

  return { state, fetchData, retry, clearCache };
};

const useBasicAIInsights = () => {
  const [state, setState] = useState<{
    data: AIInsightsResponse | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: false,
    error: null,
  });

  const { getFromCache, setCache, clearCache } = useCache<AIInsightsResponse>();
  const fetchingRef = useRef(false);

  const fetchData = useCallback(async () => {
    const cacheKey = "basicAiInsights";

    // Return cached data if valid
    const cached = getFromCache(cacheKey);
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    // Prevent multiple simultaneous requests
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await getAIInsights();
      setCache(cacheKey, response);
      setState({ data: response, loading: false, error: null });
    } catch (error) {
      console.error("Error fetching basic AI insights:", error);
      setState({
        data: null,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch basic AI insights",
      });
    } finally {
      fetchingRef.current = false;
    }
  }, [getFromCache, setCache]);

  const retry = useCallback(() => {
    clearCache("basicAiInsights");
    fetchingRef.current = false;
    fetchData();
  }, [clearCache, fetchData]);

  return { state, fetchData, retry };
};

// Reusable Components
function DataViewToggle({
  id,
  checked,
  onChange,
  label,
  description,
}: DataViewToggleProps) {
  return (
    <div className="data-view-toggle">
      <div className="data-view-info">
        <h1 className="data-view-label">{label}</h1>
        <p className="data-view-description">{description}</p>
      </div>
      <div className="data-view-controls">
        {onChange && checked && (
          <>
            <input
              type="checkbox"
              id={id}
              className="toggle-form"
              checked={checked}
              onChange={onChange}
            />
            <label htmlFor={id} className="label-form toggle-label">
              Show All
            </label>
          </>
        )}
      </div>
    </div>
  );
}

interface MetricGridProps {
  metricsState: MetricsState;
  expandedGraphs: Set<string>;
  onMetricClick: (metric: MetricData) => void;
  onToggleGraph: (show: boolean, metricId?: string) => void;
  onRetry: () => void;
  gridSize: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  redirectToValue?: string;
}

function MetricGrid({
  metricsState,
  expandedGraphs,
  onMetricClick,
  onToggleGraph,
  onRetry,
  gridSize,
  size = "sm",
  className = "",
  redirectToValue,
}: MetricGridProps) {
  return (
    <div className={`metrics-grid compact ${className}`}>
      {Array.from({ length: gridSize }, (_, index) => {
        const metric = metricsState.data[index];
        const isExpanded = metric ? expandedGraphs.has(metric.id) : false;
        return (
          <div
            key={metric?.id || `loading-${index}`}
            className={`metric-card-container ${
              isExpanded ? "expanded-grid-item" : ""
            }`}
          >
            <MetricCard
              data={
                metric || {
                  id: `loading-${index}`,
                  label: "",
                  currentValue: 0,
                  previousValue: 0,
                  historicalData: [],
                }
              }
              size={size}
              showGraph={false}
              onClick={metric ? onMetricClick : undefined}
              onToggleGraph={
                metric ? (show) => onToggleGraph(show, metric.id) : undefined
              }
              loading={metricsState.loading || !metric}
              error={metricsState.error}
              onRetry={onRetry}
              className={`metric-transition-${index}`}
              redirectTo={redirectToValue}
            />
          </div>
        );
      })}
    </div>
  );
}

interface AISummaryProps {
  basicAiInsights: AIInsightsResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function AISummary({
  basicAiInsights,
  loading,
  error,
  onRetry,
}: AISummaryProps) {
  if (loading) {
    return (
      <div className="ai-summary-loading">
        {/* Loading skeleton for AI summary stats */}
        <div className="ai-summary-stats">
          {[1, 2].map((index) => (
            <div key={index} className="ai-stat-item">
              <div className="ai-stat-icon-skeleton">
                <div className="skeleton-icon"></div>
              </div>
              <div className="ai-stat-details">
                <div
                  className="skeleton-text"
                  style={{
                    width: "180px",
                    height: "20px",
                    marginBottom: "var(--spacing-1)",
                  }}
                ></div>
                <div
                  className="skeleton-text"
                  style={{ width: "240px", height: "14px" }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-summary-error">
        <p className="error-text">{error}</p>
        <button className="retry-button" onClick={onRetry}>
          Try Again
        </button>
      </div>
    );
  }

  if (!basicAiInsights) {
    return null;
  }

  return (
    <div className="ai-summary-stats">
      <div className="ai-stat-item">
        <div className="ai-stat-icon documents">
          <FileText size={28} />
        </div>
        <div className="ai-stat-details">
          <p className="ai-stat-value">
            {basicAiInsights.totalDocumentsScanned.toLocaleString()} Documents
            Scanned
          </p>
          <p className="ai-stat-description">
            {basicAiInsights.summary.documentsScanned.description}
          </p>
        </div>
      </div>

      <div className="ai-stat-item">
        <div className="ai-stat-icon positions">
          <Target size={28} />
        </div>
        <div className="ai-stat-details">
          <p className="ai-stat-value">
            {basicAiInsights.totalJobseekersMatched.toLocaleString()} Position
            Slots
          </p>
          <p className="ai-stat-description">
            {basicAiInsights.summary.jobseekersMatched.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// Main component
export function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [expandedGraphs, setExpandedGraphs] = useState<Set<string>>(new Set());

  // Real-time activities hook
  const {
    activities,
    isConnected,
    error: activitiesError,
    isLoading: activitiesLoading,
    isLoadingMore: activitiesLoadingMore,
    hasMore: activitiesHasMore,
    retry: retryActivities,
    loadMore: loadMoreActivities,
  } = useRecentActivities({
    limit: 10,
    enabled: true,
  });

  // Custom hooks for data fetching
  const recruiterMetrics = useMetricsFetch("metrics");
  const clientMetrics = useMetricsFetch("clients");
  const positionMetrics = useMetricsFetch("positions");
  const aiMetrics = useMetricsFetch("aiInsights");
  const basicAiInsights = useBasicAIInsights();

  // Memoized toggle descriptions
  const toggleDescriptions = useMemo(
    () => ({
      recruiter: "Viewing total jobseeker profile metrics from all recruiters",
      client: "Viewing total client metrics from all recruiters",
      position: "Viewing total position metrics from all recruiters",
      timesheet: "Viewing total timesheet metrics from all recruiters",
      invoice: "Viewing total invoice metrics from all recruiters",
    }),
    []
  );

  // Event handlers
  const handleMetricClick = useCallback((metric: MetricData) => {
    console.log("Metric clicked:", metric.label);
  }, []);

  const handleToggleGraph = useCallback((show: boolean, metricId?: string) => {
    console.log("Graph toggled:", show, "for metric:", metricId);

    if (metricId) {
      setExpandedGraphs((prev) => {
        const newSet = new Set(prev);
        if (show) {
          newSet.add(metricId);
        } else {
          newSet.delete(metricId);
        }
        return newSet;
      });
    }
  }, []);

  // Initialize user data
  useEffect(() => {
    if (user && isAdmin) {
      setUserData({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name,
        userType: user.user_metadata?.user_type,
        createdAt: new Date(user.created_at).toLocaleDateString(),
        lastSignIn: user.last_sign_in_at
          ? new Date(user.last_sign_in_at).toLocaleString()
          : "First login",
      });
    }
  }, [user, isAdmin]);

  // Fetch initial data when userData is available
  useEffect(() => {
    if (userData?.id) {
      // Fetch all initial data
      recruiterMetrics.fetchData();
      clientMetrics.fetchData();
      positionMetrics.fetchData();
      aiMetrics.fetchData();
      basicAiInsights.fetchData();
    }
  }, [
    userData?.id,
    recruiterMetrics.fetchData,
    clientMetrics.fetchData,
    positionMetrics.fetchData,
    aiMetrics.fetchData,
    basicAiInsights.fetchData,
  ]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      recruiterMetrics.clearCache();
      clientMetrics.clearCache();
      positionMetrics.clearCache();
      aiMetrics.clearCache();
    };
  }, [user?.id]);

  // Timesheet metrics state
  const [timesheetMetrics, setTimesheetMetrics] = useState<TimesheetMetric[]>(
    []
  );
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [timesheetError, setTimesheetError] = useState<string | null>(null);

  // Color/icon config for timesheet metrics
  const timesheetMetricConfig: Record<
    string,
    { color: string; icon: JSX.Element }
  > = {
    total_timesheets: { color: "#6366F1", icon: <FileText size={20} /> },
    total_jobseeker_pay: { color: "#10B981", icon: <DollarSign size={20} /> },
    total_bonus_paid: { color: "#F59E0B", icon: <Gift size={20} /> },
    total_deduction: { color: "#EF4444", icon: <MinusCircle size={20} /> },
    total_regular_hours: { color: "#3B82F6", icon: <Clock size={20} /> },
    total_overtime_hours: { color: "#8B5CF6", icon: <Timer size={20} /> },
  };

  // Helper to map TimesheetMetric to MetricData
  const mapTimesheetMetricToMetricData = (
    metric: TimesheetMetric
  ): MetricData => {
    const config = timesheetMetricConfig[metric.id] || {
      color: "#666666",
      icon: <BarChart3 size={20} />,
    };
    return {
      id: metric.id,
      label: metric.label,
      currentValue: metric.currentValue,
      previousValue: metric.previousValue,
      unit: metric.unit,
      formatType: metric.formatType as
        | "number"
        | "currency"
        | "percentage"
        | "duration",
      color: config.color,
      icon: config.icon,
      description: metric.description,
      historicalData: metric.historicalData.map((point) => ({
        ...point,
        date:
          typeof point.date === "string" ? new Date(point.date) : point.date,
      })),
    };
  };

  // Helper to map TimesheetMetric[] to MetricData[]
  const timesheetMetricData: MetricData[] = timesheetMetrics.map(
    mapTimesheetMetricToMetricData
  );

  // Fetch timesheet metrics
  const fetchTimesheetMetrics = useCallback(async () => {
    setTimesheetLoading(true);
    setTimesheetError(null);
    try {
      const response = await getTimesheetMetrics();
      // Attach color/icon
      const metricsWithConfig = response.metrics.map((metric) => ({
        ...metric,
        color: timesheetMetricConfig[metric.id]?.color || "#666666",
        icon: timesheetMetricConfig[metric.id]?.icon || <BarChart3 size={20} />,
      }));
      setTimesheetMetrics(metricsWithConfig);
    } catch (error) {
      setTimesheetError(
        error instanceof Error
          ? error.message
          : "Failed to fetch timesheet metrics"
      );
    } finally {
      setTimesheetLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userData?.id) {
      fetchTimesheetMetrics();
    }
  }, [userData?.id, fetchTimesheetMetrics]);

  // Invoice metrics state
  const [invoiceMetrics, setInvoiceMetrics] = useState<InvoiceMetric[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  // Color/icon config for invoice metrics
  const invoiceMetricConfig: Record<
    string,
    { color: string; icon: JSX.Element }
  > = {
    total_invoices: { color: "#6366F1", icon: <FileText size={20} /> },
    total_billed: { color: "#10B981", icon: <DollarSign size={20} /> },
    total_hours_billed: { color: "#3B82F6", icon: <Clock size={20} /> },
    invoices_with_email: { color: "#F59E0B", icon: <Gift size={20} /> },
  };

  // Helper to map InvoiceMetric to MetricData
  const mapInvoiceMetricToMetricData = (metric: InvoiceMetric): MetricData => {
    const config = invoiceMetricConfig[metric.id] || {
      color: "#666666",
      icon: <BarChart3 size={20} />,
    };
    return {
      id: metric.id,
      label: metric.label,
      currentValue: metric.currentValue,
      previousValue: metric.previousValue,
      unit: metric.unit,
      formatType: metric.formatType as
        | "number"
        | "currency"
        | "percentage"
        | "duration",
      color: config.color,
      icon: config.icon,
      description: metric.description,
      historicalData: metric.historicalData.map((point) => ({
        ...point,
        date:
          typeof point.date === "string" ? new Date(point.date) : point.date,
      })),
    };
  };

  // Helper to map InvoiceMetric[] to MetricData[]
  const invoiceMetricData: MetricData[] = invoiceMetrics.map(
    mapInvoiceMetricToMetricData
  );

  // Fetch invoice metrics
  const fetchInvoiceMetrics = useCallback(async () => {
    setInvoiceLoading(true);
    setInvoiceError(null);
    try {
      const response = await getInvoiceMetrics();
      setInvoiceMetrics(response.metrics);
    } catch (error) {
      setInvoiceError(
        error instanceof Error
          ? error.message
          : "Failed to fetch invoice metrics"
      );
    } finally {
      setInvoiceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userData?.id) {
      fetchInvoiceMetrics();
    }
  }, [userData?.id, fetchInvoiceMetrics]);

  console.log(userData);
  if (!userData) {
    return (
      <div className="centered-container">
        <span className="loading-spinner"></span>
      </div>
    );
  }

  const getRoleIcon = () => <UserCheck className="role-icon admin" />;
  const getRoleName = () => userData.email ==='accounts@godspeed.com' ? "Accounts" : "Administrator";

  return (
    <div className="dashboard-container">
      <AppHeader title="Admin Portal" />

      <main className="dashboard-main">
        <div className="dashboard-heading">
          <h1 className="dashboard-title">Welcome, {userData.name}!</h1>
          <div className="user-role-badge">
            {getRoleIcon()}
            <span>{getRoleName()}</span>
          </div>
        </div>
        <p className="dashboard-subtitle">
          Oversee platform operations and manage system-wide recruiting
          analytics
        </p>

        <div className="dashboard-grid">
          {/* Jobseeker Metrics Section */}
          <div className="dashboard-left-side">
            <div className="metrics-grid-container">
              <DataViewToggle
                id="recruiterDataToggle"
                label={toggleDescriptions.recruiter}
                description="Toggle to view data for all recruiters"
              />
              <MetricGrid
                metricsState={recruiterMetrics.state}
                expandedGraphs={expandedGraphs}
                onMetricClick={handleMetricClick}
                onToggleGraph={handleToggleGraph}
                onRetry={recruiterMetrics.retry}
                gridSize={4}
                size="sm"
                redirectToValue="/jobseeker-management"
              />
            </div>
          </div>

          {/* Recent Activities */}
          <div className="dashboard-right-side">
            <RecentActivities
              activities={activities}
              isConnected={isConnected}
              error={activitiesError}
              isLoading={activitiesLoading}
              isLoadingMore={activitiesLoadingMore}
              hasMore={activitiesHasMore}
              onRetry={retryActivities}
              onLoadMore={loadMoreActivities}
            />
          </div>
        </div>

        {/* Position Metrics */}
        <div className="position-metrics-container">
          <DataViewToggle
            id="positionDataToggle"
            label={toggleDescriptions.position}
            description="Toggle to view position data for all recruiters"
          />

          <div className="position-metrics-grid">
            <MetricGrid
              metricsState={positionMetrics.state}
              expandedGraphs={expandedGraphs}
              onMetricClick={handleMetricClick}
              onToggleGraph={handleToggleGraph}
              onRetry={positionMetrics.retry}
              gridSize={3}
              size="sm"
              className="position-metrics"
              redirectToValue="/position-management"
            />
          </div>
        </div>

        {/* Invoice Metrics */}
        <div className="position-metrics-container">
          <DataViewToggle
            id="invoiceDataToggle"
            label={toggleDescriptions.invoice}
            description="Toggle to view invoice data for all recruiters"
          />
          <MetricGrid
            metricsState={{
              data: invoiceMetricData,
              loading: invoiceLoading,
              error: invoiceError,
            }}
            expandedGraphs={expandedGraphs}
            onMetricClick={handleMetricClick}
            onToggleGraph={handleToggleGraph}
            onRetry={fetchInvoiceMetrics}
            gridSize={4}
            size="sm"
            className="invoice-metrics"
            redirectToValue="/invoice-management/list"
          />
        </div>

        {/* Timesheet Metrics Section */}
        <div className="position-metrics-container">
          <DataViewToggle
            id="timesheetDataToggle"
            label={toggleDescriptions.timesheet}
            description="Toggle to view timesheet data for all recruiters"
          />
          <div className="position-metrics-grid">
            <MetricGrid
              metricsState={{
                data: timesheetMetricData,
                loading: timesheetLoading,
                error: timesheetError,
              }}
              expandedGraphs={expandedGraphs}
              onMetricClick={handleMetricClick}
              onToggleGraph={handleToggleGraph}
              onRetry={fetchTimesheetMetrics}
              gridSize={6}
              size="sm"
              className="position-metrics"
              redirectToValue="/timesheet-management"
            />
          </div>
        </div>

        {/* AI Insights Section */}
        <div className="dashboard-grid ai-insights">
          <div className="ai-insights-container">
            <div className="ai-insights-header">
              <h3 className="ai-insights-title">AI Activity Insights</h3>
              <p className="ai-insights-description">
                Track AI-powered document processing and position matching
                activities
              </p>
            </div>

            <div className="ai-insights-grid">
              <MetricGrid
                metricsState={aiMetrics.state}
                expandedGraphs={expandedGraphs}
                onMetricClick={handleMetricClick}
                onToggleGraph={handleToggleGraph}
                onRetry={aiMetrics.retry}
                gridSize={2}
                size="sm"
                className="ai-insights"
              />
            </div>
          </div>

          <div className="ai-summary-container">
            <AISummary
              basicAiInsights={basicAiInsights.state.data}
              loading={basicAiInsights.state.loading}
              error={basicAiInsights.state.error}
              onRetry={basicAiInsights.retry}
            />
          </div>
        </div>

        {/* Client Metrics Section */}
        <div className="client-metrics-container">
          <DataViewToggle
            id="clientDataToggle"
            label={toggleDescriptions.client}
            description="Toggle to view client data for all recruiters"
          />

          <MetricCard
            data={
              clientMetrics.state.data[0] || {
                id: "total_clients",
                label: "Total Clients Created",
                currentValue: 0,
                previousValue: 0,
                historicalData: [],
              }
            }
            size="md"
            layout="horizontal"
            showGraph={true}
            onClick={handleMetricClick}
            onToggleGraph={(show) =>
              handleToggleGraph(
                show,
                clientMetrics.state.data[0]?.id || "total_clients"
              )
            }
            loading={
              clientMetrics.state.loading ||
              clientMetrics.state.data.length === 0
            }
            error={clientMetrics.state.error}
            onRetry={clientMetrics.retry}
            redirectTo="/client-management"
          />
        </div>
      </main>
    </div>
  );
}
