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
import { ProfileCompletion } from "./components/ProfileCompletion";
import { MetricCard } from "../../components/dashboard/MetricCard";
import {
  getJobseekerMetrics,
  type JobseekerMetricsResponse,
} from "../../services/api/jobseekerMetrics";
import { MetricData } from "../../components/dashboard/types";

interface UserData {
  id: string;
  email: string | null | undefined;
  name: string;
  userType: string;
  createdAt: string;
  lastSignIn: string;
  profileId?: string;
}

export function JobSeekerDashboard() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [metricsData, setMetricsData] = useState<MetricData[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  // Track which cards have expanded graphs for grid layout
  const [expandedGraphs, setExpandedGraphs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      setUserData({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || "User",
        userType: user.user_metadata?.user_type || "jobseeker",
        createdAt: new Date(user.created_at).toLocaleDateString(),
        lastSignIn: user.last_sign_in_at
          ? new Date(user.last_sign_in_at).toLocaleString()
          : "First login",
      });

      fetchUserProfileId(user.id);
    }
  }, [user]);

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
      const response: JobseekerMetricsResponse = await getJobseekerMetrics(
        candidateId,
        {
          timeRange: "12", // 12 months of data
        }
      );

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
        })
      );

      setMetricsData(transformedMetrics);
    } catch (error) {
      console.error("Error fetching jobseeker metrics:", error);
      setMetricsError(
        error instanceof Error ? error.message : "Failed to fetch metrics"
      );
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleMetricClick = (metric: MetricData) => {
    console.log("Metric clicked:", metric.label);
    // You can implement navigation to detailed metric view here
  };

  const handleToggleGraph = (show: boolean, metricId?: string) => {
    console.log("Graph toggled:", show, "for metric:", metricId);

    // Track which cards have their graphs expanded for grid layout
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
      <AppHeader title="Dashboard" />

      {/* Main content */}
      <main className="dashboard-main">
        <div className="dashboard-heading">
          <h1 className="dashboard-title">Welcome, {userData.name}!</h1>
          <div className="user-role-badge">
            <UserIcon className="role-icon jobseeker" />
            <span>Job Seeker</span>
          </div>
        </div>
        <p className="dashboard-subtitle">
          Discover opportunities at Godspeed pace with our intelligent job
          matching system
        </p>

        <div className="dashboard-grid">
          {/* Metrics Error Display */}
          {metricsError && (
            <div className="metrics-error">
              <p>Error loading metrics: {metricsError}</p>
              <button
                className="metrics-error-button"
                onClick={() =>
                  userData?.id && fetchJobseekerMetrics(userData.id)
                }
              >
                Retry
              </button>
            </div>
          )}

          {/* Metrics Cards - 2x2 Grid with Individual Expansion */}
          <div className="metrics-grid compact">
            {/* Always render 4 cards, with loading state or actual data */}
            {Array.from({ length: 4 }, (_, index) => {
              const metric = metricsData[index];
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
                    size="sm"
                    showGraph={false}
                    onClick={metric ? handleMetricClick : undefined}
                    onToggleGraph={
                      metric
                        ? (show) => handleToggleGraph(show, metric.id)
                        : undefined
                    }
                    loading={metricsLoading || !metric}
                    className={`metric-transition-${index}`}
                  />
                </div>
              );
            })}
          </div>

          {/* Profile Completion Status Card on the right */}
          <ProfileCompletion userId={userData.id} />
        </div>
      </main>
    </div>
  );
}
