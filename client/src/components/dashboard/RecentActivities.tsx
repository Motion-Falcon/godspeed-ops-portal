import React from "react";
import {
  Clock,
  User,
  UserPlus,
  UserMinus,
  Briefcase,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Building2,
  Target,
  RefreshCw,
  PlusCircleIcon,
  Trash,
  Pencil,
  ChevronDown,
  Loader2,
} from "lucide-react";
import "./RecentActivities.css";

interface RecentActivity {
  id: string;
  action_type: string;
  action_verb: string;
  actor_name: string;
  actor_type: string;
  category: string;
  display_message: string;
  primary_entity_name?: string;
  primary_entity_type: string;
  secondary_entity_name?: string;
  secondary_entity_type?: string;
  tertiary_entity_name?: string;
  tertiary_entity_type?: string;
  priority: "low" | "normal" | "high" | "urgent";
  status?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface RecentActivitiesProps {
  activities: RecentActivity[];
  isConnected: boolean;
  error: string | null;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onRetry?: () => void;
  onLoadMore?: () => void;
}

const getActivityIcon = (actionType: string, category: string) => {
  switch (category) {
    case "candidate_management":
      if (actionType.includes("add") || actionType.includes("create")) {
        return <UserPlus size={16} />;
      } else if (
        actionType.includes("remove") ||
        actionType.includes("delete")
      ) {
        return <UserMinus size={16} />;
      }
      return <User size={16} />;
    case "position_management":
      return <Briefcase size={16} />;
    case "client_management":
      return <Building2 size={16} />;
    case "document_processing":
      return <FileText size={16} />;
    case "matching":
      return <Target size={16} />;
    default:
      return <AlertCircle size={16} />;
  }
};

const getStatusIcon = (actionType: string) => {
  switch (actionType) {
    case "create_position":
    case "create_jobseeker":
    case "assign_jobseeker":
    case "create_client":
      return <PlusCircleIcon size={12} className="status-success" />;
    case "update_position":
    case "update_jobseeker":
    case "update_client":
      return <Pencil size={12} className="status-success" />;
    case "remove_jobseeker":
    case "delete_position":
    case "delete_jobseeker":
    case "delete_client":
      return <Trash size={12} className="status-error" />;
    case "verify_jobseeker":
      return <CheckCircle size={12} className="status-success" />;
    case "reject_jobseeker":
      return <XCircle size={12} className="status-error" />;
    case "pending_jobseeker":
      return <Clock size={12} className="status-pending" />;

    default:
      return <AlertCircle size={12} className="status-info" />;
  }
};

const formatActivityMessage = (activity: RecentActivity): string => {
  const {
    action_verb,
    actor_name,
    primary_entity_name,
    primary_entity_type,
    secondary_entity_name,
    tertiary_entity_name,
  } = activity;

  // Clean up entity names
  const cleanPrimaryName = primary_entity_name?.includes("ID:")
    ? `${primary_entity_type} profile`
    : primary_entity_name;

  const cleanSecondaryName =
    secondary_entity_name && !secondary_entity_name.includes("undefined")
      ? secondary_entity_name
      : null;

  // Extract tertiary entity name (client)
  const tertiaryEntityName = tertiary_entity_name;

  // Create readable sentences
  switch (activity.action_type) {
    case "assign_jobseeker":
      return cleanSecondaryName && tertiaryEntityName
        ? `${actor_name} added Jobseeker "${cleanPrimaryName}" to position "${cleanSecondaryName}" of ${tertiaryEntityName}`
        : cleanSecondaryName
        ? `${actor_name} added Jobseeker "${cleanPrimaryName}" to position "${cleanSecondaryName}"`
        : `${actor_name} added Jobseeker "${cleanPrimaryName}" to a position`;

    case "remove_jobseeker":
      return cleanSecondaryName && tertiaryEntityName
        ? `${actor_name} removed Jobseeker "${cleanPrimaryName}" from position "${cleanSecondaryName}" of ${tertiaryEntityName}`
        : cleanSecondaryName
        ? `${actor_name} removed Jobseeker "${cleanPrimaryName}" from position "${cleanSecondaryName}"`
        : `${actor_name} removed Jobseeker "${cleanPrimaryName}" from a position`;

    case "create_jobseeker":
      return `${actor_name} created Jobseeker Profile for ${cleanPrimaryName}`;

    case "update_jobseeker":
      return `${actor_name} modified Jobseeker Profile for ${cleanPrimaryName}`;

    case "delete_jobseeker":
      return `${actor_name} deleted Jobseeker Profile for ${cleanPrimaryName}`;

    case "pending_jobseeker":
      return `${actor_name} set Jobseeker "${cleanPrimaryName}" status to pending`;

    case "reject_jobseeker":
      return `${actor_name} set Jobseeker "${cleanPrimaryName}" status to rejected`;

    case "verify_jobseeker":
      return `${actor_name} set Jobseeker "${cleanPrimaryName}" status to verified`;

    case "create_position":
      return cleanSecondaryName
        ? `${actor_name} added new position "${cleanPrimaryName}" for ${cleanSecondaryName}`
        : `${actor_name} added new position "${cleanPrimaryName}"`;

    case "update_position":
      return cleanSecondaryName
        ? `${actor_name} modified position "${cleanPrimaryName}" for ${cleanSecondaryName}`
        : `${actor_name} modified position "${cleanPrimaryName}"`;

    case "delete_position":
      return cleanSecondaryName
        ? `${actor_name} removed position "${cleanPrimaryName}" for ${cleanSecondaryName}`
        : `${actor_name} removed position "${cleanPrimaryName}"`;

    case "create_client": {
      return `${actor_name} added a new client "${cleanPrimaryName}"`;
    }

    case "update_client": {
      return `${actor_name} modified Client "${cleanPrimaryName}"`;
    }

    case "delete_client": {
      return `${actor_name} deleted Client "${cleanPrimaryName}"`;
    }

    case "document_scan":
      return `${actor_name} processed a document for analysis`;

    case "candidate_match":
      return cleanSecondaryName
        ? `${actor_name} matched candidates to position "${cleanSecondaryName}"`
        : `${actor_name} matched candidates to a position`;

    default:
      return `${actor_name} ${action_verb} ${cleanPrimaryName}`;
  }
};

const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const activityTime = new Date(timestamp);
  const diffInSeconds = Math.floor(
    (now.getTime() - activityTime.getTime()) / 1000
  );

