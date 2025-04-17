import { Link } from 'react-router-dom';
import '../styles/pages/StatusPages.css'; // Using the CSS file we created earlier

export function ProfileVerificationPending() {
  return (
    <div className="status-page-container">
      <div className="status-box">
        <h1 className="status-title">Profile Verification Pending</h1>
        <p className="status-message">
          Thank you for submitting your profile! Your information is currently under review.
        </p>
        <p className="status-message">
          This process usually takes 1-2 business days. We will notify you via email once your profile has been verified.
        </p>
        <p className="status-message">
          In the meantime, you can check the status later or return to the homepage.
        </p>
        <Link to="/dashboard" className="button primary status-button"> {/* Link to dashboard or homepage */}
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
} 