import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
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
} from "../services/api/position";
import { getJobseekerProfile } from "../services/api/jobseeker";
import { AppHeader } from "../components/AppHeader";
import { CustomDropdown, DropdownOption } from "../components/CustomDropdown";
import "../styles/pages/PositionMatching.css";
import "../styles/components/CommonTable.css";
import "../styles/components/form.css";
import aiLoadingAnimation from "../assets/animations/aipoisitionmatching.json";

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

const loadingMessages = [
  { text: "🧠 Initializing AI matching engine...", duration: 1000 },
  { text: "🔬 Processing candidate data vectors...", duration: 1200 },
  { text: "⚡ Running neural network analysis...", duration: 1000 },
  { text: "🎯 Computing similarity algorithms...", duration: 800 },
  { text: "🚀 Optimizing match predictions...", duration: 600 },
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const animationData = aiLoadingAnimation; // Replace with your animation JSON data

  // Loading message animation effect
  useEffect(() => {
    if (!candidatesLoading) {
      setLoadingMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingMessageIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % loadingMessages.length;
        return nextIndex;
      });
    }, loadingMessages[loadingMessageIndex]?.duration || 1000);

    return () => clearInterval(interval);
  }, [candidatesLoading, loadingMessageIndex]);

  // Fetch all positions for dropdown
  const fetchPositions = useCallback(async () => {
    try {
      setPositionsLoading(true);
      const data = await getPositions({
        page: 1,
        limit: 1000, // Get all positions for dropdown
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

  // Initialize component
  useEffect(() => {
    if (!isAdmin && !isRecruiter) {
      navigate("/dashboard");
      return;
    }
    fetchPositions();
  }, [isAdmin, isRecruiter, navigate, fetchPositions]);

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
  const handlePositionSelect = async (positionId: string) => {
    const position = positions.find((p) => p.id === positionId);
    setSelectedPosition(position || null);

    // Initialize assigned jobseekers from position data
    if (
      position &&
      position.assignedJobseekers &&
      position.assignedJobseekers.length > 0
    ) {
      setAssignedJobseekersLoading(true);
      try {
        // Fetch full jobseeker details for each assigned candidate
        const assignedCandidatesPromises = position.assignedJobseekers.map(
          async (id) => {
            try {
              const jobseekerProfile = await getJobseekerProfile(id);
              return {
                id: jobseekerProfile.id,
                userId: jobseekerProfile.userId,
                name:
                  jobseekerProfile.firstName + " " + jobseekerProfile.lastName,
                email: jobseekerProfile.email,
                mobile: jobseekerProfile.mobile || undefined,
                similarityScore: undefined, // Not available from profile data
              };
            } catch (error) {
              console.error(
                `Error fetching jobseeker profile for ID ${id}:`,
                error
              );
              // Return a fallback object if the fetch fails
              return {
                id,
                userId: id,
                name: "Profile Not Found",
                email: "N/A",
                mobile: undefined,
                similarityScore: undefined,
              };
            }
          }
        );

        const assignedCandidates = await Promise.all(
          assignedCandidatesPromises
        );
        setAssignedJobseekers(assignedCandidates);
      } catch (error) {
        console.error("Error fetching assigned jobseekers:", error);
        // Set empty array if there's an error
        setAssignedJobseekers([]);
      } finally {
        setAssignedJobseekersLoading(false);
      }
    } else {
      setAssignedJobseekers([]);
    }

    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Handle candidate assignment
  const handleAssignCandidate = async (candidate: PositionCandidate) => {
    console.log(selectedPosition);
    if (!selectedPosition?.id) return;

    // Check if all positions are filled
    if (
      assignedJobseekers.length >= (selectedPosition.numberOfPositions || 1)
    ) {
      setStatusMessage("All positions are filled for this role");
      setStatusType("error");
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    setAssignmentLoading(candidate.candidateId);
    try {
      if (
        !selectedPosition.id ||
        !selectedPosition.startDate ||
        !selectedPosition.endDate
      ) {
        throw new Error("Missing required position data");
      }

      const response = await assignCandidateToPosition(
        selectedPosition.id,
        candidate.candidateId,
        selectedPosition.startDate,
        selectedPosition.endDate
      );

      if (response.success) {
        // Update the local assigned jobseekers state
        const newAssignedCandidate = {
          userId: candidate.candidateId,
          id: candidate.candidateId,
          name: candidate.name,
          email: candidate.email,
          mobile: candidate.mobile,
          similarityScore: candidate.similarityScore,
        };
        setAssignedJobseekers((prev) => [...prev, newAssignedCandidate]);

        // Update the selected position data
        // if (response.position) {
        //   setSelectedPosition(response.position);
        // }

        // Show success message
        setStatusMessage(
          `${candidate.name} has been successfully assigned to the position`
        );
        setStatusType("success");
        setTimeout(() => setStatusMessage(null), 3000);

        // Optional: Refresh positions list to sync any changes
        // This would trigger a re-fetch of positions
      } else {
        setStatusMessage(response.message || "Failed to assign candidate");
        setStatusType("error");
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (error) {
      console.error("Error assigning candidate:", error);
      setStatusMessage("Failed to assign candidate. Please try again.");
      setStatusType("error");
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setAssignmentLoading(null);
    }
  };

  // Handle candidate removal
  const handleRemoveCandidate = async (candidateId: string) => {
    if (!selectedPosition?.id) return;

    setAssignmentLoading(candidateId);

    try {
      const response = await removeCandidateFromPosition(
        selectedPosition.id,
        candidateId
      );

      if (response.success) {
        // Get the candidate name before removing
        const removedCandidate = assignedJobseekers.find(
          (js) => js.userId === candidateId
        );

        // Remove the candidate from local state
        setAssignedJobseekers((prev) =>
          prev.filter((jobseeker) => jobseeker.userId !== candidateId)
        );

        // Update the selected position data
        // if (response.position) {
        //   setSelectedPosition(response.position);
        // }

        // Show success message
        setStatusMessage(
          `${
            removedCandidate?.name || "Candidate"
          } has been successfully removed from the position`
        );
        setStatusType("success");
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage(response.message || "Failed to remove candidate");
        setStatusType("error");
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (error) {
      console.error("Error removing candidate:", error);
      setStatusMessage("Failed to remove candidate. Please try again.");
      setStatusType("error");
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setAssignmentLoading(null);
    }
  };

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const handlePreviousPage = () => {
    if (pagination.hasPrevPage) {
      handlePageChange(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      handlePageChange(pagination.page + 1);
    }
  };

  // Create position options for CustomDropdown
  const positionOptions: DropdownOption[] = positions.map((position) => ({
    id: position.id || '',
    value: position.id || '',
    label: `${position.clientName || 'Unknown Client'} - ${position.title}`,
    sublabel: `${position.positionCategory} • ${position.city}, ${position.province}`
  }));

  // Handle position selection for CustomDropdown
  const handlePositionSelectDropdown = (option: DropdownOption) => {
    handlePositionSelect(option.value as string);
  };

  // Get similarity score color
  const getSimilarityColor = (score: number) => {
    if (score >= 80) return "var(--success)";
    if (score >= 60) return "#f59e0b"; // amber
    if (score >= 40) return "#ef4444"; // red
    return "var(--text-muted)";
  };

  // Generate vacant slots
  const generateVacantSlots = () => {
    const totalPositions = selectedPosition?.numberOfPositions || 0;
    const filledSlots = assignedJobseekers.length;
    const vacantCount = Math.max(0, totalPositions - filledSlots);

    return Array(vacantCount).fill(null);
  };

  return (
    <div className="position-matching">
      <AppHeader
        title="Position Matching"
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
                <h2>Best Match Jobseekers</h2>
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
                        placeholder="Search jobseekers..."
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
                      <option value="all">All Experience</option>
                      <option value="0-6 Months">0-6 Months</option>
                      <option value="6-12 Months">6-12 Months</option>
                      <option value="1-2 Years">1-2 Years</option>
                      <option value="2-3 Years">2-3 Years</option>
                      <option value="3-4 Years">3-4 Years</option>
                      <option value="4-5 Years">4-5 Years</option>
                      <option value="5+ Years">5+ Years</option>
                    </select>

                    <select
                      value={availabilityFilter}
                      onChange={(e) => setAvailabilityFilter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">All Availability</option>
                      <option value="Full-Time">Full-Time</option>
                      <option value="Part-Time">Part-Time</option>
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
                        Weekend Available
                      </label>
                    </div>

                    <label className="checkbox-filter">
                      <input
                        type="checkbox"
                        checked={onlyAvailable}
                        onChange={(e) => setOnlyAvailable(e.target.checked)}
                      />
                      Available Only
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="candidates-content">
              {!selectedPosition ? (
                <div className="empty-state">
                  <Users className="empty-icon" size={48} />
                  <h3>Select a Position</h3>
                  <p>
                    Choose a position from the dropdown to view matching
                    Jobseekers
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
                        <p>AI Processing</p>
                      </div>
                    )}
                  </div>
                  <div className="ai-loading-message">
                    <h3>{loadingMessages[loadingMessageIndex]?.text}</h3>
                    <div className="ai-progress-bar">
                      <div
                        className="ai-progress-fill"
                        style={{
                          width: `${
                            ((loadingMessageIndex + 1) /
                              loadingMessages.length) *
                            100
                          }%`,
                        }}
                      ></div>
                      <div className="progress-pulse"></div>
                    </div>
                    <p className="ai-loading-subtitle">
                      Training models on {selectedPosition?.title} parameters...
                    </p>
                    <div className="algorithm-metrics">
                      <span className="metric">
                        Accuracy: {(85 + Math.random() * 10).toFixed(1)}%
                      </span>
                      <span className="metric">
                        Processing: {(loadingMessageIndex + 1) * 1247} vectors
                      </span>
                    </div>
                  </div>
                </div>
              ) : candidates.length === 0 ? (
                <div className="empty-state">
                  <Users className="empty-icon" size={48} />
                  <h3>No Jobseekers Found</h3>
                  <p>No jobseekers match the current filters</p>
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
                              (js) => js.id === candidate.candidateId
                            ) ? (
                              <button
                                className="remove-btn"
                                onClick={() =>
                                  handleRemoveCandidate(candidate.candidateId)
                                }
                                disabled={
                                  assignmentLoading === candidate.candidateId
                                }
                              >
                                {assignmentLoading === candidate.candidateId ? (
                                  <>
                                    <div className="loading-spinner small"></div>
                                    Removing...
                                  </>
                                ) : (
                                  <>
                                    <Minus size={16} />
                                    Remove
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                className="assign-btn"
                                onClick={() => handleAssignCandidate(candidate)}
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
                                    Assigning...
                                  </>
                                ) : (
                                  <>
                                    <Plus size={16} />
                                    Assign
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
                                {candidate.experience || "Not specified"}
                              </span>
                            </div>

                            <div className="meta-item">
                              <Calendar size={14} />
                              <span>
                                {candidate.availability || "Not specified"}
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
                                ? "Available"
                                : "Unavailable"}
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
                                  ? "Weekend Available"
                                  : "No Weekends"}
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
                        Showing {(pagination.page - 1) * pagination.limit + 1}{" "}
                        to{" "}
                        {Math.min(
                          pagination.page * pagination.limit,
                          pagination.totalFiltered
                        )}{" "}
                        of {pagination.totalFiltered} jobseekers
                      </span>
                    </div>

                    <div className="pagination-size-selector">
                      <label htmlFor="pageSize" className="page-size-label">
                        Show:
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
                      <span className="page-size-label">per page</span>
                    </div>

                    <div className="pagination-buttons">
                      <button
                        className="pagination-btn"
                        onClick={handlePreviousPage}
                        disabled={!pagination.hasPrevPage}
                      >
                        <ChevronLeft size={16} />
                        <span>Previous</span>
                      </button>

                      <span className="page-indicator">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>

                      <button
                        className="pagination-btn"
                        onClick={handleNextPage}
                        disabled={!pagination.hasNextPage}
                      >
                        <span>Next</span>
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
                <h2>Position Assignment</h2>
              </div>
            </div>

            <div className="position-content">
              {/* Position Selector */}
              <div className="position-selector">
                <label htmlFor="position-select">Select Position:</label>
                {positionsLoading ? (
                  <div className="position-loading">
                    <div className="loading-spinner"></div>
                    <span>Loading positions...</span>
                  </div>
                ) : (
                  <CustomDropdown
                    options={positionOptions}
                    selectedOption={selectedPosition ? {
                      id: selectedPosition.id || '',
                      label: selectedPosition.title || 'Untitled Position',
                      sublabel: `${selectedPosition.clientName || 'Unknown Client'} - ${selectedPosition.city || 'Unknown City'}, ${selectedPosition.province || 'Unknown Province'}`,
                      value: selectedPosition
                    } : null}
                    onSelect={handlePositionSelectDropdown}
                    placeholder="Select a position..."
                    searchable={true}
                    loading={positionsLoading}
                    emptyMessage="No positions available"
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
                            <strong>Client:</strong>{" "}
                            {selectedPosition.clientName || "N/A"}
                          </span>
                        </div>
                        <div className="meta-row">
                          <Hash size={14} />
                          <span>
                            <strong>Code:</strong>{" "}
                            {selectedPosition.positionCode || "N/A"}
                          </span>
                        </div>
                        <div className="meta-row">
                          <MapPin size={14} />
                          <span>
                            <strong>Location:</strong> {selectedPosition.city},{" "}
                            {selectedPosition.province}
                          </span>
                        </div>
                        <div className="meta-row">
                          <Users size={14} />
                          <span>
                            <strong>Positions:</strong>{" "}
                            {selectedPosition.numberOfPositions} available
                          </span>
                        </div>
                        {selectedPosition.startDate && (
                          <div className="meta-row">
                            <Calendar size={14} />
                            <span>
                              <strong>Start Date:</strong>{" "}
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
                              <strong>Created:</strong>{" "}
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
                            <strong>Employment:</strong>{" "}
                            {selectedPosition.employmentTerm} /{" "}
                            {selectedPosition.employmentType}
                          </span>
                        </div>
                        {selectedPosition.positionCategory && (
                          <div className="meta-row">
                            <Shield size={14} />
                            <span>
                              <strong>Category:</strong>{" "}
                              {selectedPosition.positionCategory}
                            </span>
                          </div>
                        )}
                        {selectedPosition.experience && (
                          <div className="meta-row">
                            <Award size={14} />
                            <span>
                              <strong>Experience Required:</strong>{" "}
                              {selectedPosition.experience}
                            </span>
                          </div>
                        )}
                        <div className="meta-row">
                          <Eye size={14} />
                          <span>
                            <strong>Job Portal:</strong>{" "}
                            {selectedPosition.showOnJobPortal
                              ? "Visible"
                              : "Hidden"}
                          </span>
                        </div>
                        {selectedPosition.endDate && (
                          <div className="meta-row">
                            <Calendar size={14} />
                            <span>
                              <strong>End Date:</strong>{" "}
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
                    <h4>Assignment Status</h4>
                    <div className="status-overview">
                      <div className="status-item filled">
                        <span className="status-count">
                          {assignedJobseekers.length}
                        </span>
                        <span className="status-label">Assigned</span>
                      </div>
                      <div className="status-item vacant">
                        <span className="status-count">
                          {Math.max(
                            0,
                            (selectedPosition.numberOfPositions || 0) -
                              assignedJobseekers.length
                          )}
                        </span>
                        <span className="status-label">Vacant</span>
                      </div>
                      <div className="status-item total">
                        <span className="status-count">
                          {selectedPosition.numberOfPositions}
                        </span>
                        <span className="status-label">Total</span>
                      </div>
                    </div>
                  </div>

                  {/* Position Slots */}
                  <div className="position-slots">
                    <h4>Position Slots</h4>
                    <div className="slots-container">
                      {/* Loading State for Assigned Jobseekers */}
                      {assignedJobseekersLoading && (
                        <div className="slots-loading">
                          <div className="loading-spinner"></div>
                          <span>Loading assigned jobseekers...</span>
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
                                  onClick={() =>
                                    handleRemoveCandidate(jobseeker.userId)
                                  }
                                  disabled={assignmentLoading === jobseeker.id}
                                  title={
                                    assignmentLoading === jobseeker.id
                                      ? "Removing..."
                                      : "Remove candidate"
                                  }
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
                        generateVacantSlots().map((_, index) => (
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
                                <span>Position Vacant</span>
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
    </div>
  );
}

export default PositionMatching;
