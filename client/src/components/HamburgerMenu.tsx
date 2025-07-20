import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./LanguageToggle";
import { logoutUser } from "../lib/auth";
import "../styles/components/hamburgerMenu.css";
import { supabase } from "../lib/supabaseClient";

// Interface for menu item structure
interface MenuItem {
  label: string;
  path?: string;
  icon?: JSX.Element;
  submenu?: MenuItem[];
  roles?: ("admin" | "recruiter" | "jobseeker")[];
  requiresAuth?: boolean;
  onClick?: () => void;
  exact?: boolean; // Whether the path should match exactly
  activePattern?: string; // Pattern to match for active state
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
}: {
  item: MenuItem;
  isOpen: boolean;
  onTooltipShow: (text: string, element: HTMLElement) => void;
  onTooltipHide: () => void;
}) {
  const location = useLocation();
  const hasSubmenu = item.submenu && item.submenu.length > 0;
  const hasOnClick = !!item.onClick;

  // Check if current item path matches current location
  const isPathActive = (
    path?: string,
    exact: boolean = false,
    activePattern?: string
  ): boolean => {
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
    if (hasOnClick && item.onClick) {
      item.onClick();
    }
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
                isPathActive(item.path, item.exact) ? "active" : ""
              }
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {item.icon && <span className="menu-item-icon">{item.icon}</span>}
              <span className="menu-item-text">{item.label}</span>
            </NavLink>
          ) : (
            <button
              className={`menu-action-button ${
                isPathActive(undefined, false, item.activePattern)
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
                <NavLink
                  to={subItem.path || "#"}
                  className={() =>
                    // Use our custom active detection for submenu items
                    isPathActive(subItem.path, subItem.exact) ? "active" : ""
                  }
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
    isAdmin,
    isRecruiter,
    isJobSeeker,
    profileVerificationStatus,
  } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLElement>(null);
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

  const scrollToActiveItem = () => {
    if (menuRef.current) {
      const activeItem = menuRef.current.querySelector(".active");
      if (activeItem) {
        const menuContainer = menuRef.current.querySelector(".menu-items");
        if (menuContainer) {
          const activeRect = activeItem.getBoundingClientRect();
          const containerRect = menuContainer.getBoundingClientRect();
          const scrollTop =
            activeRect.top - containerRect.top + menuContainer.scrollTop - 50;
          menuContainer.scrollTo({ top: scrollTop, behavior: "smooth" });
        }
      }
    }
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
            .from("jobseekers")
            .select("id")
            .eq("user_id", user.id)
            .single();

          if (error) {
            console.error("Error fetching jobseeker profile:", error);
            return;
          }

          setJobseekerProfileId(data.id);
        } catch (error) {
          console.error("Error fetching jobseeker profile:", error);
        }
      }
    };

    fetchJobseekerProfileId();
  }, [user?.id, isJobSeeker]);

  const handleProfileNavigation = () => {
    if (jobseekerProfileId) {
      navigate(`/jobseekers/${jobseekerProfileId}`);
    }
    onClose();
  };

  const handleUserProfileNavigation = () => {
    navigate("/profile");
    onClose(); // Close the menu after navigation
  };

  // Define all possible menu items
  const allMenuItems: MenuItem[] = [
    // Authenticated menu items
    {
      label: t("navigation.dashboard"),
      path: "/dashboard",
      icon: <Home size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter", "jobseeker"],
      exact: true,
    },
    {
      label: t("navigation.training"),
      path: "/training-modules",
      icon: <BookOpen size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter", "jobseeker"],
      exact: true,
    },

    // Recruiter-specific items
    {
      label: t("navigation.allUsers"),
      path: "/all-users-management",
      icon: <Users size={16} />,
      requiresAuth: true,
      roles: ["admin"],
      exact: true,
    },
    {
      label: t("navigation.jobseekerManagement"),
      icon: <Users size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter"],
      submenu: [
        {
          label: t("navigation.allJobseekers"),
          path: "/jobseeker-management",
          icon: <ListChecks size={16} />,
          exact: true,
        },
        {
          label: t("navigation.createJobseeker"),
          path: "/profile/create",
          icon: <UserPlus size={16} />,
          exact: true,
        },
        {
          label: t("navigation.jobseekerDrafts"),
          path: "/jobseekers/drafts",
          icon: <FileEdit size={16} />,
          exact: true,
        },
      ],
    },
    {
      label: t("navigation.clientManagement"),
      icon: <Building2 size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter"],
      submenu: [
        {
          label: t("navigation.allClients"),
          path: "/client-management",
          icon: <Database size={16} />,
          exact: true,
        },
        {
          label: t("navigation.createClient"),
          path: "/client-management/create",
          icon: <PlusCircle size={16} />,
          exact: true,
        },
        {
          label: t("navigation.draftClients"),
          path: "/client-management/drafts",
          icon: <FileText size={16} />,
          exact: true,
        },
      ],
    },
    {
      label: t("navigation.positionManagement"),
      icon: <Briefcase size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter"],
      submenu: [
        {
          label: t("navigation.allPositions"),
          path: "/position-management",
          icon: <ClipboardList size={16} />,
          exact: true,
        },
        {
          label: t("navigation.createPosition"),
          path: "/position-management/create",
          icon: <FilePlus size={16} />,
          exact: true,
        },
        {
          label: t("navigation.draftPositions"),
          path: "/position-management/drafts",
          icon: <FileEdit size={16} />,
          exact: true,
        },
        {
          label: t("navigation.positionMatching"),
          path: "/position-matching",
          icon: <Users size={16} />,
          exact: true,
        },
      ],
    },
    {
      label: t("navigation.financial"),
      icon: <Clock size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter"],
      submenu: [
        {
          label: t("navigation.timesheetManagement"),
          path: "/timesheet-management",
          icon: <Clock size={16} />,
          exact: true,
        },
        {
          label: "Create Bulk Timesheet",
          path: "/bulk-timesheet-management",
          icon: <FileSpreadsheet size={16} />,
          exact: true,
        },
        {
          label: t("navigation.invoiceManagement"),
          path: "/invoice-management",
          icon: <Receipt size={16} />,
          exact: true,
        },
        {
          label: t("navigation.invoiceList"),
          path: "/invoice-management/list",
          icon: <ListChecks size={16} />, // Use a list-style icon
          exact: true,
        },
      ],
    },
    {
      label: t("navigation.reportsAnalytics"),
      icon: <BarChart3 size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter", "jobseeker"],
      submenu: [
        {
          label: t("navigation.reports"),
          path: "/reports",
          icon: <BarChart3 size={16} />,
          exact: true,
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
      // Handle authentication requirement
      if (isAuthenticated) {
        if (item.requiresAuth === false) return false; // Don't show login/signup when authenticated
      } else {
        if (item.requiresAuth === true) return false; // Don't show protected items when not authenticated
      }

      // Handle role-based access
      if (item.roles && item.roles.length > 0) {
        if (isAdmin && item.roles.includes("admin")) return true;
        if (isRecruiter && item.roles.includes("recruiter")) return true;

        // For jobseekers, check verification status
        if (isJobSeeker && item.roles.includes("jobseeker")) {
          // Only show menu items if profile is verified
          return profileVerificationStatus === "verified";
        }

        return false;
      }

      return true;
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

  // Scroll to active item when menu opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is updated
      setTimeout(scrollToActiveItem, 100);
    }
  }, [isOpen]);

  const getUserTypeDisplay = () => {
    if (isAdmin) return t("roles.admin");
    if (isRecruiter) return t("roles.recruiter");
    if (isJobSeeker) return t("roles.jobseeker");
    return t("common.user");
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

        <ul className="menu-items">
          {menuItems.map((item, index) => (
            <MenuItemComponent
              key={index}
              item={item}
              isOpen={isOpen}
              onTooltipShow={handleTooltipShow}
              onTooltipHide={handleTooltipHide}
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
