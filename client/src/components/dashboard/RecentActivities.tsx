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
  Mail,
} from "lucide-react";
import "./RecentActivities.css";

interface RecentActivity {
  id: string;
  action_type:
    | "delete_jobseeker"
    | "create_client"
    | "create_timesheet"
    | "update_client"
    | "assign_jobseeker"
    | "reject_jobseeker"
    | "create_position"
    | "delete_position"
    | "pending_jobseeker"
    | "update_timesheet"
    | "delete_invoice"
    | "delete_timesheet"
    | "verify_jobseeker"
    | "update_invoice"
    | "update_jobseeker"
    | "delete_client"
    | "remove_jobseeker"
    | "create_invoice"
    | "update_position"
    | "create_jobseeker"
    | "user_registration"
    | "create_client_draft"
    | "update_client_draft"
    | "delete_client_draft"
    | "create_position_draft"
    | "update_position_draft"
    | "delete_position_draft"
    | "create_bulk_timesheet"
    | "update_bulk_timesheet"
    | "delete_bulk_timesheet"
    | "send_bulk_timesheet_email"
    | "send_invoice_email";
  action_verb: string;
  actor_name: string;
  actor_type: string;
  category:
    | "position_management"
    | "client_management"
    | "financial"
    | "system"
    | "candidate_management";
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
    case "financial":
      return <FileText size={16} />;
    case "send_bulk_timesheet_email":
      return <Mail size={16} />;
    case "send_invoice_email":
      return <Mail size={16} />;
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
    case "create_client_draft":
    case "create_position_draft":
      return <PlusCircleIcon size={12} className="status-success" />;
    case "update_position":
    case "update_jobseeker":
    case "update_client":
    case "update_client_draft":
    case "update_position_draft":
      return <Pencil size={12} className="status-success" />;
    case "remove_jobseeker":
    case "delete_position":
    case "delete_jobseeker":
    case "delete_client":
    case "delete_client_draft":
    case "delete_position_draft":
      return <Trash size={12} className="status-error" />;
    case "create_invoice":
      return <PlusCircleIcon size={12} className="status-success" />;
    case "update_invoice":
      return <Pencil size={12} className="status-success" />;
    case "delete_invoice":
      return <Trash size={12} className="status-error" />;
    case "create_timesheet":
    case "create_bulk_timesheet":
      return <PlusCircleIcon size={12} className="status-success" />;
    case "update_timesheet":
    case "update_bulk_timesheet":
      return <Pencil size={12} className="status-success" />;
    case "delete_timesheet":
    case "delete_bulk_timesheet":
      return <Trash size={12} className="status-error" />;
    case "verify_jobseeker":
      return <CheckCircle size={12} className="status-success" />;
    case "reject_jobseeker":
      return <XCircle size={12} className="status-error" />;
    case "pending_jobseeker":
      return <Clock size={12} className="status-pending" />;
    case "send_invoice_email":
      return <Mail size={12} className="status-success" />;

    default:
      return <AlertCircle size={12} className="status-info" />;
  }
};

// Helper components for styled entity names
const ActorName: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="entity-actor">{children}</span>
);

const PrimaryEntity: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <span className="entity-primary">{children}</span>;

const SecondaryEntity: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <span className="entity-secondary">{children}</span>;

const TertiaryEntity: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <span className="entity-tertiary">{children}</span>;

