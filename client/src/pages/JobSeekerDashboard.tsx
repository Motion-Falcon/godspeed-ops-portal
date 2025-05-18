import { useState, useEffect } from "react";
import {
  LogOut,
  User as UserIcon,
  Activity,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { logoutUser } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "../components/theme-toggle";
import { checkApiHealth } from "../services/api";
import { supabase } from "../lib/supabaseClient";
import "../styles/components/header.css";
import { AppHeader } from "../components/AppHeader";

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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

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
      setIsLoadingProfile(true);

      const { data, error } = await supabase
        .from("jobseeker_profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error fetching profile ID:", error);
      } else if (data) {
        setUserData((prev) => (prev ? { ...prev, profileId: data.id } : null));
      }
    } catch (err) {
      console.error("Error fetching profile ID:", err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logoutUser();
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
      setIsLoggingOut(false);
    }
  };

  const handleViewProfile = () => {
    if (userData?.profileId) {
      navigate(`/jobseekers/${userData.profileId}`);
    }
  };

  const handleCheckHealth = async () => {
    setHealthStatus("Checking...");
    try {
      const result = await checkApiHealth();
      if (result.status === "healthy") {
        setHealthStatus(`✅ Connection healthy: ${result.user}`);
      } else {
        setHealthStatus(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      setHealthStatus(
        `❌ Check failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
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
      <AppHeader 
        title="Job Seeker Portal" 
        actions={
          <>
            <ThemeToggle />
            <button
              className="button button-icon"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <span className="loading-spinner"></span>
              ) : (
                <>
                  <LogOut className="icon" size={16} />
                  <span>Log out</span>
                </>
              )}
            </button>
          </>
        }
      />

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
          Discover opportunities at Godspeed pace with our intelligent job matching system
        </p>

        <div className="dashboard-grid">
          <div className="card">
            <div className="card-header">
              <UserIcon className="icon" size={20} />
              <h2 className="card-title">Account Details</h2>
            </div>

            <div>
              <div className="data-item">
                <p className="data-label">Name</p>
                <p className="data-value">{userData.name}</p>
              </div>

              <div className="data-item">
                <p className="data-label">Email Address</p>
                <p className="data-value">{userData.email}</p>
              </div>

              <div className="data-item">
                <p className="data-label">Account ID</p>
                <p className="data-value" style={{ fontSize: "0.875rem" }}>
                  {userData.id}
                </p>
              </div>

              <div className="data-item">
                <p className="data-label">Account Created</p>
                <p className="data-value">{userData.createdAt}</p>
              </div>

              <div className="data-item">
                <p className="data-label">Last Login</p>
                <p className="data-value">{userData.lastSignIn}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title" style={{ marginBottom: "1rem" }}>
              Job Seeker Actions
            </h2>
            <div className="action-list">
              <button
                className="button outline"
                onClick={handleViewProfile}
                disabled={isLoadingProfile}
              >
                <UserIcon size={16} className="icon" />
                {isLoadingProfile ? "Loading Profile..." : "View My Profile"}
              </button>

              {/* Reset Password button */}
              <button
                className="button outline"
                onClick={() => navigate("/reset-password")}
              >
                Reset Password
              </button>

              {/* Health check button */}
              <button className="button outline" onClick={handleCheckHealth}>
                <Activity size={16} className="icon" />
                Check Auth Status
              </button>

              {healthStatus && (
                <div className="health-status">{healthStatus}</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
