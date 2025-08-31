import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getPosition,
  PositionData,
  getPositionAssignments,
} from "../../services/api/position";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { AppHeader } from "../../components/AppHeader";
import { useLanguage } from "../../contexts/language/language-provider";
import {
  ArrowLeft,
  Edit,
  Briefcase,
  Users,
  Phone,
  Mail,
  User,
} from "lucide-react";
import "../../styles/pages/ClientView.css";
import "../../styles/pages/PositionManagement.css";
import "../../styles/components/header.css";

interface ExtendedPositionData extends PositionData {
  [key: string]: unknown;
}

export function PositionView() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [position, setPosition] = useState<ExtendedPositionData | null>(null);
  const [assignedJobseekers, setAssignedJobseekers] = useState<{
    id: string;
    name: string;
    email: string;
    mobile?: string;
  }[]>([]);
  const [assignedJobseekersLoading, setAssignedJobseekersLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditConfirmation, setShowEditConfirmation] = useState(false);

  const convertToCamelCase = (
    data: Record<string, unknown>
  ): ExtendedPositionData => {
    const converted: Record<string, unknown> = {};

    Object.entries(data).forEach(([key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
        letter.toUpperCase()
      );
      converted[camelKey] = value;
    });

    return converted as ExtendedPositionData;
  };

  useEffect(() => {
    const fetchPositionAndAssignments = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const fetchedPosition = await getPosition(id);
        const convertedPosition = convertToCamelCase(
          fetchedPosition as unknown as Record<string, unknown>
        );
        setPosition(convertedPosition);
        // Fetch assigned jobseekers using getPositionAssignments
        setAssignedJobseekersLoading(true);
        try {
          const response = await getPositionAssignments(id);
          if (response.success) {
            const assigned = response.assignments.map((assignment) => ({
              id: assignment.id,
              name: assignment.jobseekerProfile
                ? `${assignment.jobseekerProfile.first_name} ${assignment.jobseekerProfile.last_name}`
                : "Unknown",
              email: assignment.jobseekerProfile?.email || "N/A",
              mobile: assignment.jobseekerProfile?.mobile || undefined,
            }));
            setAssignedJobseekers(assigned);
          } else {
            setAssignedJobseekers([]);
          }
        } catch (err) {
          setAssignedJobseekers([]);
        } finally {
          setAssignedJobseekersLoading(false);
        }
      } catch (err) {
        console.error("Error fetching position:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : t("positionManagement.failedToLoadPosition");
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchPositionAndAssignments();
  }, [id]);

  const handleNavigateBack = () => {
    navigate("/position-management");
  };

  const handleNavigateToMatching = () => {
    navigate(`/position-matching?positionId=${id}`);
  };

  const confirmEditPosition = () => {
    setShowEditConfirmation(true);
  };

  // Format date with type checking
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (e) {
      return "N/A";
    }
  };

  // Format date range to show duration
  const formatDateRange = (
    startDate?: string | null,
    endDate?: string | null
  ) => {
    if (!startDate) return t("positionManagement.nA");

    const start = new Date(startDate);
    const formattedStart = start.toLocaleDateString();

    if (!endDate) return `${formattedStart} (${t("positionManagement.ongoing")})`;

    const end = new Date(endDate);
    const formattedEnd = end.toLocaleDateString();

    // Calculate duration in days
    const durationMs = end.getTime() - start.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

    return `${formattedStart} to ${formattedEnd} (${durationDays} ${t("positionManagement.days")})`;
  };

  const renderDetailItem = (
    label: string,
    value?: string | number | boolean | null | object
  ) => {
    let displayValue;

    if (value === null || value === undefined || value === "") {
      displayValue = t("positionManagement.nA");
    } else if (typeof value === "boolean") {
      displayValue = value ? t("positionManagement.yes") : t("positionManagement.no");
    } else if (typeof value === "object") {
      // Handle documents required object
      if (label === "Documents Required" && value) {
        const documents = Object.entries(value)
          .filter(([, isRequired]) => isRequired)
          .map(([doc]) => formatDocumentName(doc))
          .join(", ");
        displayValue = documents || t("positionManagement.none");
      } else {
        displayValue = JSON.stringify(value);
      }
    } else {
      displayValue = value;
    }

    return (
      <div className="detail-item">
        <p className="detail-label">{label}:</p>
        <p className="detail-value">{displayValue}</p>
      </div>
    );
  };

  // Format document names for better display
  const formatDocumentName = (docKey: string) => {
    // Convert camelCase to space-separated words
    return docKey
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());
  };

  if (loading) {
    // Skeleton loader modeled after JobSeekerProfile
    return (
      <div className="client-view-container">
        <AppHeader
          title={t("positionManagement.positionDetails")}
          actions={
            <button className="button" disabled>
              <ArrowLeft size={16} className="icon" />
              <span>{t("positionManagement.backToPositionManagement")}</span>
            </button>
          }
        />
        <main className="client-main">
          {/* Overview Skeleton */}
          <div className="client-overview section-card">
            <div className="client-banner">
 
            </div>
            <div className="client-details">
              <div className="client-avatar skeleton-avatar">
                <div className="skeleton-icon" style={{ width: '40px', height: '40px' }}></div>
              </div>
              <div className="client-info-header">
                <div className="position-basic-info">
                  <div className="skeleton-text" style={{ width: '200px', height: '32px', margin: '8px 0' }}></div>
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className="detail-item">
                      <div className="skeleton-text" style={{ width: '80px', height: '14px' }}></div>
                      <div className="skeleton-text" style={{ width: '120px', height: '16px', marginLeft: '10px' }}></div>
                    </div>
                  ))}
                </div>
                <div className="position-assignment-info">
                  <div className="assignment-summary">
                    <div className="skeleton-text" style={{ width: '180px', height: '20px', marginBottom: '10px' }}></div>
                    <div className="jsp-status-tabs">
                      {[1,2,3].map((i) => (
                        <div key={i} className="jsp-tab">
                          <div className="skeleton-text" style={{ width: '60px', height: '16px' }}></div>
                          <div className="skeleton-icon" style={{ width: '16px', height: '16px' }}></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="assigned-jobseekers">
                    <div className="skeleton-text" style={{ width: '140px', height: '18px', marginBottom: '10px' }}></div>
                    <div className="jobseekers-list">
                      {[1,2].map((i) => (
                        <div key={i} className="jobseeker-card">
                          <div className="jobseeker-details">
                            <div className="skeleton-text" style={{ width: '120px', height: '16px', marginBottom: '6px' }}></div>
                            <div className="jobseeker-contact">
                              <div className="skeleton-text" style={{ width: '100px', height: '14px', marginRight: '8px' }}></div>
                              <div className="skeleton-text" style={{ width: '80px', height: '14px' }}></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="skeleton-text" style={{ width: '220px', height: '32px', marginTop: '16px', borderRadius: '6px' }}></div>
                </div>
              </div>
            </div>
          </div>
          {/* Details Grid Skeleton */}
          <div className="profile-content grid-container">
            {[
              t("positionManagement.basicDetails"),
              t("positionManagement.addressDetails"),
              t("positionManagement.employmentCategorization"),
              t("positionManagement.documentsRequired"),
              t("positionManagement.positionDetailsSection"),
              t("positionManagement.overtime"),
              t("positionManagement.paymentBillings"),
              t("positionManagement.notes"),
              t("positionManagement.tasks"),
            ].map((section) => (
              <div key={section} className="section-card">
                <div className="skeleton-text" style={{ width: '180px', height: '20px', marginBottom: '20px' }}></div>
                <div className="detail-group">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="detail-item">
                      <div className="skeleton-text" style={{ width: '100px', height: '14px' }}></div>
                      <div className="skeleton-text" style={{ width: '140px', height: '16px', marginLeft: '10px' }}></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error || !position) {
    return (
      <div className="client-view-container">
        <div className="error-container">
          <p className="error-message">{error || t("positionManagement.failedToLoadPosition")}</p>
          <div className="error-actions">
            <button className="button " onClick={handleNavigateBack}>
              {t("positionManagement.backToPositions")}
            </button>
            <button
              className="button primary"
              onClick={() => window.location.reload()}
            >
              {t("positionManagement.tryAgain")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const positionTitle = position.title || t("positionManagement.unnamedPosition");

  return (
    <div className="client-view-container">
      <AppHeader
        title={positionTitle || t("positionManagement.positionDetails")}
        actions={
          <>
            <button className="button" onClick={handleNavigateBack}>
              <ArrowLeft size={16} />
              <span>{t("positionManagement.backToPositions")}</span>
            </button>
            <button className="button secondary" onClick={confirmEditPosition}>
              <Edit size={16} />
              {t("buttons.edit")}
            </button>
          </>
        }
        statusMessage={error}
        statusType="error"
      />

      <main className="client-main">
        <div className="client-overview section-card">
          <div className="client-banner"></div>

          <div className="client-details">
            <div className="client-avatar">
              <Briefcase size={40} />
            </div>
            <div className="client-info-header">
              <div className="position-basic-info">
                <h1 className="client-name">{positionTitle}</h1>
                {renderDetailItem(t("common.client"), position.clientName)}
                {renderDetailItem(t("positionManagement.positionId"), position.positionCode)}
                {renderDetailItem(
                  t("positionManagement.duration"),
                  formatDateRange(position.startDate, position.endDate)
                )}
                {renderDetailItem(t("positionManagement.created"), formatDate(position.createdAt))}
                {renderDetailItem(t("positionManagement.updated"), formatDate(position.updatedAt))}
              </div>

              <div className="position-assignment-info">
                <div className="assignment-summary">
                  <h3 className="assignment-title">
                    <Users size={20} />
                    {t("positionManagement.positionAssignment")}
                  </h3>
                  <div className="jsp-status-tabs">
                    <div className="jsp-tab active">
                      {t("positionManagement.totalPositions")}:
                      <span className="jsp-count">
                        {position.numberOfPositions || 0}
                      </span>
                    </div>
                    <div className="jsp-tab active">
                      {t("positionManagement.assigned")}:
                      <span className="jsp-count">
                        {assignedJobseekers.length}
                      </span>
                    </div>
                    <div className="jsp-tab active">
                      {t("positionManagement.available")}:
                      <span className="jsp-count">
                        {Math.max(
                          0,
                          (position.numberOfPositions || 0) -
                            assignedJobseekers.length
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="assigned-jobseekers">
                  <h4 className="jobseekers-title">{t("positionManagement.assignedJobseekers")}</h4>
                  {assignedJobseekersLoading ? (
                    <div className="loading-jobseekers">
                      <div className="loading-spinner small"></div>
                      <span>{t("positionManagement.loadingAssignments")}</span>
                    </div>
                  ) : assignedJobseekers.length === 0 ? (
                    <div className="no-assignments">
                      <User size={24} className="empty-icon" />
                      <p>{t("positionManagement.noJobseekersAssigned")}</p>
                    </div>
                  ) : (
                    <div className="jobseekers-list">
                      {assignedJobseekers.map((jobseeker) => (
                        <div key={jobseeker.id} className="jobseeker-card">
                          <div className="jobseeker-details">
                            <p className="jobseeker-name">{jobseeker.name}</p>
                            <div className="jobseeker-contact">
                              <span className="contact-item">
                                <Mail size={12} />
                                {jobseeker.email}
                              </span>
                              {jobseeker.mobile && (
                                <span className="contact-item">
                                  <Phone size={12} />
                                  {jobseeker.mobile}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="button primary manage-assignment-btn"
                  onClick={handleNavigateToMatching}
                >
                  <Users size={16} />
                  {t("positionManagement.managePositionAssignment")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-content grid-container">
          <div className="basic-details-section section-card">
            <h2 className="section-title">{t("positionManagement.basicDetails")}</h2>
            <div className="detail-group">
              {renderDetailItem(t("forms.title"), position.title)}
              {renderDetailItem(t("common.client"), position.clientName)}
              {renderDetailItem(t("positionManagement.positionId"), position.positionCode)}
              {renderDetailItem(t("positionManagement.startDate"), formatDate(position.startDate))}
              {renderDetailItem(
                t("positionManagement.endDate"),
                position.endDate
                  ? formatDate(position.endDate)
                  : t("positionManagement.noEndDate")
              )}
              {renderDetailItem(t("positionManagement.showOnJobPortal"), position.showOnJobPortal)}
              {renderDetailItem(t("positionManagement.clientManager"), position.clientManager)}
              {renderDetailItem(t("positionManagement.salesManager"), position.salesManager)}
              {renderDetailItem(t("positionManagement.positionCode"), position.positionNumber)}
              {renderDetailItem(t("invoiceManagement.description"), position.description)}
            </div>
          </div>

          <div className="address-section section-card">
            <h2 className="section-title">{t("positionManagement.addressDetails")}</h2>
            <div className="detail-group">
              {renderDetailItem(t("positionManagement.streetAddress"), position.streetAddress)}
              {renderDetailItem(t("positionManagement.city"), position.city)}
              {renderDetailItem(t("positionManagement.province"), position.province)}
              {renderDetailItem(t("positionManagement.postalCode"), position.postalCode)}
            </div>
          </div>

          <div className="employment-section section-card">
            <h2 className="section-title">{t("positionManagement.employmentCategorization")}</h2>
            <div className="detail-group">
              {renderDetailItem(t("positionManagement.employmentTerm"), position.employmentTerm)}
              {renderDetailItem(t("positionManagement.employmentType"), position.employmentType)}
              {renderDetailItem(t("positionManagement.positionCategory"), position.positionCategory)}
              {renderDetailItem(t("positionManagement.experience"), position.experience)}
            </div>
          </div>

          <div className="documents-section section-card">
            <h2 className="section-title">{t("positionManagement.documentsRequired")}</h2>
            <div className="detail-group">
              {renderDetailItem(
                t("positionManagement.documentsRequired"),
                position.documentsRequired
              )}
            </div>
          </div>

          <div className="position-details-section section-card">
            <h2 className="section-title">{t("positionManagement.positionDetailsSection")}</h2>
            <div className="detail-group">
              {renderDetailItem(t("positionManagement.payrateType"), position.payrateType)}
              {renderDetailItem(
                t("positionManagement.numberOfPositions"),
                position.numberOfPositions
              )}
              {renderDetailItem(t("positionManagement.regularPayRate"), position.regularPayRate)}
              {renderDetailItem(t("positionManagement.markup"), position.markup)}
              {renderDetailItem(t("positionManagement.billRate"), position.billRate)}
            </div>
          </div>

          <div className="overtime-section section-card">
            <h2 className="section-title">{t("positionManagement.overtime")}</h2>
            <div className="detail-group">
              {renderDetailItem(t("positionManagement.overtimeEnabled"), position.overtimeEnabled)}
              {position.overtimeEnabled && (
                <>
                  {renderDetailItem(t("positionManagement.overtimeHours"), position.overtimeHours)}
                  {renderDetailItem(
                    t("positionManagement.overtimeBillRate"),
                    position.overtimeBillRate
                  )}
                  {renderDetailItem(
                    t("positionManagement.overtimePayRate"),
                    position.overtimePayRate
                  )}
                </>
              )}
            </div>
          </div>

          <div className="payment-section section-card">
            <h2 className="section-title">{t("positionManagement.paymentBillings")}</h2>
            <div className="detail-group">
              {renderDetailItem(
                t("positionManagement.preferredPaymentMethod"),
                position.preferredPaymentMethod
              )}
              {renderDetailItem(t("positionManagement.terms"), position.terms)}
            </div>
          </div>

          <div className="notes-section section-card">
            <h2 className="section-title">{t("positionManagement.notes")}</h2>
            <div className="detail-group">
              {renderDetailItem(t("positionManagement.notes"), position.notes)}
            </div>
          </div>

          <div className="tasks-section section-card">
            <h2 className="section-title">{t("positionManagement.tasks")}</h2>
            <div className="detail-group">
              {renderDetailItem(t("positionManagement.assignedTo"), position.assignedTo)}
              {renderDetailItem(
                t("positionManagement.projectCompletionDate"),
                formatDate(position.projCompDate)
              )}
              {renderDetailItem(t("positionManagement.taskTime"), position.taskTime)}
            </div>
          </div>
        </div>
      </main>

      {showEditConfirmation && (
        <ConfirmationModal
          isOpen={showEditConfirmation}
          title={t("positionManagement.editPosition")}
          message={t("positionManagement.editPositionConfirm")}
          confirmText={t("buttons.edit")}
          cancelText={t("buttons.cancel")}
          onConfirm={() => {
            navigate(`/position-management/edit/${id}`);
          }}
          onCancel={() => {
            setShowEditConfirmation(false);
          }}
        />
      )}
    </div>
  );
}
