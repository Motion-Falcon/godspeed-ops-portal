import { useState, useEffect } from "react";
import {
  User as UserIcon,
  CheckCircle,
  RotateCcw,
  Calendar,
  BarChart3,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import "../../styles/components/header.css";
import "../../styles/pages/Dashboard.css";
import { AppHeader } from "../../components/AppHeader";
import { ProfileCompletion } from "../../components/dashboard/ProfileCompletion";
import { MetricCard } from "../../components/dashboard/MetricCard";
import { getJobseekerMetrics } from "../../services/api/jobseekerMetrics";
import { MetricData } from "../../components/dashboard/types";
import { useNavigate } from "react-router-dom";
import { useLanguage } from '../../contexts/language/language-provider';

interface UserData {
  id: string;
  email: string | null | undefined;
  name: string;
  userType: string;
  createdAt: string;
  lastSignIn: string;
  profileId?: string;
}

// Add MetricGrid for jobseeker dashboard
interface MetricGridProps {
  metricsData: MetricData[];
  expandedGraphs: Set<string>;
  onMetricClick: (metric: MetricData) => void;
  onToggleGraph: (show: boolean, metricId?: string) => void;
  onRetry: () => void;
  gridSize: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  redirectToValue?: string;
  loading: boolean;
  error: string | null;
}

function MetricGrid({
  metricsData,
  expandedGraphs,
  onMetricClick,
  onToggleGraph,
  onRetry,
  gridSize,
  size = "sm",
  className = "",
  redirectToValue,
  loading,
  error,
}: MetricGridProps) {
  return (
    <div className={`metrics-grid compact ${className}`}>
      {Array.from({ length: gridSize }, (_, index) => {
        const metric = metricsData[index];
        const isExpanded = metric ? expandedGraphs.has(metric.id) : false;
        return (
          <div
            key={metric?.id || `loading-${index}`}
            className={`metric-card-container ${isExpanded ? "expanded-grid-item" : ""}`}
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
              onClick={metric ? () => onMetricClick(metric) : undefined}
              onToggleGraph={
                metric ? (show) => onToggleGraph(show, metric.id) : undefined
              }
              loading={loading || !metric}
              error={error}
              onRetry={onRetry}
              className={`metric-transition-${index}`}
              redirectTo={metric?.redirectTo || redirectToValue}
            />
          </div>
        );
      })}
    </div>
  );
}

export function JobSeekerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [metricsData, setMetricsData] = useState<MetricData[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  // Track which cards have expanded graphs for grid layout
  const [expandedGraphs, setExpandedGraphs] = useState<Set<string>>(new Set());
  const { t } = useLanguage();

  useEffect(() => {
    if (user) {
      setUserData({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || t('common.user'),
        userType: user.user_metadata?.user_type || "jobseeker",
        createdAt: new Date(user.created_at).toLocaleDateString(),
        lastSignIn: user.last_sign_in_at
          ? new Date(user.last_sign_in_at).toLocaleString()
          : t('dashboard.firstLogin'),
      });

      fetchUserProfileId(user.id);
    }
  }, [user, t]);

  const fetchUserProfileId = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("jobseeker_profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error fetching profile ID:", error);
      } else if (data) {
        setUserData((prev) => (prev ? { ...prev, profileId: data.id } : null));
        // Fetch metrics once we have the profile ID
        fetchJobseekerMetrics(userId);
      }
    } catch (err) {
      console.error("Error fetching profile ID:", err);
    }
  };

  const fetchJobseekerMetrics = async (candidateId: string) => {
    setMetricsLoading(true);
    setMetricsError(null);

    try {
      // Extend Metric type to include redirectTo
      type MetricWithRedirect = {
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
        redirectTo?: string;
      };

      const response = await getJobseekerMetrics(
        candidateId,
        {
          timeRange: "12", // 12 months of data
        }
      ) as { metrics: MetricWithRedirect[] };

      // Define client-side colors and icons for each metric type
      const metricConfig = {
        jobs_completed: { color: "#4CAF50", icon: <CheckCircle size={20} /> },
        active_jobs: { color: "#FF9800", icon: <RotateCcw size={20} /> },
        upcoming_jobs: { color: "#2196F3", icon: <Calendar size={20} /> },
        total_assignments: { color: "#795548", icon: <BarChart3 size={20} /> },
      };

      // Transform API response to MetricData format
      const transformedMetrics: MetricData[] = response.metrics.map(
        (metric) => ({
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
          color:
            metricConfig[metric.id as keyof typeof metricConfig]?.color ||
            "#666666",
          icon: metricConfig[metric.id as keyof typeof metricConfig]?.icon || (
            <BarChart3 size={20} />
          ),
          description: metric.description,
          historicalData: metric.historicalData.map((point) => ({
            period: point.period,
            value: point.value,
            date:
              typeof point.date === "string"
                ? new Date(point.date)
                : point.date,
          })),
          redirectTo: metric.redirectTo, // Pass through from backend
        })
      );

      setMetricsData(transformedMetrics);
    } catch (error) {
      console.error("Error fetching jobseeker metrics:", error);
      setMetricsError(
        error instanceof Error ? error.message : t('messages.failedToFetchMetrics')
      );
    } finally {
      setMetricsLoading(false);
    }
  };

  // Updated: handleMetricClick to support redirectTo navigation
  const handleMetricClick = (metric: MetricData) => {
    if (metric.redirectTo) {
      navigate(metric.redirectTo);
    } else {
      console.log("Metric clicked:", metric.label);
    }
  };

  const handleToggleGraph = (show: boolean, metricId?: string) => {
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
  };

  if (!userData) {
    return (
      <div className="centered-container">
        <span className="loading-spinner"></span>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <AppHeader title={t('dashboard.welcome')} />

      {/* Main content */}
      <main className="dashboard-main">
        <div className="dashboard-heading">
          <h1 className="dashboard-title">{t('welcome')}, {userData.name}!</h1>
          <div className="user-role-badge">
            <UserIcon className="role-icon jobseeker" />
            <span>{t('roles.jobseeker')}</span>
          </div>
        </div>
        <p className="dashboard-subtitle">
          {t('jobseeker_subtitle')}
        </p>

        <div className="dashboard-grid">
          {/* Metrics Cards - 2x2 Grid with Individual Expansion */}
          <MetricGrid
            metricsData={metricsData}
            expandedGraphs={expandedGraphs}
            onMetricClick={handleMetricClick}
            onToggleGraph={handleToggleGraph}
            onRetry={() => userData?.id && fetchJobseekerMetrics(userData.id)}
            gridSize={4}
            size="sm"
            loading={metricsLoading}
            error={metricsError}
          />

          {/* Profile Completion Status Card on the right */}
          <ProfileCompletion userId={userData.id} />
        </div>
      </main>
    </div>
  );
}
