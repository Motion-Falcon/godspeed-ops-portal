import { useState, useEffect } from "react";
import {
  User as UserIcon,
  UserCheck,
  Shield,
  Activity,
  BookOpen,
  Users,
  Building,
  Briefcase,
  KeyRound
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { checkApiHealth } from "../services/api";
import { AppHeader } from "../components/AppHeader";
import "../styles/components/header.css";

interface UserData {
  id: string;
  email: string | null | undefined;
  name: string;
  userType: string;
  createdAt: string;
  lastSignIn: string;
}

export function RecruiterDashboard() {
  const { user, isAdmin, isRecruiter } = useAuth();
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    if (user) {
      setUserData({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || "User",
        userType: user.user_metadata?.user_type || "recruiter",
        createdAt: new Date(user.created_at).toLocaleDateString(),
        lastSignIn: user.last_sign_in_at
          ? new Date(user.last_sign_in_at).toLocaleString()
          : "First login",
      });
    }
  }, [user]);

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

  // Get the role icon based on user type
  const getRoleIcon = () => {
    if (isAdmin) return <Shield className="role-icon admin" />;
    if (isRecruiter) return <UserCheck className="role-icon recruiter" />;
    return <UserIcon className="role-icon jobseeker" />;
  };

  // Get role name for display
  const getRoleName = () => {
    if (isAdmin) return "Administrator";
    if (isRecruiter) return "Recruiter";
    return "Job Seeker";
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <AppHeader 
        title="Recruiter Portal"
      />

      {/* Main content */}
      <main className="dashboard-main">
        <div className="dashboard-heading">
          <h1 className="dashboard-title">Welcome, {userData.name}!</h1>
          <div className="user-role-badge">
            {getRoleIcon()}
            <span>{getRoleName()}</span>
          </div>
        </div>
        <p className="dashboard-subtitle">
          Manage talent acquisition with Godspeed's lightning-fast recruiting tools
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
                <p className="data-label">User Role</p>
                <p className="data-value">{getRoleName()}</p>
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
              Recruiter Actions
            </h2>
            <div className="action-list">
              <button
                className="button outline"
                onClick={() => navigate("/jobseeker-management")}
              >
                <Users size={16} className="icon" />
                Job Seeker Management
              </button>
              <button
                className="button outline"
                onClick={() => navigate("/client-management")}
              >
                <Building size={16} className="icon" />
                Manage Clients
              </button>
              <button
                className="button outline"
                onClick={() => navigate("/position-management")}
              >
                <Briefcase size={16} className="icon" />
                Position Management
              </button>

              {/* Training Modules button */}
              <button
                className="button outline"
                onClick={() => navigate("/training-modules")}
              >
                <BookOpen size={16} className="icon" />
                Training & Development
              </button>

              {/* Reset Password button */}
              <button
                className="button outline"
                onClick={() => navigate("/reset-password")}
              >
                <KeyRound size={16} className="icon" />
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

              {/* Admin-only actions */}
              {isAdmin && (
                <button className="button outline admin-action">
                  <Shield size={16} className="icon" />
                  Admin Dashboard
                </button>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
