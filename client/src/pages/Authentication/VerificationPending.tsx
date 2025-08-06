import { useState } from "react";
import { useLocation, Navigate, Link } from "react-router-dom";
import { MailCheck, CheckCircle } from "lucide-react";
import { logoutUser, resendVerificationEmail } from "../../lib/auth";
import "../../styles/variables.css";
import "../../styles/pages/VerificationPending.css";
import "../../styles/components/button.css";
import { AppHeader } from "../../components/AppHeader";
import { useLanguage } from "../../contexts/language/language-provider";

export function VerificationPending() {
  const { t } = useLanguage();
  const location = useLocation();
  const email = location.state?.email;
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fromLogin = location.state?.fromLogin || false;

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
        setError(t('verificationPending.resendError'));
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

  return (
    <div className="page-container">
      <AppHeader title={t('verificationPending.title')} />
      <div className="centered-container">
        <div className="centered-card">
          <div className="icon-circle">
            <MailCheck />
          </div>

          <h1 className="auth-card-title">{t('verificationPending.checkEmailTitle')}</h1>

          <p dangerouslySetInnerHTML={{ __html: t('verificationPending.instructions', { email }) }} />

          <div className="card-actions">
            {error && <div className="error-container">{error}</div>}

            {resendSuccess ? (
              <div className="success-message">
                <CheckCircle size={16} style={{ marginRight: "8px" }} />{t('verificationPending.emailSent')}
              </div>
            ) : (
              <p className="text-muted">
                {t('verificationPending.notReceived')}
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
                t('verificationPending.emailSentButton')
              ) : (
                t('verificationPending.resendButton')
              )}
            </button>

            <div>
              <Link
                to="/login"
                className="auth-link"
                onClick={handleBackToLogin}
              >
                {t('verificationPending.backToLogin')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
