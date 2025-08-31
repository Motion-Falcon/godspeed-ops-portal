import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Crown,
  GitBranch,
  ChevronDown,
  ChevronRight,
  User,
} from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { useLanguage } from "../contexts/language/language-provider";
import { useAuth } from "../contexts/AuthContext";
import { getAllAuthUsersAPI } from "../services/api/user";
import type { AllAuthUserListItem } from "../types/auth";
import "../styles/pages/RecruiterHierarchy.css";

type RawHierarchy = {
  manager_id?: string;
  org_id?: string;
  team_id?: string;
  level?: number;
};
type RawMeta = {
  hierarchy?: RawHierarchy;
  [key: string]: unknown;
};
type RawContainer = {
  user_metadata?: RawMeta;
  raw_user_meta_data?: RawMeta;
  [key: string]: unknown;
};

export function RecruiterHierarchy() {
  const { t } = useLanguage();
  const { user, isAdmin, isRecruiter } = useAuth();
  const [admins, setAdmins] = useState<AllAuthUserListItem[]>([]);
  const [recruiters, setRecruiters] = useState<AllAuthUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const currentRecruiterRef = useRef<HTMLDivElement | null>(null);

  const extractManagerId = useCallback(
    (u: AllAuthUserListItem): string | null => {
      try {
        const raw = (u.raw || {}) as RawContainer;
        const meta = (raw.user_metadata || raw.raw_user_meta_data) as
          | RawMeta
          | undefined;
        const mgr = meta?.hierarchy?.manager_id;
        if (typeof mgr === "string" && mgr.length > 0) return mgr;
        return null;
      } catch {
        return null;
      }
    },
    []
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [adminsResp, recruitersResp] = await Promise.all([
        getAllAuthUsersAPI({ userTypeFilter: "admin", limit: 1000, page: 1 }),
        getAllAuthUsersAPI({
          userTypeFilter: "recruiter",
          limit: 10000,
          page: 1,
        }),
      ]);
      setAdmins(adminsResp.users || []);
      setRecruiters(recruitersResp.users || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.unexpectedError");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isAdmin && !isRecruiter) {
      setLoading(false);
      return;
    }
    fetchUsers();
  }, [isAdmin, isRecruiter, fetchUsers]);

  // Create a hierarchical structure for accordion-style organization chart
  const organizationStructure = useMemo(() => {
    // Build complete node map
    const allPeople: Record<string, AllAuthUserListItem> = {};
    admins.forEach((a) => allPeople[a.id] = a);
    recruiters.forEach((r) => allPeople[r.id] = r);

    // Group by manager
    const managersToReports: Record<string, AllAuthUserListItem[]> = {};
    
    // Add all people under their managers
    [...admins, ...recruiters].forEach((person) => {
      const managerId = extractManagerId(person);
      if (managerId && allPeople[managerId]) {
        if (!managersToReports[managerId]) {
          managersToReports[managerId] = [];
        }
        managersToReports[managerId].push(person);
      }
    });

    // Create the hierarchical structure
    const structure: Array<{ manager: AllAuthUserListItem; reports: AllAuthUserListItem[] }> = [];
    
    // Add admins first (top level)
    admins.forEach((admin) => {
      structure.push({
        manager: admin,
        reports: managersToReports[admin.id] || []
      });
    });

    // Add any orphaned recruiters (those without valid managers)
    recruiters.forEach((recruiter) => {
      const managerId = extractManagerId(recruiter);
      if (!managerId || !allPeople[managerId]) {
        structure.push({
          manager: recruiter,
          reports: managersToReports[recruiter.id] || []
        });
      }
    });

    return { structure, managersToReports, allPeople };
  }, [admins, recruiters, extractManagerId]);

  // Determine which sections should be expanded based on user role
  useEffect(() => {
    if (loading || organizationStructure.structure.length === 0) return;

    const newExpandedSections = new Set<string>();

    if (isAdmin) {
      // Admins see only Level 1 (top-level admin reports) expanded by default
      organizationStructure.structure.forEach(({ manager }) => {
        newExpandedSections.add(manager.id);
      });
      
      // DO NOT expand nested levels - keep them collapsed until manually expanded
    } else if (isRecruiter && user?.id) {
      // Expand the hierarchy path for the current recruiter: all ancestor managers and the recruiter's own section if they manage others
      const currentUser = organizationStructure.allPeople[user.id];
      if (currentUser) {
        const visited = new Set<string>();
        let walker: AllAuthUserListItem | undefined = currentUser;
        while (walker) {
          const managerId = extractManagerId(walker);
          if (!managerId || visited.has(managerId)) break;
          if (organizationStructure.managersToReports[managerId]) {
            newExpandedSections.add(managerId);
          }
          visited.add(managerId);
          walker = organizationStructure.allPeople[managerId];
        }

        // Expand current user's own section only if they have direct reports
        if ((organizationStructure.managersToReports[user.id] || []).length > 0) {
          newExpandedSections.add(user.id);
        }
      }
    }

    setExpandedSections(newExpandedSections);
  }, [loading, organizationStructure, isAdmin, isRecruiter, user?.id, extractManagerId]);

  const toggleSection = useCallback((managerId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(managerId)) {
        newSet.delete(managerId);
      } else {
        newSet.add(managerId);
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    if (isRecruiter && currentRecruiterRef.current) {
      setTimeout(() => {
        currentRecruiterRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
      }, 100);
    }
  }, [isRecruiter, organizationStructure]);

  if (!isAdmin && !isRecruiter) {
    return (
      <div className="page-container recruiter-hierarchy">
        <AppHeader title={t("userManagement.title")} />
        <div className="content-container">
          <div className="card">
            <div className="card-header">
              <h2>{t("userManagement.accessDenied")}</h2>
            </div>
            <div className="card-body">
              <p>{t("userManagement.notAuthorized")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container recruiter-hierarchy">
      <AppHeader title={t("userManagement.recruiterHierarchy")} />
      <div className="content-container">
        {/* Dashboard-style heading */}
        <div className="dashboard-heading">
          <h1 className="dashboard-title">
            {t("userManagement.recruiterHierarchy")}
          </h1>
          <div className="user-role-badge">
            <GitBranch className="role-icon" />
            <span>{t("roles.recruiter")}</span>
          </div>
        </div>
        <p className="dashboard-subtitle">
          {isAdmin ? t("admin_subtitle") : t("recruiter_subtitle")}
        </p>

        {error && <div className="error-message">{error}</div>}
        
        <div className="org-chart-container">
              {loading ? (
            <div className="org-chart-skeleton">
                  {Array.from({ length: 12 }).map((_, index) => (
                <OrgSectionSkeleton key={index} />
                  ))}
                </div>
          ) : organizationStructure.structure.length === 0 ? (
            <div className="empty-state">
              <p>{t("userManagement.noUsersMessage")}</p>
                </div>
              ) : (
            <div className="org-chart">
              {organizationStructure.structure.map((section, index) => (
                <OrgSection
                  key={section.manager.id}
                  manager={section.manager}
                  reports={section.reports}
                  isExpanded={expandedSections.has(section.manager.id)}
                  onToggle={() => toggleSection(section.manager.id)}
                  currentUserId={user?.id || null}
                  currentRecruiterRef={currentRecruiterRef}
                  managersToReports={organizationStructure.managersToReports}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  animationDelay={index * 0.1}
                />
              ))}
                    </div>
              )}
            </div>
          </div>
          </div>
  );
}

// Component for skeleton loading of org sections
const OrgSectionSkeleton = React.memo(function OrgSectionSkeleton() {
  return (
    <div className="person-card skeleton">
      <div className="card-content">
        <div className="avatar skeleton-avatar"></div>
        <div className="info skeleton-info">
          <div className="name skeleton-name skeleton-text"></div>
          <div className="email skeleton-email skeleton-text"></div>
          <div className="card-footer">
            <div className="role-badge skeleton-badge skeleton-text"></div>
            <div className="member-info skeleton-member skeleton-text"></div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Recursive nested reports component
const NestedReportsSection = React.memo(function NestedReportsSection({
  parentId,
  parentName,
  managersToReports,
  expandedSections,
  toggleSection,
  currentUserId,
  animationDelay = 0,
}: {
  parentId: string;
  parentName: string;
  managersToReports: Record<string, AllAuthUserListItem[]>;
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
  currentUserId: string | null;
  animationDelay?: number;
}) {
  const reports = useMemo(() => managersToReports[parentId] || [], [managersToReports, parentId]);
  
  return (
    <div className="nested-reports">
      <div className="reportees-header">
        Below are the reportees of {parentName}
              </div>
      <div className="nested-grid">
        {reports.map((nestedReport, nestedIndex) => {
          const nestedMemberCount = managersToReports[nestedReport.id]?.length || 0;
          const nestedIsExpanded = expandedSections.has(nestedReport.id);
          
          return (
            <div key={nestedReport.id} className="nested-report-item">
              <PersonCard
                person={nestedReport}
                currentUserId={currentUserId}
                memberCount={nestedMemberCount}
                isExpanded={nestedIsExpanded}
                onToggle={nestedMemberCount > 0 ? () => toggleSection(nestedReport.id) : undefined}
                animationDelay={animationDelay + (nestedIndex + 1) * 0.03}
              />
              
              {/* Recursive nested reports */}
              {nestedMemberCount > 0 && nestedIsExpanded && (
                <NestedReportsSection
                  parentId={nestedReport.id}
                  parentName={nestedReport.name || nestedReport.email}
                  managersToReports={managersToReports}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  currentUserId={currentUserId}
                  animationDelay={animationDelay + 0.1}
                />
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
});

// Main organization section component
const OrgSection = React.memo(function OrgSection({
  manager,
  reports,
  isExpanded,
  onToggle,
  currentUserId,
  currentRecruiterRef,
  managersToReports,
  expandedSections,
  toggleSection,
  animationDelay = 0,
}: {
  manager: AllAuthUserListItem;
  reports: AllAuthUserListItem[];
  isExpanded: boolean;
  onToggle: () => void;
  currentUserId: string | null;
  currentRecruiterRef: React.RefObject<HTMLDivElement>;
  managersToReports: Record<string, AllAuthUserListItem[]>;
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
  animationDelay?: number;
}) {
  const isCurrentUser = currentUserId === manager.id;
  const hasReports = reports.length > 0;

  return (
    <div className="org-section" style={{ animationDelay: `${animationDelay}s` }}>
      {/* Manager Card */}
      <div className="manager-container">
        <PersonCard
          person={manager}
          currentUserId={currentUserId}
          memberCount={hasReports ? reports.length : 0}
          isExpanded={isExpanded}
          onToggle={hasReports ? onToggle : undefined}
          ref={isCurrentUser ? currentRecruiterRef : undefined}
          animationDelay={animationDelay}
        />
      </div>

      {/* Reports Grid */}
      {hasReports && isExpanded && (
        <div className="reports-container">
          <div className="reports-grid">
            {reports.map((report, index) => {
              const reportMemberCount = managersToReports[report.id]?.length || 0;
              const reportIsExpanded = expandedSections.has(report.id);
              
              return (
                <div key={report.id} className="report-item">
                  <PersonCard
                    person={report}
                    currentUserId={currentUserId}
                    memberCount={reportMemberCount}
                    isExpanded={reportIsExpanded}
                    onToggle={reportMemberCount > 0 ? () => toggleSection(report.id) : undefined}
                    animationDelay={animationDelay + (index + 1) * 0.05}
                  />
                  
                  {/* Nested reports - Recursive rendering */}
                  {reportMemberCount > 0 && reportIsExpanded && (
                    <NestedReportsSection
                      parentId={report.id}
                      parentName={report.name || report.email}
                      managersToReports={managersToReports}
                      expandedSections={expandedSections}
                      toggleSection={toggleSection}
                      currentUserId={currentUserId}
                      animationDelay={animationDelay}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});



// Person card component with member count and expand functionality
const PersonCard = React.memo(React.forwardRef<HTMLDivElement, {
  person: AllAuthUserListItem;
  currentUserId: string | null;
  memberCount?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  animationDelay?: number;
}>(({
  person,
  currentUserId,
  memberCount = 0,
  isExpanded = false,
  onToggle,
  animationDelay = 0,
}, ref) => {
  const isCurrentUser = currentUserId === person.id;
  const typeClass = (person.userType || "default").toLowerCase();
  const hasMembers = memberCount > 0;
  const isClickable = hasMembers && onToggle;
  const initials = useMemo(() => (
    (person.name || person.email || "?")
      .split(" ")
      .map((s) => s.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("")
  ), [person.name, person.email]);

  const cardClass = `person-card ${typeClass} ${isCurrentUser ? "current-user" : ""} ${isClickable ? "clickable" : ""}`;

  return (
    <div
      ref={ref}
      className={cardClass}
      style={{ animationDelay: `${animationDelay}s` }}
      onClick={isClickable ? onToggle : undefined}
    >
      <div className="card-content">
        <div className="avatar">
          {person.userType === "admin" ? (
            <Crown className="role-icon-avatar" />
          ) : (
            initials
          )}
        </div>
        
        <div className="info">
          <div className="name">{person.name || person.email}</div>
          <div className="email">{person.email}</div>
          
          <div className="card-footer">
            <div className="role-badge">
              {person.userType === "admin" ? (
                <Crown className="role-icon-small" />
              ) : (
                <User className="role-icon-small" />
              )}
              <span>{person.userType}</span>
            </div>
            
            {hasMembers && (
              <div className="member-info">
                <span className="member-count">{memberCount}</span>
                <div className="expand-icon">
                  {isExpanded ? (
                    <ChevronDown className="chevron-icon-small" />
                  ) : (
                    <ChevronRight className="chevron-icon-small" />
          )}
        </div>
      </div>
            )}
            </div>
        </div>
      </div>
    </div>
  );
}));
