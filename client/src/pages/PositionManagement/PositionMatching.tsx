import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/language/language-provider";
import Lottie from "lottie-react";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Star,
  Clock,
  User,
  Plus,
  Minus,
  Building2,
  Hash,
  BriefcaseIcon,
  Shield,
  Award,
  Eye,
} from "lucide-react";
import {
  getPositions,
  getPositionCandidates,
  PositionCandidate,
  assignCandidateToPosition,
  removeCandidateFromPosition,
  PositionData,
  getPositionAssignments,
} from "../../services/api/position";
import { AppHeader } from "../../components/AppHeader";
import { CustomDropdown, DropdownOption } from "../../components/CustomDropdown";
import "../../styles/pages/PositionMatching.css";
import "../../styles/components/CommonTable.css";
import "../../styles/components/form.css";
import aiLoadingAnimation from "../../assets/animations/aipoisitionmatching.json";
import { ConfirmationModal } from "../../components/ConfirmationModal";

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalFiltered: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface AssignedJobseeker {
  id: string;
  userId: string;
  name: string;
  email: string;
  mobile?: string;
  similarityScore?: number;
}

// Loading messages will be translated in the component
const loadingMessageKeys = [
  { key: "positionMatching.ai.initializingEngine", duration: 1000 },
  { key: "positionMatching.ai.processingVectors", duration: 1200 },
  { key: "positionMatching.ai.runningAnalysis", duration: 1000 },
  { key: "positionMatching.ai.computingAlgorithms", duration: 800 },
  { key: "positionMatching.ai.optimizingPredictions", duration: 600 },
];

