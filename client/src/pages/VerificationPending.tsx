import { useLocation, Navigate, Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { ThemeToggle } from '../components/theme-toggle';
import '../styles/variables.css';
import '../styles/pages/VerificationPending.css';
import '../styles/components/button.css';

export function VerificationPending() {
  const location = useLocation();
  const email = location.state?.email;

  // If the page is accessed directly without an email, redirect to signup
  if (!email) {
    return <Navigate to="/signup" replace />;
  }

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
          <p className="text-muted">
            Didn't receive an email? Check your spam folder or request a new verification link.
          </p>
          
          <button className="button outline">
            Resend verification email
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