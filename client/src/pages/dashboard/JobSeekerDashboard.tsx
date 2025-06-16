import { useState, useEffect } from "react";
import {
  User as UserIcon,
  Activity,
  BookOpen,
  Briefcase
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { checkApiHealth } from "../../services/api/auth";
import { supabase } from "../../lib/supabaseClient";
import "../../styles/components/header.css";
import "../../styles/pages/Dashboard.css";
import { AppHeader } from "../../components/AppHeader";
import { ProfileCompletion } from "./components/ProfileCompletion";

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
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);

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
          {/* Profile Completion Status Card */}
          <ProfileCompletion userId={userData.id} />

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
              {/* My Positions button */}
              <button
                className="button outline"
                onClick={() => navigate("/my-positions")}
              >
                <Briefcase size={16} className="icon" />
                My Positions
              </button>

              {/* Training Modules button */}
              <button
                className="button outline"
                onClick={() => navigate("/training-modules")}
              >
                <BookOpen size={16} className="icon" />
                Training & Development
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