  if (diffInSeconds < 60) {
    return "Just now";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
};

// Reusable Activity Skeleton Component
const ActivitySkeleton: React.FC<{ index: number; keyPrefix?: string }> = ({ index, keyPrefix = "" }) => (
  <div key={`${keyPrefix}${index}`} className="activity-item activity-skeleton">
    <div className="activity-icon activity-icon-skeleton">
      <div className="skeleton-icon"></div>
    </div>

    <div className="activity-content">
      <div className="activity-main">
        <div className="activity-message-skeleton">
          <div
            className="skeleton-text"
            style={{
              width: `${60 + index * 8}%`,
              height: "14px",
              marginBottom: "var(--spacing-1)",
            }}
          ></div>
          <div
            className="skeleton-text"
            style={{ width: `${40 + index * 6}%`, height: "14px" }}
          ></div>
        </div>
        <div className="activity-meta activity-meta-skeleton">
          <div
            className="skeleton-text"
            style={{ width: "60px", height: "12px" }}
          ></div>
          <div className="skeleton-icon-small"></div>
        </div>
      </div>
    </div>

    <div className="activity-category">
      <div
        className="skeleton-text category-badge-skeleton"
        style={{ width: "70px", height: "16px" }}
      ></div>
    </div>
  </div>
);

export const RecentActivities: React.FC<RecentActivitiesProps> = ({
  activities,
  isConnected,
  error,
  isLoading = false,
  isLoadingMore = false,
  hasMore = false,
  onRetry,
  onLoadMore,
}) => {
  if (error) {
    return (
      <div className="recent-activities-card">
        <div className="activities-header">
          <h3 className="activities-title">Recent Activities</h3>
          <div className="connection-status error">
            <XCircle size={14} />
            <span>Connection Error</span>
          </div>
        </div>
        <div className="activities-error">
          <p>{error}</p>
          {onRetry && (
            <button
              className="retry-button"
              onClick={onRetry}
              aria-label="Retry loading activities"
            >
              <RefreshCw size={16} />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render loading skeleton
  if (isLoading) {
    return (
      <div className="recent-activities-card">
        <div className="activities-header">
          <h3 className="activities-title">Recent Activities</h3>
          <div className="connection-status connecting">
            <div className="status-indicator" />
            <span>Loading...</span>
          </div>
        </div>

        <div className="activities-content">
          <div className="activities-list">
            {[1, 2, 3, 4, 5].map((index) => (
              <ActivitySkeleton key={index} index={index} />
            ))}
          </div>
        </div>

        <div className="activities-footer">
          <div
            className="skeleton-text"
            style={{ width: "120px", height: "12px" }}
          ></div>
        </div>
      </div>
    );
  }

  return (
    <div className="recent-activities-card">
      <div className="activities-header">
        <h3 className="activities-title">Recent Activities</h3>
        <div
          className={`connection-status ${
            isConnected ? "connected" : "disconnected"
          }`}
        >
          <div className="status-indicator" />
          <span>{isConnected ? "Live" : "Connecting..."}</span>
        </div>
      </div>

      <div className="activities-content">
        {activities.length === 0 ? (
          <div className="activities-empty">
            <Clock size={24} className="empty-icon" />
            <p>No recent activities</p>
            <span>Activities will appear here in real-time</span>
          </div>
        ) : (
          <div className="activities-list">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="activity-item"
              >
                <div className="activity-icon">
                  {getActivityIcon(activity.action_type, activity.category)}
                </div>

                <div className="activity-content">
                  <div className="activity-main">
                    <p className="activity-message">
                      {formatActivityMessage(activity)}
                    </p>
                    <div className="activity-meta">
                      <span className="activity-time">
                        {formatTimeAgo(activity.created_at)}
                      </span>
                      <div className="activity-status">
                        {getStatusIcon(activity.action_type)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="activity-category">
                  <span
                    className={`category-badge category-${activity.category.replace(
                      "_",
                      "-"
                    )}`}
                  >
                    {activity.category === "candidate_management"
                      ? "Jobseeker Management"
                      : activity.category.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Loading More Skeleton */}
            {isLoadingMore && (
              <>
                {[1, 2, 3, 4, 5].map((index) => (
                  <ActivitySkeleton key={index} index={index} keyPrefix="loading-more-" />
                ))}
              </>
            )}
            
            {/* Load More Button */}
            {hasMore && onLoadMore && (
              <div className="load-more-container">
                <button
                  className={`load-more-button ${isLoadingMore ? 'loading' : ''}`}
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  aria-label="Load more activities"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 size={16} className="loading-spinner" />
                      <span>Loading more...</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} />
                      <span>Load 20 more activities</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {activities.length > 0 && (
        <div className="activities-footer">
          <span className="activities-count">
            {activities.length} recent activit
            {activities.length === 1 ? "y" : "ies"}
            {!hasMore && activities.length > 10 && (
              <span className="all-loaded"> • All activities loaded</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
};