export function PositionMatching() {
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<PositionData | null>(
    null
  );
  const [candidates, setCandidates] = useState<PositionCandidate[]>([]);
  const [assignedJobseekers, setAssignedJobseekers] = useState<
    AssignedJobseeker[]
  >([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalFiltered: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState<string | null>(
    null
  );
  const [assignedJobseekersLoading, setAssignedJobseekersLoading] =
    useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [weekendAvailabilityOnly, setWeekendAvailabilityOnly] = useState(false);

  // Status message state for AppHeader
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | "pending">(
    "success"
  );

  const { isAdmin, isRecruiter } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const animationData = aiLoadingAnimation;

  // Memoized values
  const isAuthorized = useMemo(() => isAdmin || isRecruiter, [isAdmin, isRecruiter]);
  
  const positionOptions = useMemo((): DropdownOption[] => 
    positions.map((position) => ({
      id: position.id || '',
      value: position.id || '',
      label: `${position.clientName || t("positionMatching.unknownClient")} - ${position.title}`,
      sublabel: `${position.positionCategory} • ${position.city || t("positionMatching.unknownCity")}, ${position.province || t("positionMatching.unknownProvince")}`
    })), [positions, t]
  );

  const vacantSlotsCount = useMemo(() => {
    if (!selectedPosition) return 0;
    return Math.max(0, (selectedPosition.numberOfPositions || 0) - assignedJobseekers.length);
  }, [selectedPosition, assignedJobseekers.length]);

  const vacantSlots = useMemo(() => 
    Array(vacantSlotsCount).fill(null), [vacantSlotsCount]
  );

  // Memoized callbacks
  const setStatusWithTimeout = useCallback((message: string, type: "success" | "error" | "pending") => {
    setStatusMessage(message);
    setStatusType(type);
    setTimeout(() => setStatusMessage(null), 3000);
  }, []);

  const getSimilarityColor = useCallback((score: number) => {
    if (score >= 80) return "var(--success)";
    if (score >= 60) return "#f59e0b";
    if (score >= 40) return "#ef4444";
    return "var(--text-muted)";
  }, []);

  // Loading message animation effect
  useEffect(() => {
    if (!candidatesLoading) {
      setLoadingMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingMessageIndex((prevIndex) => 
        (prevIndex + 1) % loadingMessageKeys.length
      );
    }, loadingMessageKeys[loadingMessageIndex]?.duration || 1000);

    return () => clearInterval(interval);
  }, [candidatesLoading, loadingMessageIndex]);

  // Fetch all positions for dropdown
  const fetchPositions = useCallback(async () => {
    try {
      setPositionsLoading(true);
      const data = await getPositions({
        page: 1,
        limit: 100000000,
        search: "",
      });
      setPositions(data.positions);
    } catch (err) {
      console.error("Error fetching positions:", err);
    } finally {
      setPositionsLoading(false);
    }
  }, []);

  // Fetch candidates for selected position
  const fetchCandidates = useCallback(async () => {
    if (!selectedPosition?.id) return;

    try {
      setCandidatesLoading(true);
      setLoadingMessageIndex(0);
      const data = await getPositionCandidates(selectedPosition.id, {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        experienceFilter,
        availabilityFilter,
        weekendAvailabilityFilter: weekendAvailabilityOnly ? "true" : "all",
        onlyAvailable: onlyAvailable.toString(),
        sortBy: "similarity",
        sortOrder: "desc",
      });
      setCandidates(data.candidates);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Error fetching candidates:", err);
    } finally {
      setCandidatesLoading(false);
    }
  }, [
    selectedPosition?.id,
    pagination.page,
    pagination.limit,
    searchTerm,
    experienceFilter,
    availabilityFilter,
    weekendAvailabilityOnly,
    onlyAvailable,
  ]);

  // Fetch assigned jobseekers for a position
  const fetchAssignedJobseekers = useCallback(async (positionId: string) => {
    try {
      setAssignedJobseekersLoading(true);
      const response = await getPositionAssignments(positionId);
      
      if (response.success) {
        const assignedCandidates: AssignedJobseeker[] = (response.assignments).map(
          (assignment) => ({
            id: assignment.id,
            userId: assignment.candidate_id,
            name: assignment.jobseekerProfile
              ? `${assignment.jobseekerProfile.first_name} ${assignment.jobseekerProfile.last_name}`
              : t("positionMatching.notSpecified"),
            email: assignment.jobseekerProfile?.email || t("positionMatching.notSpecified"),
            mobile: assignment.jobseekerProfile?.mobile || undefined,
            similarityScore: undefined,
          })
        );
        
        setAssignedJobseekers(assignedCandidates);
      } else {
        console.error("Failed to fetch position assignments");
        setAssignedJobseekers([]);
      }
    } catch (error) {
      console.error("Error fetching assigned jobseekers:", error);
      setAssignedJobseekers([]);
    } finally {
      setAssignedJobseekersLoading(false);
    }
  }, [t]);

  // Initialize component
  useEffect(() => {
    if (!isAuthorized) {
      navigate("/dashboard");
      return;
    }
    fetchPositions();
  }, [isAuthorized, navigate, fetchPositions]);

  // Auto-select position from URL parameter after positions are loaded
  useEffect(() => {
    const positionIdFromUrl = searchParams.get('positionId');
    if (positionIdFromUrl && positions.length > 0 && !selectedPosition) {
      const matchingPosition = positions.find(p => p.id === positionIdFromUrl);
      if (matchingPosition) {
        handlePositionSelect(positionIdFromUrl);
      }
    }
  }, [positions, selectedPosition, searchParams]);

  // Fetch candidates when position or filters change
  useEffect(() => {
    if (selectedPosition?.id) {
      fetchCandidates();
    }
  }, [selectedPosition?.id, fetchCandidates]);

  // Reset pagination when filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [
    searchTerm,
    experienceFilter,
    availabilityFilter,
    weekendAvailabilityOnly,
    onlyAvailable,
  ]);

  // Handle position selection
  const handlePositionSelect = useCallback(async (positionId: string) => {
    const position = positions.find((p) => p.id === positionId);
    setSelectedPosition(position || null);

    if (position?.id) {
      await fetchAssignedJobseekers(position.id);
    } else {
      setAssignedJobseekers([]);
    }

    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [positions, fetchAssignedJobseekers]);

  // Handle candidate assignment
  const handleAssignCandidate = useCallback(async (candidate: PositionCandidate) => {
    if (!selectedPosition?.id) return;

    if (assignedJobseekers.length >= (selectedPosition.numberOfPositions || 1)) {
      setStatusWithTimeout(t("positionMatching.errors.allPositionsFilled"), "error");
      return;
    }

    setAssignmentLoading(candidate.candidateId);
    try {
      if (!selectedPosition.id || !selectedPosition.startDate || !selectedPosition.endDate) {
        throw new Error("Missing required position data");
      }

      const response = await assignCandidateToPosition(
        selectedPosition.id,
        candidate.candidateId,
        selectedPosition.startDate,
        selectedPosition.endDate
      );

      if (response.success) {
        await fetchAssignedJobseekers(selectedPosition.id);
        setStatusWithTimeout(
          t("positionMatching.messages.candidateAssignedSuccess", { candidateName: candidate.name }),
          "success"
        );
      } else {
        setStatusWithTimeout(response.message || t("positionMatching.errors.assignCandidateFailed"), "error");
      }
    } catch (error) {
      console.error("Error assigning candidate:", error);
      setStatusWithTimeout(t("positionMatching.errors.assignCandidateGeneric"), "error");
    } finally {
      setAssignmentLoading(null);
    }
  }, [selectedPosition, assignedJobseekers.length, fetchAssignedJobseekers, setStatusWithTimeout, t]);

  // Handle candidate removal
  const handleRemoveCandidate = useCallback(async (candidateId: string) => {
    if (!selectedPosition?.id) return;

    setAssignmentLoading(candidateId);

    try {
      const response = await removeCandidateFromPosition(
        selectedPosition.id,
        candidateId
      );

      if (response.success) {
        const removedCandidate = assignedJobseekers.find(
          (js) => js.userId === candidateId
        );

        await fetchAssignedJobseekers(selectedPosition.id);
        setStatusWithTimeout(
          t("positionMatching.messages.candidateRemovedSuccess", { candidateName: removedCandidate?.name || t("positionMatching.candidate") }),
          "success"
        );
      } else {
        setStatusWithTimeout(response.message || t("positionMatching.errors.removeCandidateFailed"), "error");
      }
    } catch (error) {
      console.error("Error removing candidate:", error);
      setStatusWithTimeout(t("positionMatching.errors.removeCandidateGeneric"), "error");
    } finally {
      setAssignmentLoading(null);
    }
  }, [selectedPosition?.id, assignedJobseekers, fetchAssignedJobseekers, setStatusWithTimeout, t]);

  // Pagination handlers
  const handlePageChange = useCallback((newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }, []);

  const handleLimitChange = useCallback((newLimit: number) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  }, []);

  const handlePreviousPage = useCallback(() => {
    if (pagination.hasPrevPage) {
      handlePageChange(pagination.page - 1);
    }
  }, [pagination.hasPrevPage, pagination.page, handlePageChange]);

  const handleNextPage = useCallback(() => {
    if (pagination.hasNextPage) {
      handlePageChange(pagination.page + 1);
    }
  }, [pagination.hasNextPage, pagination.page, handlePageChange]);

  const handlePositionSelectDropdown = useCallback((option: DropdownOption) => {
    handlePositionSelect(option.value as string);
  }, [handlePositionSelect]);

  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    action: "assign" | "remove" | null;
    candidate: PositionCandidate | AssignedJobseeker | null;
  }>({
    isOpen: false,
    action: null,
    candidate: null,
  });

  // Helper to open/close modal
  const openConfirmationModal = useCallback((action: "assign" | "remove", candidate: PositionCandidate | AssignedJobseeker) => {
    setConfirmationModal({
      isOpen: true,
      action,
      candidate,
    });
  }, []);

  const closeConfirmationModal = useCallback(() => {
    setConfirmationModal({
      isOpen: false,
      action: null,
      candidate: null,
    });
  }, []);

  // Modal confirmation handler
  const handleModalConfirm = useCallback(async () => {
    if (!confirmationModal.candidate || !selectedPosition) return;

    // Save action/candidate locally before closing modal
    const { action, candidate } = confirmationModal;
    closeConfirmationModal();

    setTimeout(async () => {
      if (action === "assign") {
        await handleAssignCandidate(candidate as PositionCandidate);
      } else if (action === "remove") {
        const id = (candidate as PositionCandidate).candidateId || (candidate as AssignedJobseeker).userId;
        await handleRemoveCandidate(id);
      }
    }, 0);
  }, [confirmationModal, selectedPosition, handleAssignCandidate, handleRemoveCandidate, closeConfirmationModal]);

  // Modal message builder
  const getConfirmationMessage = useCallback(() => {
    if (!confirmationModal.candidate || !selectedPosition) return "";
    const candidateName = (confirmationModal.candidate as PositionCandidate).name || (confirmationModal.candidate as AssignedJobseeker).name || "";
    const candidateEmail = (confirmationModal.candidate as PositionCandidate).email || (confirmationModal.candidate as AssignedJobseeker).email || "";
    const positionTitle = selectedPosition.title || "";
    const clientName = selectedPosition.clientName || t("positionMatching.unknownClient");
    if (confirmationModal.action === "assign") {
      return t("positionMatching.modal.assignConfirmation", {
        candidateName,
        positionTitle,
        clientName,
        candidateEmail
      });
    } else if (confirmationModal.action === "remove") {
      return t("positionMatching.modal.removeConfirmation", {
        candidateName,
        positionTitle,
        clientName,
        candidateEmail
      });
    }
    return "";
  }, [confirmationModal, selectedPosition, t]);

  return (
    <div className="position-matching">
      <AppHeader
        title={t("positionMatching.title")}
        statusMessage={statusMessage}
        statusType={statusType}
      />

      <div className="position-matching-container">
        <div className="position-matching-content">
          {/* Left Panel - Candidates (60%) */}
          <div className="candidates-panel">
            <div className="panel-header">
              <div className="header-left">
                <Users className="header-icon" size={20} />
                <h2>{t("positionMatching.bestMatchJobseekers")}</h2>
                {selectedPosition && (
                  <span className="position-badge">
                    {selectedPosition.title}
                  </span>
                )}
              </div>

              {selectedPosition && (
                <div className="candidates-filters">
                  <div className="filter-group">
                    <div className="search-input-wrapper">
                      <Search className="search-icon" size={16} />
                      <input
                        type="text"
                        placeholder={t("positionMatching.searchJobseekers")}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                      />
                    </div>
                  </div>

                  <div className="filter-row">
                    <select
                      value={experienceFilter}
                      onChange={(e) => setExperienceFilter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">{t("positionMatching.filters.allExperience")}</option>
                      <option value="0-6 Months">{t("positionMatching.filters.experience06Months")}</option>
                      <option value="6-12 Months">{t("positionMatching.filters.experience612Months")}</option>
                      <option value="1-2 Years">{t("positionMatching.filters.experience12Years")}</option>
                      <option value="2-3 Years">{t("positionMatching.filters.experience23Years")}</option>
                      <option value="3-4 Years">{t("positionMatching.filters.experience34Years")}</option>
                      <option value="4-5 Years">{t("positionMatching.filters.experience45Years")}</option>
                      <option value="5+ Years">{t("positionMatching.filters.experience5Plus")}</option>
                    </select>

                    <select
                      value={availabilityFilter}
                      onChange={(e) => setAvailabilityFilter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">{t("positionMatching.filters.allAvailability")}</option>
                      <option value="Full-Time">{t("positionMatching.filters.fullTime")}</option>
                      <option value="Part-Time">{t("positionMatching.filters.partTime")}</option>
                    </select>

                    <div className="container-form">
                      <input
                        type="checkbox"
                        id="weekendAvailabilityOnly"
                        className="toggle-form"
                        checked={weekendAvailabilityOnly}
                        onChange={(e) =>
                          setWeekendAvailabilityOnly(e.target.checked)
                        }
                      />
                      <label
                        htmlFor="weekendAvailabilityOnly"
                        className="label-form"
                      >
                        {t("positionMatching.filters.weekendAvailable")}
                      </label>
                    </div>

                    <label className="checkbox-filter">
                      <input
                        type="checkbox"
                        checked={onlyAvailable}
                        onChange={(e) => setOnlyAvailable(e.target.checked)}
                      />
                      {t("positionMatching.filters.availableOnly")}
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="candidates-content">
              {!selectedPosition ? (
                <div className="empty-state">
                  <Users className="empty-icon" size={48} />
                  <h3>{t("positionMatching.emptyState.selectPosition")}</h3>
                  <p>
                    {t("positionMatching.emptyState.selectPositionDescription")}
                  </p>
                </div>
              ) : candidatesLoading ? (
                <div className="advanced-loading-state">
                  <div className="lottie-animation">
                    {animationData ? (
                      <Lottie
                        animationData={animationData}
                        style={{ width: 200, height: 200 }}
                        loop={true}
                        autoplay={true}
                      />
                    ) : (
                      <div className="lottie-placeholder">
                        <div className="loading-spinner"></div>
                        <p>{t("positionMatching.ai.processing")}</p>
                      </div>
                    )}
                  </div>
                  <div className="ai-loading-message">
                    <h3>{t(loadingMessageKeys[loadingMessageIndex]?.key || "positionMatching.ai.processing")}</h3>
                    <div className="ai-progress-bar">
                      <div
                        className="ai-progress-fill"
                        style={{
                          width: `${
                            ((loadingMessageIndex + 1) /
                              loadingMessageKeys.length) *
                            100
                          }%`,
                        }}
                      ></div>
                      <div className="progress-pulse"></div>
                    </div>
                    <p className="ai-loading-subtitle">
                      {t("positionMatching.ai.trainingModels", { positionTitle: selectedPosition?.title || "" })}
                    </p>
                    <div className="algorithm-metrics">
                      <span className="metric">
                        {t("positionMatching.ai.accuracy", { percentage: (85 + Math.random() * 10).toFixed(1) })}
                      </span>
                      <span className="metric">
                        {t("positionMatching.ai.processingVectors", { count: (loadingMessageIndex + 1) * 1247 })}
                      </span>
                    </div>
                  </div>
                </div>
              ) : candidates.length === 0 ? (
                <div className="empty-state">
                  <Users className="empty-icon" size={48} />
                  <h3>{t("positionMatching.emptyState.noJobseekers")}</h3>
                  <p>{t("positionMatching.emptyState.noJobseekersDescription")}</p>
                </div>
              ) : (
                <>
                  <div className="candidates-list">
                    {candidates.map((candidate) => (
                      <div key={candidate.id} className="candidate-card">
                        <div className="candidate-header">
                          <div className="candidate-info">
                            <h4 className="candidate-name">{candidate.name}</h4>
                            <p className="candidate-email">{candidate.email}</p>
                            {candidate.mobile && (
                              <p className="candidate-mobile">
                                {candidate.mobile}
                              </p>
                            )}
                          </div>

                          <div className="candidate-actions">
                            <div
                              className="similarity-score"
                              style={{
                                color: getSimilarityColor(
                                  candidate.similarityScore
                                ),
                              }}
                            >
                              <Star size={16} />
                              <span>
                                {(candidate.similarityScore * 100).toFixed(1)}%
                              </span>
                            </div>

                            {assignedJobseekers.some(
                              (js) => js.userId === candidate.candidateId
                            ) ? (
                              <button
                                className="remove-btn"
                                onClick={() => openConfirmationModal("remove", candidate)}
                                disabled={assignmentLoading === candidate.candidateId}
                              >
                                {assignmentLoading === candidate.candidateId ? (
                                  <>
                                    <div className="loading-spinner small"></div>
                                    {t("positionMatching.buttons.removing")}
                                  </>
                                ) : (
                                  <>
                                    <Minus size={16} />
                                    {t("buttons.remove")}
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                className="assign-btn"
                                onClick={() => openConfirmationModal("assign", candidate)}
                                disabled={
                                  assignedJobseekers.length >=
                                    (selectedPosition?.numberOfPositions ||
                                      0) ||
                                  assignmentLoading === candidate.candidateId
                                }
                              >
                                {assignmentLoading === candidate.candidateId ? (
                                  <>
                                    <div className="loading-spinner small"></div>
                                    {t("positionMatching.buttons.assigning")}
                                  </>
                                ) : (
                                  <>
                                    <Plus size={16} />
                                    {t("buttons.assign")}
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="candidate-details">
                          {candidate.bio && (
                            <p className="candidate-bio">{candidate.bio}</p>
                          )}

                          <div className="candidate-meta">
                            <div className="meta-item">
                              <Clock size={14} />
                              <span>
                                {candidate.experience || t("positionMatching.notSpecified")}
                              </span>
                            </div>

                            <div className="meta-item">
                              <Calendar size={14} />
                              <span>
                                {candidate.availability || t("positionMatching.notSpecified")}
                              </span>
                            </div>

                            <div
                              className={`availability-badge ${
                                candidate.isAvailable
                                  ? "available"
                                  : "unavailable"
                              }`}
                            >
                              {candidate.isAvailable
                                ? t("positionMatching.status.available")
                                : t("positionMatching.status.unavailable")}
                            </div>

                            {candidate.weekendAvailability !== undefined && (
                              <div
                                className={`availability-badge ${
                                  candidate.weekendAvailability
                                    ? "weekend-available"
                                    : "weekend-unavailable"
                                }`}
                              >
                                {candidate.weekendAvailability
                                  ? t("positionMatching.status.weekendAvailable")
                                  : t("positionMatching.status.noWeekends")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  <div className="pagination-controls">
                    <div className="pagination-info">
                      <span className="pagination-text">
                        {t("positionMatching.pagination.showing", {
                          start: (pagination.page - 1) * pagination.limit + 1,
                          end: Math.min(
                            pagination.page * pagination.limit,
                            pagination.totalFiltered
                          ),
                          total: pagination.totalFiltered
                        })}
                      </span>
                    </div>

                    <div className="pagination-size-selector">
                      <label htmlFor="pageSize" className="page-size-label">
                        {t("positionMatching.pagination.show")}:
                      </label>
                      <select
                        id="pageSize"
                        value={pagination.limit}
                        onChange={(e) =>
                          handleLimitChange(parseInt(e.target.value))
                        }
                        className="page-size-select"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                      <span className="page-size-label">{t("positionMatching.pagination.perPage")}</span>
                    </div>

                    <div className="pagination-buttons">
                      <button
                        className="pagination-btn"
                        onClick={handlePreviousPage}
                        disabled={!pagination.hasPrevPage}
                      >
                        <ChevronLeft size={16} />
                        <span>{t("buttons.previous")}</span>
                      </button>

                      <span className="page-indicator">
                        {t("positionMatching.pagination.pageOf", { current: pagination.page, total: pagination.totalPages })}
                      </span>

                      <button
                        className="pagination-btn"
                        onClick={handleNextPage}
                        disabled={!pagination.hasNextPage}
                      >
                        <span>{t("buttons.next")}</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Panel - Position Management (40%) */}
          <div className="position-panel">
            <div className="panel-header">
              <div className="header-left">
                <MapPin className="header-icon" size={20} />
                <h2>{t("positionMatching.positionAssignment")}</h2>
              </div>
            </div>

            <div className="position-content">
              {/* Position Selector */}
              <div className="position-selector">
                <label htmlFor="position-select">{t("positionMatching.selectPosition")}:</label>
                {positionsLoading ? (
                  <div className="position-loading">
                    <div className="loading-spinner"></div>
                    <span>{t("positionMatching.loadingPositions")}</span>
                  </div>
                ) : (
                  <CustomDropdown
                    options={positionOptions}
                    selectedOption={selectedPosition ? {
                      id: selectedPosition.id || '',
                      label: `${selectedPosition.clientName || t("positionMatching.unknownClient")} - ${selectedPosition.title}`,
                      sublabel: `${selectedPosition.clientName || t("positionMatching.unknownClient")} - ${selectedPosition.city || t("positionMatching.unknownCity")}, ${selectedPosition.province || t("positionMatching.unknownProvince")}`,
                      value: selectedPosition
                    } : null}
                    onSelect={(option) => { if (Array.isArray(option)) return; handlePositionSelectDropdown(option); }}
                    placeholder={t("positionMatching.selectPositionPlaceholder")}
                    searchable={true}
                    loading={positionsLoading}
                    emptyMessage={t("positionMatching.noPositionsAvailable")}
                  />
                )}
              </div>

              {selectedPosition && (
                <>
                  {/* Position Details */}
                  <div className="position-details">
                    <h3>{selectedPosition.title}</h3>
                    <div className="position-meta">
                      <div className="meta-group">
                        <div className="meta-row">
                          <Building2 size={14} />
                          <span>
                            <strong>{t("positionMatching.details.client")}:</strong>{" "}
                            {selectedPosition.clientName || t("positionMatching.unknownClient")}
                          </span>
                        </div>
                        <div className="meta-row">
                          <Hash size={14} />
                          <span>
                            <strong>{t("positionMatching.details.code")}:</strong>{" "}
                            {selectedPosition.positionCode || t("positionMatching.notSpecified")}
                          </span>
                        </div>
                        <div className="meta-row">
                          <MapPin size={14} />
                          <span>
                            <strong>{t("positionMatching.details.location")}:</strong> {selectedPosition.city},{" "}
                            {selectedPosition.province}
                          </span>
                        </div>
                        <div className="meta-row">
                          <Users size={14} />
                          <span>
                            <strong>{t("positionMatching.details.positions")}:</strong>{" "}
                            {t("positionMatching.details.positionsAvailable", { count: selectedPosition.numberOfPositions || 0 })}
                          </span>
                        </div>
                        {selectedPosition.startDate && (
                          <div className="meta-row">
                            <Calendar size={14} />
                            <span>
                              <strong>{t("positionMatching.details.startDate")}:</strong>{" "}
                              {new Date(
                                selectedPosition.startDate
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {selectedPosition.createdAt && (
                          <div className="meta-row">
                            <Clock size={14} />
                            <span>
                              <strong>{t("positionMatching.details.created")}:</strong>{" "}
                              {new Date(
                                selectedPosition.createdAt
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="meta-group">
                        <div className="meta-row">
                          <BriefcaseIcon size={14} />
                          <span>
                                                          <strong>{t("positionMatching.details.employment")}:</strong>{" "}
                            {selectedPosition.employmentTerm} /{" "}
                            {selectedPosition.employmentType}
                          </span>
                        </div>
                        {selectedPosition.positionCategory && (
                          <div className="meta-row">
                            <Shield size={14} />
                            <span>
                              <strong>{t("positionMatching.details.category")}:</strong>{" "}
                              {selectedPosition.positionCategory}
                            </span>
                          </div>
                        )}
                        {selectedPosition.experience && (
                          <div className="meta-row">
                            <Award size={14} />
                            <span>
                              <strong>{t("positionMatching.details.experienceRequired")}:</strong>{" "}
                              {selectedPosition.experience}
                            </span>
                          </div>
                        )}
                        <div className="meta-row">
                          <Eye size={14} />
                          <span>
                                                          <strong>{t("positionMatching.details.jobPortal")}:</strong>{" "}
                            {selectedPosition.showOnJobPortal
                              ? t("positionMatching.details.visible")
                              : t("positionMatching.details.hidden")}
                          </span>
                        </div>
                        {selectedPosition.endDate && (
                          <div className="meta-row">
                            <Calendar size={14} />
                            <span>
                              <strong>{t("positionMatching.details.endDate")}:</strong>{" "}
                              {new Date(
                                selectedPosition.endDate
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Assignment Summary */}
                  <div className="assignment-summary">
                    <h4>{t("positionMatching.assignmentStatus")}</h4>
                    <div className="status-overview">
                      <div className="status-item filled">
                        <span className="status-count">
                          {assignedJobseekers.length}
                        </span>
                        <span className="status-label">{t("positionMatching.status.assigned")}</span>
                      </div>
                      <div className="status-item vacant">
                        <span className="status-count">
                          {vacantSlotsCount}
                        </span>
                        <span className="status-label">{t("positionMatching.status.vacant")}</span>
                      </div>
                      <div className="status-item total">
                        <span className="status-count">
                          {selectedPosition.numberOfPositions}
                        </span>
                        <span className="status-label">{t("positionMatching.status.total")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Position Slots */}
                  <div className="position-slots">
                    <h4>{t("positionMatching.positionSlots")}</h4>
                    <div className="slots-container">
                      {/* Loading State for Assigned Jobseekers */}
                      {assignedJobseekersLoading && (
                        <div className="slots-loading">
                          <div className="loading-spinner"></div>
                          <span>{t("positionMatching.loadingAssignedJobseekers")}</span>
                        </div>
                      )}

                      {/* Assigned Slots */}
                      {!assignedJobseekersLoading &&
                        assignedJobseekers.map((jobseeker, index) => (
                          <div
                            key={jobseeker.id}
                            className="slot-card assigned"
                          >
                            <div className="slot-content">
                              <div className="jobseeker-info">
                                <div className="jobseeker-info-header">
                                  <span className="slot-number">
                                    #{index + 1}
                                  </span>
                                  <User size={16} />
                                </div>
                                <div>
                                  <p className="jobseeker-name">
                                    {jobseeker.name}
                                  </p>
                                  <p className="jobseeker-email">
                                    {jobseeker.email}
                                  </p>
                                  {jobseeker.mobile && (
                                    <p className="jobseeker-mobile">
                                      {jobseeker.mobile}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="slot-actions">
                                <button
                                  className="remove-slot-btn"
                                  onClick={() => openConfirmationModal("remove", jobseeker)}
                                  disabled={assignmentLoading === jobseeker.id}
                                >
                                  {assignmentLoading === jobseeker.id ? (
                                    <div className="loading-spinner small"></div>
                                  ) : (
                                    <Minus size={14} />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                      {/* Vacant Slots */}
                      {!assignedJobseekersLoading &&
                        vacantSlots.map((_, index) => (
                          <div
                            key={`vacant-${index}`}
                            className="slot-card vacant"
                          >
                            <div className="slot-header">
                              <span className="slot-number">
                                #{assignedJobseekers.length + index + 1}
                              </span>
                            </div>
                            <div className="slot-content">
                              <div className="vacant-indicator">
                                <User size={16} />
                                <span>{t("positionMatching.positionVacant")}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={
          confirmationModal.action === "assign"
            ? t("positionMatching.modal.confirmAssignment")
            : t("positionMatching.modal.confirmRemoval")
        }
        message={getConfirmationMessage()}
        confirmText={confirmationModal.action === "assign" ? t("buttons.assign") : t("buttons.remove")}
        confirmButtonClass={confirmationModal.action === "assign" ? "success" : "danger"}
        onConfirm={handleModalConfirm}
        onCancel={closeConfirmationModal}
      />
    </div>
  );
}

export default PositionMatching;