const formatActivityMessage = (activity: RecentActivity): React.ReactNode => {
  const {
    actor_name,
    primary_entity_name,
    primary_entity_type,
    secondary_entity_name,
    tertiary_entity_name,
    metadata,
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

  // Create readable sentences with styled entities
  switch (activity.action_type) {
    case "assign_jobseeker":
      return cleanSecondaryName && tertiaryEntityName ? (
        <>
          <ActorName>{actor_name}</ActorName> added Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> to position{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity> of{" "}
          <TertiaryEntity>{tertiaryEntityName}</TertiaryEntity>
        </>
      ) : cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> added Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> to position{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> added Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> to a position{" "}
        </>
      );

    case "remove_jobseeker":
      return cleanSecondaryName && tertiaryEntityName ? (
        <>
          <ActorName>{actor_name}</ActorName> removed Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> from position{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity> of
          <TertiaryEntity>{tertiaryEntityName}</TertiaryEntity>
        </>
      ) : cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> removed Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> from position{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> removed Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> from a position{" "}
        </>
      );

    case "create_jobseeker":
      return (
        <>
          <ActorName>{actor_name}</ActorName> created Jobseeker Profile for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "update_jobseeker":
      return (
        <>
          <ActorName>{actor_name}</ActorName> modified Jobseeker Profile for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "delete_jobseeker":
      return (
        <>
          <ActorName>{actor_name}</ActorName> deleted Jobseeker Profile for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "pending_jobseeker":
      return (
        <>
          <ActorName>{actor_name}</ActorName> set Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> status to{" "}
          <SecondaryEntity>pending</SecondaryEntity>
        </>
      );

    case "reject_jobseeker":
      return (
        <>
          <ActorName>{actor_name}</ActorName> set Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> status to{" "}
          <TertiaryEntity>rejected</TertiaryEntity>
        </>
      );

    case "verify_jobseeker":
      return (
        <>
          <ActorName>{actor_name}</ActorName> set Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> status to{" "}
          <PrimaryEntity>verified</PrimaryEntity>
        </>
      );

    case "create_position":
      return cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> added new position{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> for{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> added new position{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "update_position":
      return cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> modified position{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> for{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> modified position{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "delete_position":
      return cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> removed position{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> for{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> removed position{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "create_client":
      return (
        <>
          <ActorName>{actor_name}</ActorName> added a new client{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "update_client":
      return (
        <>
          <ActorName>{actor_name}</ActorName> modified Client{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "delete_client":
      return (
        <>
          <ActorName>{actor_name}</ActorName> deleted Client{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "user_registration":
      return cleanSecondaryName ? (
        <>
          A new user <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity> has been registered with{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> registered new user{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "create_client_draft":
      return (
        <>
          <ActorName>{actor_name}</ActorName> created client draft for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "update_client_draft":
      return (
        <>
          <ActorName>{actor_name}</ActorName> updated client draft for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "delete_client_draft":
      return (
        <>
          <ActorName>{actor_name}</ActorName> deleted client draft for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "create_position_draft":
      return (
        <>
          <ActorName>{actor_name}</ActorName> created position draft for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
          {cleanSecondaryName && (
            <>
              {" "}
              of <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
            </>
          )}
        </>
      );

    case "update_position_draft":
      return (
        <>
          <ActorName>{actor_name}</ActorName> updated position draft for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
          {cleanSecondaryName && (
            <>
              {" "}
              of <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
            </>
          )}
        </>
      );

    case "delete_position_draft":
      return (
        <>
          <ActorName>{actor_name}</ActorName> deleted position draft for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
          {cleanSecondaryName && (
            <>
              {" "}
              of <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
            </>
          )}
        </>
      );

    case "create_invoice":
      return cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> created{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> of{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> created{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "update_invoice":
      return cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> updated{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> of{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> updated{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "delete_invoice":
      return cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> deleted{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> of{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> deleted{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "create_timesheet": {
      const jobseekerName = secondary_entity_name || "";
      const positionTitle = tertiary_entity_name || "";

      return (
        <>
          <ActorName>{actor_name}</ActorName> created Timesheet for{" "}
          <PrimaryEntity>{jobseekerName}</PrimaryEntity>
          {positionTitle && (
            <>
              {" "}for position{" "}
              <SecondaryEntity>{positionTitle}</SecondaryEntity>
            </>
          )}
        </>
      );
    }

    case "update_timesheet": {
      const jobseekerName = secondary_entity_name || "";
      const positionTitle = tertiary_entity_name || "";
  
      return (
        <>
          <ActorName>{actor_name}</ActorName> updated Timesheet for{" "}
          <PrimaryEntity>{jobseekerName}</PrimaryEntity>
          {positionTitle && (
            <>
              {" "}for position{" "}
              <SecondaryEntity>{positionTitle}</SecondaryEntity>
            </>
          )}
        </>
      );
    }

    case "delete_timesheet": {
      const jobseekerName = secondary_entity_name || "";
      const positionTitle = tertiary_entity_name || "";

      return (
        <>
          <ActorName>{actor_name}</ActorName> deleted Timesheet for{" "}
          <PrimaryEntity>{jobseekerName}</PrimaryEntity>
          {positionTitle && (
            <>
              {" "}for position{" "}
              <SecondaryEntity>{positionTitle}</SecondaryEntity>
            </>
          )}
        </>
      );
    }

    case "create_bulk_timesheet": {
      const clientName = secondary_entity_name || "";
      const positionTitle = (activity.metadata?.positionTitle as string) || "";
      const numberOfJobseekers = Number(activity.metadata?.numberOfJobseekers) || 0;

      return (
        <>
          <ActorName>{actor_name}</ActorName> created{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> for{" "}
          <SecondaryEntity>{clientName}</SecondaryEntity>
          {positionTitle && (
            <>
              {" "}
              (<TertiaryEntity>{positionTitle}</TertiaryEntity>)
            </>
          )}
          {numberOfJobseekers > 0 && (
            <>
              {" of "}
              {numberOfJobseekers} jobseeker{numberOfJobseekers !== 1 ? "s" : ""}
            </>
          )}
        </>
      );
    }

    case "update_bulk_timesheet": {
      const clientName = secondary_entity_name || "";
      const positionTitle = (activity.metadata?.positionTitle as string) || "";
      const numberOfJobseekers = Number(activity.metadata?.numberOfJobseekers) || 0;

      return (
        <>
          <ActorName>{actor_name}</ActorName> updated{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> for{" "}
          <SecondaryEntity>{clientName}</SecondaryEntity>
          {positionTitle && (
            <>
              {" "}
              (<TertiaryEntity>{positionTitle}</TertiaryEntity>)
            </>
          )}
          {numberOfJobseekers > 0 && (
            <>
              {" of "}
              {numberOfJobseekers} jobseeker{numberOfJobseekers !== 1 ? "s" : ""}
            </>
          )}
        </>
      );
    }

    case "delete_bulk_timesheet": {
      const clientName = secondary_entity_name || "";
      const positionTitle = (activity.metadata?.positionTitle as string) || "";

      return (
        <>
          <ActorName>{actor_name}</ActorName> deleted{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> for{" "}
          <SecondaryEntity>{clientName}</SecondaryEntity>
          {positionTitle && (
            <>
              {" "}
              (<TertiaryEntity>{positionTitle}</TertiaryEntity>)
            </>
          )}
        </>
      );
    }

    case "send_bulk_timesheet_email": {
      const invoice = cleanPrimaryName;
      const emailsSent = (activity.metadata?.emailsSent as { name: string; email: string }[]) || [];
      if (emailsSent.length === 0) {
        return (
          <>
            <ActorName>{actor_name}</ActorName> sent timesheet <PrimaryEntity>{invoice}</PrimaryEntity> via email
          </>
        );
      }
      return (
        <>
          {emailsSent.map((js, idx) => (
            <span key={idx}>
              <ActorName>{actor_name}</ActorName> sent timesheet <PrimaryEntity>{invoice}</PrimaryEntity> via email to <SecondaryEntity>{js.name} ({js.email})</SecondaryEntity>{idx < emailsSent.length - 1 ? <br /> : null}
            </span>
          ))}
        </>
      );
    }

    case "send_invoice_email": {
      const recipient = typeof metadata?.recipient === "string" ? metadata.recipient : "client";
      const clientName = typeof metadata?.clientName === "string" ? metadata.clientName : "";

      return (
        <>
          <ActorName>{actor_name}</ActorName> sent invoice <PrimaryEntity>{primary_entity_name}</PrimaryEntity> to <SecondaryEntity>{recipient}</SecondaryEntity>
          {" "}for{" "}
          {clientName ? <SecondaryEntity>{clientName}</SecondaryEntity> : null}
        </>
      );
    }

    default:
      return (
        <>
          <ActorName>{activity.actor_name}</ActorName> {activity.action_verb} <PrimaryEntity>{activity.primary_entity_name}</PrimaryEntity>
        </>
      );
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
const ActivitySkeleton: React.FC<{ index: number; keyPrefix?: string }> = ({
  index,
  keyPrefix = "",
}) => (
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
              <div key={activity.id} className="activity-item">
                <div className="activity-icon">
                  {getActivityIcon(activity.action_type, activity.category)}
                </div>

                <div className="activity-content">
                  <div className="activity-main">
                    <div className="activity-message">
                      {formatActivityMessage(activity)}
                    </div>
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
                  <ActivitySkeleton
                    key={index}
                    index={index}
                    keyPrefix="loading-more-"
                  />
                ))}
              </>
            )}

            {/* Load More Button */}
            {hasMore && onLoadMore && (
              <div className="load-more-container">
                <button
                  className={`load-more-button ${
                    isLoadingMore ? "loading" : ""
                  }`}
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
            {activities.length} recent activity
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
