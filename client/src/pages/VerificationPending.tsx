import { useState } from "react";
import { useLocation, Navigate, Link } from "react-router-dom";
import { MailCheck, CheckCircle, LogOut } from "lucide-react";
import { ThemeToggle } from "../components/theme-toggle";
import { resendVerificationEmail, logoutUser } from "../lib/auth";
import "../styles/variables.css";
import "../styles/pages/VerificationPending.css";
import "../styles/components/button.css";
import { AppHeader } from "../components/AppHeader";

export function VerificationPending() {
  const location = useLocation();
  const email = location.state?.email;
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fromLogin = location.state?.fromLogin || false;
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // If the page is accessed directly without an email, redirect to signup
  if (!email) {
    return <Navigate to="/signup" replace />;
  }

  const handleResendVerification = async () => {
    try {
      setIsResending(true);
      setError(null);
      await resendVerificationEmail(email);
      setResendSuccess(true);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An error occurred while resending the verification email.");
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToLogin = async () => {
    // If user came from login, we need to log them out first
    if (fromLogin) {
      try {
        await logoutUser();
      } catch (error) {
        console.error("Error logging out:", error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logoutUser();
      // No need to navigate - the auth listener will handle this
    } catch (error) {
      console.error("Error logging out:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <AppHeader
        title="Email Verification"
        actions={
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
        }
      />
      <div className="centered-container">
        <div className="centered-card">
          <div className="toggle-container">
            <ThemeToggle />
          </div>

          <div className="icon-circle">
            <MailCheck />
          </div>

          <h1 className="auth-card-title">Check your email</h1>

          <p>
            We've sent a verification email to{" "}
            <span className="bold-text">{email}</span>. Click the link in the
            email to verify your account.
          </p>

          <div className="card-actions">
            {error && <div className="error-container">{error}</div>}

            {resendSuccess ? (
              <div className="success-message">
                <CheckCircle size={16} style={{ marginRight: "8px" }} />A new
                verification email has been sent.
              </div>
            ) : (
              <p className="text-muted">
                Didn't receive an email? Check your spam folder or request a new
                verification link.
              </p>
            )}

            <button
              className="button outline"
              onClick={handleResendVerification}
              disabled={isResending || resendSuccess}
            >
              {isResending ? (
                <span className="loading-spinner"></span>
              ) : resendSuccess ? (
                "Email Sent"
              ) : (
                "Resend verification email"
              )}
            </button>

            <div>
              <Link
                to="/login"
                className="auth-link"
                onClick={handleBackToLogin}
              >
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
