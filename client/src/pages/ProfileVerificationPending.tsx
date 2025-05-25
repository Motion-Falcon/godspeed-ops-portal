import { useAuth } from "../contexts/AuthContext";
import { logoutUser } from "../lib/auth";
import { useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { LogOut, RefreshCw } from "lucide-react";
import { ThemeToggle } from "../components/theme-toggle";

export function ProfileVerificationPending() {
  const { refetchProfileStatus } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logoutUser();
      window.location.href = "/login";
    } catch (error) {
      console.error("Error logging out:", error);
      setIsLoggingOut(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchProfileStatus();
    setTimeout(() => setRefreshing(false), 1000); // Give user visual feedback
  };

  return (
    <>
      <AppHeader
        title="Profile Verification"
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
      <div className="centered-container">
        <div className="centered-card">
          <h1 className="auth-card-title">Profile Verification Pending</h1>
          <p className="text-muted">
            Thank you for submitting your profile! Your information is currently
            under review.
          </p>
          <p className="text-muted">
            This process usually takes 1-2 business days. We will notify you via
            email once your profile has been verified.
          </p>
          <p className="text-muted">
            In the meantime, you can check the status later or return to the
            homepage.
          </p>

          <div className="status-actions">
            <button
              className="button primary"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <span className="loading-spinner"></span>
              ) : (
                <>
                  <RefreshCw size={16} className="icon" />
                  Refresh Status
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
