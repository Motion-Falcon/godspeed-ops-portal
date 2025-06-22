import { useAuth } from "../contexts/AuthContext";
import { useState, useEffect } from "react";
import { AppHeader } from "../components/AppHeader";
import { AlertCircle, Edit, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "../styles/pages/VerificationPages.css";

export function ProfileVerificationRejected() {
  const { refetchProfileStatus, user } = useAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showFullRejectionReason, setShowFullRejectionReason] = useState<boolean>(false);

  useEffect(() => {
    // Fetch the user's profile to get the rejection reason
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('jobseeker_profiles')
          .select('id, rejection_reason')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          console.error("Error fetching profile:", error);
          setError("Failed to fetch profile details");
        } else if (data) {
          setRejectionReason(data.rejection_reason || "No reason provided");
          setProfileId(data.id);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch profile details");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchProfileStatus();
    setTimeout(() => setRefreshing(false), 1000); // Give user visual feedback
  };

  const handleUpdateProfile = () => {
    if (profileId) {
      navigate(`/jobseekers/${profileId}/edit`);
    } else {
      navigate('/profile/create');
    }
  };

  const showToggle = rejectionReason.length > 200;

  return (
    <div className="page-container">
      <AppHeader
        title="Profile Verification"
      />
      <div className="profile-verification-rejected centered-container">
        <div className="centered-card">
          <div className="verification-status rejected">
            <AlertCircle size={24} className="verification-icon" />
            <h1 className="auth-card-title">Profile Verification Rejected</h1>
          </div>

          <p className="text-muted">
            We're sorry, but your profile verification has been rejected. Please review the rejection reason below and update your profile accordingly.
          </p>

          {loading ? (
            <div className="loading-container">
              <span className="loading-spinner"></span>
              <p>Loading profile details...</p>
            </div>
          ) : error ? (
            <div className="error-message">
              {error}
            </div>
          ) : (
            <div className="profile-rejection-reason">
              <div className="rejection-reason-header">
                <AlertCircle size={16} className="rejection-reason-icon" />
                <span className="rejection-reason-title">Rejection Reason</span>
              </div>
              <div className={`rejection-reason-content ${showFullRejectionReason ? 'expanded' : ''}`}>
                {rejectionReason}
              </div>
              {showToggle && (
                <button 
                  className="toggle-rejection-btn"
                  onClick={() => setShowFullRejectionReason(!showFullRejectionReason)}
                >
                  {showFullRejectionReason ? 'Show less' : 'Show full reason'}
                </button>
              )}
            </div>
          )}

          <p className="text-muted">
            After updating your profile, our team will review your information again. You'll receive an email once your profile has been verified.
          </p>

          <div className="verification-actions">
            <button
              className="button primary"
              onClick={handleUpdateProfile}
              disabled={loading}
            >
              <Edit size={16} className="icon" />
              Update Profile
            </button>
            
            <button
              className="button secondary"
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
    </div>
  );
} 