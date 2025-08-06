import { useAuth } from "../../contexts/AuthContext";
import { useState, useEffect } from "react";
import { AppHeader } from "../../components/AppHeader";
import { AlertCircle, Edit, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/pages/VerificationPages.css";

export function ProfileVerificationRejected() {
  const { refetchProfileStatus, user } = useAuth();
  const { t } = useLanguage();
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
          setError(t('profileVerification.rejected.errorFetchingProfile'));
        } else if (data) {
          setRejectionReason(data.rejection_reason || t('profileVerification.rejected.noReason'));
          setProfileId(data.id);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError(err instanceof Error ? err.message : t('profileVerification.rejected.errorFetchingProfile'));
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, t]);

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
        title={t('profileVerification.title')}
      />
      <div className="profile-verification-rejected centered-container">
        <div className="centered-card">
          <div className="verification-status rejected">
            <AlertCircle size={24} className="verification-icon" />
            <h1 className="auth-card-title">{t('profileVerification.rejected.heading')}</h1>
          </div>

          <p className="text-muted">
            {t('profileVerification.rejected.sorry')}
          </p>

          {loading ? (
            <div className="loading-container">
              <span className="loading-spinner"></span>
              <p>{t('profileVerification.rejected.loading')}</p>
            </div>
          ) : error ? (
            <div className="error-message">
              {error}
            </div>
          ) : (
            <div className="profile-rejection-reason">
              <div className="rejection-reason-header">
                <AlertCircle size={16} className="rejection-reason-icon" />
                <span className="rejection-reason-title">{t('profileVerification.rejected.rejectionReason')}</span>
              </div>
              <div className={`rejection-reason-content ${showFullRejectionReason ? 'expanded' : ''}`}>
                {rejectionReason}
              </div>
              {showToggle && (
                <button 
                  className="toggle-rejection-btn"
                  onClick={() => setShowFullRejectionReason(!showFullRejectionReason)}
                >
                  {showFullRejectionReason ? t('profileVerification.rejected.showLess') : t('profileVerification.rejected.showFullReason')}
                </button>
              )}
            </div>
          )}

          <p className="text-muted">
            {t('profileVerification.rejected.afterUpdate')}
          </p>

          <div className="verification-actions">
            <button
              className="button primary"
              onClick={handleUpdateProfile}
              disabled={loading}
            >
              <Edit size={16} className="icon" />
              {t('profileVerification.buttons.updateProfile')}
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
                  {t('profileVerification.buttons.refreshStatus')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 