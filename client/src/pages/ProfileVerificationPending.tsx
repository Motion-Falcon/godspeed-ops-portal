import '../styles/pages/StatusPages.css'; // Using the CSS file we created earlier
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../lib/auth';
import { useState } from 'react';

export function ProfileVerificationPending() {
  const { refetchProfileStatus } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = async () => {
    await logoutUser();
    window.location.href = '/login';
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchProfileStatus();
    setTimeout(() => setRefreshing(false), 1000); // Give user visual feedback
  };

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
        
        <div className="status-actions">
          <button 
            className="button primary"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Status'}
          </button>
          <button 
            className="button secondary"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
} 