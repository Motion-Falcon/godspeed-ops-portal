import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/language/language-provider";
import {
  Home,
  Users,
  Briefcase,
  Building2,
  BookOpen,
  User,
  UserCircle,
  LogOut,
  X,
  ListChecks,
  FilePlus,
  FileEdit,
  ClipboardList,
  PlusCircle,
  Database,
  FileText,
  UserPlus,
  Menu,
  ChevronUp,
  Clock,
  Receipt,
  BarChart3,
  FileSpreadsheet,
  MessageSquare,
  GitBranch,
  Calendar,
  CreditCard,
  MailOpen,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./LanguageToggle";
import {
  getResolvedUserRoles,
  hasAnyExactAccessRole,
  logoutUser,
  type AccessRole,
} from "../lib/auth";
import {
  AI_CHAT_ROLES,
  ALL_USERS_ROLES,
  BULK_TIMESHEET_ROLES,
  CALENDAR_ROLES,
  CLIENT_CREATE_ROLES,
  CLIENT_DRAFT_ROLES,
  CLIENT_LIST_ROLES,
  CONSENT_CREATE_ROLES,
  CONSENT_LIST_ROLES,
  DASHBOARD_ROLES,
  DROPDOWN_OPTIONS_ROLES,
  INVOICE_MANAGEMENT_ROLES,
  INVITE_INTERNAL_USER_ROLES,
  JOBSEEKER_DRAFT_ROLES,
  JOBSEEKER_LIST_ROLES,
  JOBSEEKER_MANAGEMENT_CREATE_ROLES,
  POSITION_CREATE_ROLES,
  POSITION_DRAFT_ROLES,
  POSITION_LIST_ROLES,
  POSITION_MATCHING_ROLES,
  RECRUITER_HIERARCHY_ROLES,
  REPORTS_ROLES,
  SIN_WORK_PERMIT_ROLES,
  TIMESHEET_MANAGEMENT_ROLES,
  TRAINING_ROLES,
} from "../constants/accessControl";
import "../styles/components/hamburgerMenu.css";
import { supabase } from "../lib/supabaseClient";
import {
  restoreMenuScroll,
  setMenuScrollTop,
} from "../lib/menuScrollState";

// Interface for menu item structure
interface MenuItem {
  label: string;
  path?: string;
  icon?: JSX.Element;
  submenu?: MenuItem[];
  roles?: AccessRole[];
  requiresSuperAdmin?: boolean;
  requiresAuth?: boolean;
  onClick?: () => void;
  exact?: boolean; // Whether the path should match exactly
  activePattern?: string; // Pattern to match for active state
  activePaths?: string[]; // Array of paths that should activate this menu item
  /** Full browser navigation — remounts the page (e.g. reset heavy create forms). */
  fullPageLoad?: boolean;
}

interface HamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

// Custom Tooltip Component
function CustomTooltip({
  text,
  isVisible,
  position,
}: {
  text: string;
  isVisible: boolean;
  position: { x: number; y: number };
}) {
  if (!isVisible) return null;

  return (
    <div
      className="custom-tooltip"
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 9999,
      }}
    >
      {text}
    </div>
  );
}

