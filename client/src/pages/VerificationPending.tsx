import { useState } from 'react';
import { useLocation, Navigate, Link } from 'react-router-dom';
import { MailCheck, CheckCircle } from 'lucide-react';
import { ThemeToggle } from '../components/theme-toggle';
import { resendVerificationEmail } from '../lib/auth';
import '../styles/variables.css';
import '../styles/pages/VerificationPending.css';
import '../styles/components/button.css';

export function VerificationPending() {
  const location = useLocation();
  const email = location.state?.email;
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError('An error occurred while resending the verification email.');
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
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
          We've sent a verification email to <span className="bold-text">{email}</span>.
          Click the link in the email to verify your account.
        </p>
        
        <div className="card-actions">
          {error && (
            <div className="error-container">
              {error}
            </div>
          )}
          
          {resendSuccess ? (
            <div className="success-message">
              <CheckCircle size={16} style={{ marginRight: '8px' }} />
              A new verification email has been sent.
            </div>
          ) : (
            <p className="text-muted">
              Didn't receive an email? Check your spam folder or request a new verification link.
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
              'Email Sent'
            ) : (
              'Resend verification email'
            )}
          </button>
          
          <div>
            <Link to="/login" className="auth-link">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 