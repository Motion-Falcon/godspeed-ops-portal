import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
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
  FileMinus,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
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

// Separate component for menu items to properly use React hooks
function MenuItemComponent({
  item,
  isOpen,
}: {
  item: MenuItem;
  isOpen: boolean;
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
              title={!isOpen ? item.label : undefined}
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
              title={!isOpen ? item.label : undefined}
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
          <div className="menu-category-header">
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
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    isAuthenticated,
    isAdmin,
    isRecruiter,
    isJobSeeker,
    profileVerificationStatus,
  } = useAuth();
  const initialRenderRef = useRef(true);
  const menuRef = useRef<HTMLElement>(null);
  const prevRouteRef = useRef(location.pathname);
  const [jobseekerProfileId, setJobseekerProfileId] = useState<string | null>(
    null
  );

  // Function to scroll to active menu item
  const scrollToActiveItem = () => {
    if (!menuRef.current) return;

    // Find the active menu item
    const activeItem = menuRef.current.querySelector(
      ".menu-item .active, .menu-action-button.active"
    );

    if (activeItem) {
      // Scroll the active item into view with smooth behavior
      activeItem.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  };

  // Handle expanding the menu
  const handleExpandMenu = (e: React.MouseEvent) => {
    // Completely stop event propagation
    e.stopPropagation();
    e.preventDefault();

    // Prevent any subsequent handlers for this event
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }

    // Call the click handler
    onOpen();
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logoutUser();
      onClose(); // Close the menu after logout
      window.location.href = "/login"; // Redirect to login page
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Fetch jobseeker profile ID when user is authenticated
  useEffect(() => {
    const fetchJobseekerProfileId = async () => {
      if (user && isJobSeeker) {
        try {
          const { data, error } = await supabase
            .from("jobseeker_profiles")
            .select("id")
            .eq("user_id", user.id)
            .single();

          if (error) {
            console.error("Error fetching profile ID:", error);
          } else if (data) {
            setJobseekerProfileId(data.id);
          }
        } catch (err) {
          console.error("Error fetching profile ID:", err);
        }
      }
    };

    fetchJobseekerProfileId();
  }, [user, isJobSeeker]);

  // Handle profile navigation
  const handleProfileNavigation = () => {
    if (jobseekerProfileId) {
      navigate(`/jobseekers/${jobseekerProfileId}`);
      onClose(); // Close the menu after navigation
    }
  };

  // Handle profile navigation for all users
  const handleUserProfileNavigation = () => {
    navigate("/profile");
    onClose(); // Close the menu after navigation
  };

  // Define all possible menu items
  const allMenuItems: MenuItem[] = [
    // Authenticated menu items
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: <Home size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter", "jobseeker"],
      exact: true,
    },
    {
      label: "Training Modules",
      path: "/training-modules",
      icon: <BookOpen size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter", "jobseeker"],
      exact: true,
    },

    // Recruiter-specific items
    {
      label: "All Users",
      path: "/all-users-management",
      icon: <Users size={16} />,
      requiresAuth: true,
      roles: ["admin"],
      exact: true,
    },
    {
      label: "Jobseeker Management",
      icon: <Users size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter"],
      submenu: [
        {
          label: "All Jobseekers",
          path: "/jobseeker-management",
          icon: <ListChecks size={16} />,
          exact: true,
        },
        {
          label: "Create Jobseeker",
          path: "/profile/create",
          icon: <UserPlus size={16} />,
          exact: true,
        },
        {
          label: "Jobseeker Drafts",
          path: "/jobseekers/drafts",
          icon: <FileEdit size={16} />,
          exact: true,
        },
      ],
    },
    {
      label: "Client Management",
      icon: <Building2 size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter"],
      submenu: [
        {
          label: "All Clients",
          path: "/client-management",
          icon: <Database size={16} />,
          exact: true,
        },
        {
          label: "Create Client",
          path: "/client-management/create",
          icon: <PlusCircle size={16} />,
          exact: true,
        },
        {
          label: "Draft Clients",
          path: "/client-management/drafts",
          icon: <FileText size={16} />,
          exact: true,
        },
      ],
    },
    {
      label: "Position Management",
      icon: <Briefcase size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter"],
      submenu: [
        {
          label: "All Positions",
          path: "/position-management",
          icon: <ClipboardList size={16} />,
          exact: true,
        },
        {
          label: "Create Position",
          path: "/position-management/create",
          icon: <FilePlus size={16} />,
          exact: true,
        },
        {
          label: "Draft Positions",
          path: "/position-management/drafts",
          icon: <FileEdit size={16} />,
          exact: true,
        },
        {
          label: "Position Matching",
          path: "/position-matching",
          icon: <Users size={16} />,
          exact: true,
        },
      ],
    },
    {
      label: "Financial",
      icon: <Clock size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter"],
      submenu: [
        {
          label: "Timesheet Management",
          path: "/timesheet-management",
          icon: <Clock size={16} />,
          exact: true,
        },
        {
          label: "Invoice Management",
          path: "/invoice-management",
          icon: <Receipt size={16} />,
          exact: true,
        },
        {
          label: "Invoice List",
          path: "/invoice-management/list",
          icon: <ListChecks size={16} />, // Use a list-style icon
          exact: true,
        },
      ],
    },
    {
      label: "Reports & Analytics",
      icon: <BarChart3 size={16} />,
      requiresAuth: true,
      roles: ["admin", "recruiter", "jobseeker"],
      submenu: [
        {
          label: "Reports",
          path: "/reports",
          icon: <BarChart3 size={16} />,
          exact: true,
        },
        {
          label: "Weekly Timesheet",
          path: "/reports/weekly-timesheet",
          icon: <Clock size={16} />,
          exact: true,
        },
        {
          label: "Margin Report",
          path: "/reports/margin",
          icon: <BarChart3 size={16} />,
          exact: true,
        },
        {
          label: "Deduction Report",
          path: "/reports/deduction",
          icon: <FileMinus size={16} />,
          exact: true,
        },

        {
          label: "Invoice Report",
          path: "/reports/invoice",
          icon: <Receipt size={16} />,
          exact: true,
        },
        {
          label: "Sales Report",
          path: "/reports/sales",
          icon: <BarChart3 size={16} />,
          exact: true,
        },

        {
          label: "Envelope Printing (Position Details)",
          path: "/reports/envelope-printing-position",
          icon: <FileText size={16} />,
          exact: true,
        },
        {
          label: "Envelope Printing Report",
          path: "/reports/envelope-printing",
          icon: <FileText size={16} />,
          exact: true,
        },
        {
          label: "Customers",
          path: "/reports/customers",
          icon: <Users size={16} />,
          exact: true,
        },
      ],
    },

    // Jobseeker-specific items
    {
      label: "My Profile",
      icon: <User size={16} />,
      requiresAuth: true,
      roles: ["jobseeker"],
      onClick: handleProfileNavigation,
      activePattern: "/jobseekers/",
      exact: true,
    },
    {
      label: "My Positions",
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

        return false; // No matching role
      }

      return true; // No role restrictions
    });
  };

  const [menuItems, setMenuItems] = useState<MenuItem[]>(
    getFilteredMenuItems()
  );

  // Update menu items when auth state changes
  useEffect(() => {
    setMenuItems(getFilteredMenuItems());
  }, [
    isAuthenticated,
    isAdmin,
    isRecruiter,
    isJobSeeker,
    profileVerificationStatus,
    jobseekerProfileId,
  ]);

  // Scroll to active item when menu opens
  useEffect(() => {
    if (isOpen) {
      // Add a small delay to ensure the menu is fully rendered
      const timeoutId = setTimeout(() => {
        scrollToActiveItem();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    // Skip the first render
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Make sure we're not clicking on the menu or its button
      if (
        isOpen &&
        !target.closest(".hamburger-menu") &&
        !target.closest(".menu-expand-button")
      ) {
        onClose();
      }
    };

    // Only add the listener if the menu is open
    if (isOpen) {
      // Add event listener after a short delay to avoid closing immediately
      const timeoutId = window.setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 300); // Increased delay to ensure state is stable

      return () => {
        window.clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }

    return undefined;
  }, [isOpen, onClose]);

  // Handle route changes manually to prevent auto-closing on initial load
  useEffect(() => {
    // Skip if it's the initial render
    if (initialRenderRef.current) {
      return;
    }

    // Check if the route has actually changed
    if (location.pathname !== prevRouteRef.current) {
      prevRouteRef.current = location.pathname;

      // Only close the menu if a navigation has occurred AND the menu is open
      if (isOpen) {
        // Add a delay to avoid immediate closing
        const timeoutId = window.setTimeout(() => {
          onClose();
        }, 300);

        return () => {
          window.clearTimeout(timeoutId);
        };
      }
    }

    return undefined;
  }, [location.pathname, isOpen, onClose]);

  // Get user type display text
  const getUserTypeDisplay = () => {
    if (isAdmin) return "Administrator";
    if (isRecruiter) return "Recruiter";
    if (isJobSeeker) return "Job Seeker";
    return "User";
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
    return "User";
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
          <ThemeToggle />
        </div>

        <ul className="menu-items">
          {menuItems.map((item, index) => (
            <MenuItemComponent key={index} item={item} isOpen={isOpen} />
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
                    <span>My Account</span>
                  </button>
                  <div className="dropdown-divider"></div>
                  <button
                    className="dropdown-item logout-item"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