// Separate component for menu items to properly use React hooks
function MenuItemComponent({
  item,
  isOpen,
  onTooltipShow,
  onTooltipHide,
  onSaveScroll,
  onNavigate,
}: {
  item: MenuItem;
  isOpen: boolean;
  onTooltipShow: (text: string, element: HTMLElement) => void;
  onTooltipHide: () => void;
  onSaveScroll: () => void;
  onNavigate: () => void;
}) {
  const location = useLocation();
  const hasSubmenu = item.submenu && item.submenu.length > 0;
  const hasOnClick = !!item.onClick;

  // Check if current item path matches current location
  const isPathActive = (
    path?: string,
    exact: boolean = false,
    activePattern?: string,
    activePaths?: string[]
  ): boolean => {
    // If there are multiple active paths provided, check if current path matches any of them
    if (activePaths && activePaths.length > 0) {
      const currentPathname = location.pathname;
      const currentSearch = location.search;
      const currentFullPath = currentPathname + currentSearch;
      
      return activePaths.some(activePath => {
        // For activePaths, we require exact matching to avoid conflicts
        return currentFullPath === activePath;
      });
    }

    // If there's an active pattern provided, check if current path matches it
    if (activePattern) {
      return location.pathname.startsWith(activePattern);
    }

    if (!path) return false;

    if (exact) {
      // For exact match, just compare the paths
      return location.pathname === path;
    } else {
      // For non-exact match, check if it's a direct match or a direct child
      // This prevents /client-management/drafts from activating /client-management
      // when they're siblings, but allows /client-management/view/123 to activate /client-management
      const isExactMatch = location.pathname === path;

      // Only consider sub-paths active if they're not defined elsewhere in menu items
      if (!isExactMatch && location.pathname.startsWith(`${path}/`)) {
        // Check if this is a specific subpath that should be considered separate
        // For example, /client-management/drafts should not activate /client-management
        const remainingPath = location.pathname.substring(path.length);

        // These are known sub-routes that should be treated as separate items
        const specificSubpaths = ["/drafts", "/create", "/edit"];
        return !specificSubpaths.some((subpath) =>
          remainingPath.startsWith(subpath)
        );
      }

      return isExactMatch;
    }
  };

  const handleItemClick = () => {
    onSaveScroll();
    if (hasOnClick && item.onClick) {
      item.onClick();
    }
  };

  const handleNavInteraction = () => {
    onSaveScroll();
    onNavigate();
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (!isOpen) {
      onTooltipShow(item.label, e.currentTarget);
    }
  };

  const handleMouseLeave = () => {
    if (!isOpen) {
      onTooltipHide();
    }
  };

  return (
    <>
      {/* Render standard menu item if it has a path or onClick */}
      {(item.path || hasOnClick) && !hasSubmenu && (
        <li className="menu-item">
          {item.path && !hasOnClick ? (
            <NavLink
              to={item.path}
              className={() =>
                // Use our custom active detection for main menu items
                isPathActive(item.path, item.exact, item.activePattern, item.activePaths) ? "active" : ""
              }
              onMouseDown={onSaveScroll}
              onClick={handleNavInteraction}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {item.icon && <span className="menu-item-icon">{item.icon}</span>}
              <span className="menu-item-text">{item.label}</span>
            </NavLink>
          ) : (
            <button
              className={`menu-action-button ${
                isPathActive(undefined, false, item.activePattern, item.activePaths)
                  ? "active"
                  : ""
              }`}
              onClick={handleItemClick}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {item.icon && <span className="menu-item-icon">{item.icon}</span>}
              <span className="menu-item-text">{item.label}</span>
            </button>
          )}
        </li>
      )}

      {/* Render category with submenu items */}
      {hasSubmenu && (
        <li className="menu-category" data-category={item.label}>
          {/* Category heading */}
          <div
            className="menu-category-header"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Remove icon from category header */}
            <span className="menu-item-text">{item.label}</span>
          </div>

          {/* Submenu items */}
          <ul className="menu-category-items">
            {item.submenu!.map((subItem, subIndex) => (
              <li key={subIndex} className="menu-item submenu-item">
                {subItem.fullPageLoad && subItem.path ? (
                  <a
                    href={subItem.path}
                    className={
                      isPathActive(
                        subItem.path,
                        subItem.exact,
                        subItem.activePattern,
                        subItem.activePaths
                      )
                        ? "active"
                        : ""
                    }
                    onMouseDown={onSaveScroll}
                    onClick={handleNavInteraction}
                    onMouseEnter={(e) => {
                      if (!isOpen) {
                        onTooltipShow(subItem.label, e.currentTarget);
                      }
                    }}
                    onMouseLeave={() => {
                      if (!isOpen) {
                        onTooltipHide();
                      }
                    }}
                  >
                    {subItem.icon && (
                      <span className="menu-item-icon">{subItem.icon}</span>
                    )}
                    <span className="menu-item-text">{subItem.label}</span>
                  </a>
                ) : (
                  <NavLink
                    to={subItem.path || "#"}
                    className={() =>
                      // Use our custom active detection for submenu items
                      isPathActive(subItem.path, subItem.exact, subItem.activePattern, subItem.activePaths) ? "active" : ""
                    }
                    onMouseDown={onSaveScroll}
                    onClick={handleNavInteraction}
                    onMouseEnter={(e) => {
                      if (!isOpen) {
                        onTooltipShow(subItem.label, e.currentTarget);
                      }
                    }}
                    onMouseLeave={() => {
                      if (!isOpen) {
                        onTooltipHide();
                      }
                    }}
                  >
                    {subItem.icon && (
                      <span className="menu-item-icon">{subItem.icon}</span>
                    )}
                    <span className="menu-item-text">{subItem.label}</span>
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </li>
      )}
    </>
  );
}

export function HamburgerMenu({ isOpen, onClose, onOpen }: HamburgerMenuProps) {
  const {
    user,
    isAuthenticated,
    isSuperAdmin,
    isAdmin,
    isRecruiter,
    isJobSeeker,
    profileVerificationStatus,
  } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLElement>(null);
  const menuItemsRef = useRef<HTMLUListElement>(null);
  const [tooltip, setTooltip] = useState<{
    text: string;
    isVisible: boolean;
    position: { x: number; y: number };
  }>({ text: "", isVisible: false, position: { x: 0, y: 0 } });
  const [jobseekerProfileId, setJobseekerProfileId] = useState<string | null>(
    null
  );

  const handleTooltipShow = (text: string, element: HTMLElement) => {
    if (!isOpen) {
      const rect = element.getBoundingClientRect();
      setTooltip({
        text,
        isVisible: true,
        position: {
          x: rect.right + 10,
          y: rect.top + rect.height / 2 - 12,
        },
      });
    }
  };

  const handleTooltipHide = () => {
    setTooltip((prev) => ({ ...prev, isVisible: false }));
  };

  const saveMenuScroll = () => {
    if (menuItemsRef.current) {
      setMenuScrollTop(menuItemsRef.current.scrollTop);
    }
  };

  const handleMenuNavigate = () => {
    saveMenuScroll();
    onClose();
  };

  const handleExpandMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onOpen();
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    const fetchJobseekerProfileId = async () => {
      if (user?.id && isJobSeeker) {
        try {
          const { data, error } = await supabase
            .from("jobseeker_profiles")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (error) {
            console.error("Error fetching jobseeker profile:", error);
            return;
          }

          // Only set profile ID if data exists (user has a profile)
          if (data) {
            setJobseekerProfileId(data.id);
          }
        } catch (error) {
          console.error("Error fetching jobseeker profile:", error);
        }
      }
    };

    fetchJobseekerProfileId();
  }, [user?.id, isJobSeeker]);

  const handleProfileNavigation = () => {
    saveMenuScroll();
    if (jobseekerProfileId) {
      navigate(`/jobseekers/${jobseekerProfileId}`);
    }
    onClose();
  };

  const handleUserProfileNavigation = () => {
    saveMenuScroll();
    navigate("/profile");
    onClose();
  };

  // Define all possible menu items
  const allMenuItems: MenuItem[] = [
    // Authenticated menu items
    {
      label: t("navigation.dashboard"),
      path: "/dashboard",
      icon: <Home size={16} />,
      requiresAuth: true,
      roles: DASHBOARD_ROLES,
      exact: true,
    },
    {
      label: t("navigation.calendar"),
      path: "/calendar",
      icon: <Calendar size={16} />,
      requiresAuth: true,
      roles: CALENDAR_ROLES,
      exact: true,
    },
    {
      label: t("navigation.training"),
      path: "/training-modules",
      icon: <BookOpen size={16} />,
      requiresAuth: true,
      roles: TRAINING_ROLES,
      exact: true,
    },
    {
      label: t("navigation.aiChat"),
      path: "/ai-chat",
      icon: <MessageSquare size={16} />,
      requiresAuth: true,
      roles: AI_CHAT_ROLES,
      exact: true,
    },

    // Recruiter-specific items
    {
      label: t("navigation.userManagement"),
      icon: <Users size={16} />,
      requiresAuth: true,
      roles: [
        ...ALL_USERS_ROLES,
        ...RECRUITER_HIERARCHY_ROLES,
        ...INVITE_INTERNAL_USER_ROLES,
        ...DROPDOWN_OPTIONS_ROLES,
      ],
      submenu: [
        {
          label: t("navigation.allUsers"),
          path: "/all-users-management",
          icon: <Users size={16} />,
          exact: true,
          roles: ALL_USERS_ROLES,
          activePaths: ["/all-users-management"]
        },
        {
          label: t("navigation.recruiterHierarchy"),
          path: "/recruiter-hierarchy",
          icon: <GitBranch size={16} />,
          exact: true,
          roles: RECRUITER_HIERARCHY_ROLES,
        },
        {
          label: t("recruiterManagement.inviteRecruiter"),
          path: "/invite-recruiter",
          icon: <UserPlus size={16} />,
          exact: true,
          roles: INVITE_INTERNAL_USER_ROLES,
        },
        {
          label: t("navigation.dropdownOptions"),
          path: "/admin/dropdown-options",
          icon: <ClipboardList size={16} />,
          exact: true,
          roles: DROPDOWN_OPTIONS_ROLES,
        },
      ],
    },
    {
      label: t("navigation.jobseekerManagement"),
      icon: <Users size={16} />,
      requiresAuth: true,
      roles: [
        ...JOBSEEKER_LIST_ROLES,
        ...JOBSEEKER_MANAGEMENT_CREATE_ROLES,
        ...JOBSEEKER_DRAFT_ROLES,
        ...SIN_WORK_PERMIT_ROLES,
      ],
      submenu: [
        {
          label: t("navigation.allJobseekers"),
          path: "/jobseeker-management",
          icon: <ListChecks size={16} />,
          exact: true,
          roles: JOBSEEKER_LIST_ROLES,
        },
        {
          label: t("navigation.createJobseeker"),
          path: "/profile/create",
          icon: <UserPlus size={16} />,
          exact: true,
          roles: JOBSEEKER_MANAGEMENT_CREATE_ROLES,
        },
        {
          label: t("navigation.jobseekerDrafts"),
          path: "/jobseekers/drafts",
          icon: <FileEdit size={16} />,
          exact: true,
          roles: JOBSEEKER_DRAFT_ROLES,
        },
        {
          label: t("navigation.sinWorkPermitManagement"),
          path: "/sin-work-permit-management",
          icon: <CreditCard size={16} />,
          exact: true,
          roles: SIN_WORK_PERMIT_ROLES,
        },
      ],
    },
    {
      label: t("navigation.clientManagement"),
      icon: <Building2 size={16} />,
      requiresAuth: true,
      roles: [...CLIENT_LIST_ROLES, ...CLIENT_CREATE_ROLES, ...CLIENT_DRAFT_ROLES],
      submenu: [
        {
          label: t("navigation.allClients"),
          path: "/client-management",
          icon: <Database size={16} />,
          exact: true,
          roles: CLIENT_LIST_ROLES,
        },
        {
          label: t("navigation.createClient"),
          path: "/client-management/create",
          icon: <PlusCircle size={16} />,
          exact: true,
          roles: CLIENT_CREATE_ROLES,
        },
        {
          label: t("navigation.draftClients"),
          path: "/client-management/drafts",
          icon: <FileText size={16} />,
          exact: true,
          roles: CLIENT_DRAFT_ROLES,
        },
      ],
    },
    {
      label: t("navigation.positionManagement"),
      icon: <Briefcase size={16} />,
      requiresAuth: true,
      roles: [
        ...POSITION_LIST_ROLES,
        ...POSITION_CREATE_ROLES,
        ...POSITION_DRAFT_ROLES,
        ...POSITION_MATCHING_ROLES,
      ],
      submenu: [
        {
          label: t("navigation.allPositions"),
          path: "/position-management",
          icon: <ClipboardList size={16} />,
          exact: true,
          roles: POSITION_LIST_ROLES,
        },
        {
          label: t("navigation.createPosition"),
          path: "/position-management/create",
          icon: <FilePlus size={16} />,
          exact: true,
          roles: POSITION_CREATE_ROLES,
          fullPageLoad: true,
        },
        {
          label: t("navigation.createPositionSubcategory"),
          path: "/position-management/create-subcategory",
          icon: <PlusCircle size={16} />,
          exact: true,
          roles: POSITION_CREATE_ROLES,
          fullPageLoad: true,
        },
        {
          label: t("navigation.draftPositions"),
          path: "/position-management/drafts",
          icon: <FileEdit size={16} />,
          exact: true,
          roles: POSITION_DRAFT_ROLES,
        },
        {
          label: t("navigation.positionMatching"),
          path: "/position-matching",
          icon: <Users size={16} />,
          exact: true,
          roles: POSITION_MATCHING_ROLES,
        },
      ],
    },
    {
      label: t("navigation.consentManagement"),
      icon: <FileText size={16} />,
      requiresAuth: true,
      roles: [...CONSENT_LIST_ROLES, ...CONSENT_CREATE_ROLES],
      submenu: [
        {
          label: t("navigation.allConsentDocuments"),
          path: "/consent-dashboard",
          icon: <FileText size={16} />,
          exact: true,
          roles: CONSENT_LIST_ROLES,
        },
        {
          label: t("navigation.createConsentDocument"),
          path: "/consent-dashboard/new",
          icon: <FilePlus size={16} />,
          exact: true,
          roles: CONSENT_CREATE_ROLES,
        },
        {
          label: t("navigation.consentTemplates"),
          path: "/consent-dashboard/templates",
          icon: <ClipboardList size={16} />,
          exact: true,
          roles: ["admin"],
          requiresSuperAdmin: true,
        },
      ],
    },
    {
      label: "Email Template Preview",
      path: "/email-template-preview",
      icon: <MailOpen size={16} />,
      requiresAuth: true,
      roles: ["admin"],
      requiresSuperAdmin: true,
    },
    {
      label: t("navigation.financial"),
      icon: <Clock size={16} />,
      requiresAuth: true,
      roles: [
        ...TIMESHEET_MANAGEMENT_ROLES,
        ...BULK_TIMESHEET_ROLES,
        ...INVOICE_MANAGEMENT_ROLES,
      ],
      submenu: [
        {
          label: t("navigation.timesheetManagement"),
          path: "/timesheet-management",
          icon: <Clock size={16} />,
          exact: true,
          roles: TIMESHEET_MANAGEMENT_ROLES,
        },
        {
          label: t("navigation.createBulkTimesheetClient"),
          path: "/bulk-timesheet-management",
          icon: <FileSpreadsheet size={16} />,
          exact: true,
          roles: BULK_TIMESHEET_ROLES,
        },
        {
          label: t("navigation.createBulkTimesheetJobseeker"),
          path: "/bulk-timesheet-management/jobseeker",
          icon: <FileSpreadsheet size={16} />,
          exact: true,
          roles: BULK_TIMESHEET_ROLES,
        },
        {
          label: t("navigation.bulkTimesheetList"),
          path: "/timesheet-management/list",
          icon: <ListChecks size={16} />,
          exact: true,
          roles: BULK_TIMESHEET_ROLES,
        },
        {
          label: t("navigation.invoiceManagement"),
          path: "/invoice-management",
          icon: <Receipt size={16} />,
          exact: true,
          roles: INVOICE_MANAGEMENT_ROLES,
        },
        {
          label: t("navigation.invoiceList"),
          path: "/invoice-management/list",
          icon: <ListChecks size={16} />, // Use a list-style icon
          exact: true,
          roles: INVOICE_MANAGEMENT_ROLES,
        },
      ],
    },
    {
      label: t("navigation.reportsAnalytics"),
      icon: <BarChart3 size={16} />,
      requiresAuth: true,
      roles: REPORTS_ROLES,
      submenu: [
        {
          label: t("navigation.reports"),
          path: "/reports",
          icon: <BarChart3 size={16} />,
          exact: true,
          roles: REPORTS_ROLES,
        },
      ],
    },

    // Jobseeker-specific items
    {
      label: t("navigation.myProfile"),
      icon: <User size={16} />,
      requiresAuth: true,
      roles: ["jobseeker"],
      onClick: handleProfileNavigation,
      activePattern: "/jobseekers/",
      exact: true,
    },
    {
      label: t("navigation.myPositions"),
      path: "/my-positions",
      icon: <Briefcase size={16} />,
      requiresAuth: true,
      roles: ["jobseeker"],
      exact: true,
    },
  ];

  // Filter menu items based on authentication status and user role
  const getFilteredMenuItems = (): MenuItem[] => {
    return allMenuItems.filter((item) => {
      if (item.requiresSuperAdmin && !isSuperAdmin) {
        return false;
      }

      // Handle authentication requirement
      if (isAuthenticated) {
        if (item.requiresAuth === false) return false; // Don't show login/signup when authenticated
      } else {
        if (item.requiresAuth === true) return false; // Don't show protected items when not authenticated
      }

      // Handle role-based access
      if (item.roles && item.roles.length > 0) {
        // For jobseekers, check verification status
        if (isJobSeeker && item.roles.includes("jobseeker")) {
          // Only show menu items if profile is verified
          return profileVerificationStatus === "verified";
        }

        return hasAnyExactAccessRole(user, item.roles);
      }

      return true;
    }).map((item) => {
      // Filter submenu items based on user role
      if (item.submenu && item.submenu.length > 0) {
        const filteredSubmenu = item.submenu.filter((subItem) => {
          if (subItem.requiresSuperAdmin && !isSuperAdmin) {
            return false;
          }

          // If submenu item has no role restrictions, show it
          if (!subItem.roles || subItem.roles.length === 0) return true;

          if (isJobSeeker && subItem.roles.includes("jobseeker")) {
            return profileVerificationStatus === "verified";
          }

          return hasAnyExactAccessRole(user, subItem.roles);
        });

        return {
          ...item,
          submenu: filteredSubmenu,
        };
      }

      return item;
    });
  };

  const menuItems = getFilteredMenuItems();

  // Handle clicks outside the menu to close it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if click is on the menu toggle button by checking for menu-related classes
      const isMenuToggle =
        target.closest(".menu-toggle") || target.closest(".menu-expand-button");

      if (isMenuToggle) {
        console.log("Click detected on menu toggle button, ignoring close");
        return;
      }

      // Check if click is inside the menu
      if (menuRef.current && !menuRef.current.contains(target)) {
        console.log("Click detected outside menu, closing menu");
        onClose();
      }
    };

    // Only add event listener if menu is open
    if (isOpen) {
      console.log("Adding click outside listener for menu");
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      console.log("Removing click outside listener for menu");
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Restore scroll after route change or refresh; scroll to active item when nothing saved
  useLayoutEffect(() => {
    if (menuItemsRef.current && menuItems.length > 0) {
      restoreMenuScroll(menuItemsRef.current);
    }
  }, [menuItems.length]);

  useEffect(() => {
    const menuList = menuItemsRef.current;
    if (!menuList) return;

    const handleScroll = () => {
      setMenuScrollTop(menuList.scrollTop);
    };

    const handlePageHide = () => {
      setMenuScrollTop(menuList.scrollTop);
    };

    menuList.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      menuList.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [menuItems.length]);

  const getUserTypeDisplay = () => {
    if (!user) {
      return t("common.user");
    }

    const resolvedRoles = getResolvedUserRoles(user);
    if (resolvedRoles.length === 0) {
      if (isJobSeeker) return t("roles.jobseeker");
      if (isAdmin) return t("roles.admin");
      if (isRecruiter) return t("roles.recruiter");
      return t("common.user");
    }

    return resolvedRoles.map((role) => t(`roles.${role}`)).join(", ");
  };

  // Get user display name
  const getUserDisplayName = () => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.user_metadata?.name) return user.user_metadata.name;
    if (user?.email) {
      // Extract name from email if no full name available
      const emailName = user.email.split("@")[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return t("common.user");
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    const name = getUserDisplayName();
    const words = name.split(" ");
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <div
        className={`menu-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />
      <nav ref={menuRef} className={`hamburger-menu ${isOpen ? "open" : ""}`}>
        {/* Combined menu header for both collapsed and expanded states */}
        <div className="menu-header">
          {/* Expand button (only visible in collapsed state) */}
          <button onClick={handleExpandMenu} className="menu-expand-button">
            <Menu size={24} />
          </button>

          {/* Theme toggle and close button (only visible in expanded state) */}
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
          <div className="menu-toggle-container">
          {isOpen && <LanguageToggle />}
          <ThemeToggle />
          </div>
        </div>

        <ul className="menu-items" ref={menuItemsRef}>
          {menuItems.map((item, index) => (
            <MenuItemComponent
              key={index}
              item={item}
              isOpen={isOpen}
              onTooltipShow={handleTooltipShow}
              onTooltipHide={handleTooltipHide}
              onSaveScroll={saveMenuScroll}
              onNavigate={handleMenuNavigate}
            />
          ))}
        </ul>

        <div className="menu-footer">
          {isAuthenticated && (
            <div className="user-profile-bar">
              {/* User avatar and info */}
              <div className="user-info">
                <div className="user-avatar">{getUserInitials()}</div>
                <div className="user-details">
                  <div className="user-name-row">
                    <div className="user-name">{getUserDisplayName()}</div>
                    <div className="user-type">{getUserTypeDisplay()}</div>
                    <div className="dropdown-icon">
                      <ChevronUp size={22} />
                    </div>
                  </div>
                  <div className="user-email">{user?.email}</div>
                </div>
              </div>

              {/* Dropdown bridge and menu */}
              <div className="dropdown-bridge">
                <div className="user-dropdown">
                  <button
                    className="dropdown-item"
                    onClick={handleUserProfileNavigation}
                  >
                    <UserCircle size={16} />
                    <span>{t("navigation.myAccount")}</span>
                  </button>
                  <div className="dropdown-divider"></div>
                  <button
                    className="dropdown-item logout-item"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    <span>{t("navigation.logout")}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Custom Tooltip */}
      <CustomTooltip
        text={tooltip.text}
        isVisible={tooltip.isVisible}
        position={tooltip.position}
      />
    </>
  );
}
