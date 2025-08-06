import { useAuth } from "../../contexts/AuthContext";
import { useState } from "react";
import { AppHeader } from "../../components/AppHeader";
import { RefreshCw } from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";

export function ProfileVerificationPending() {
  const { refetchProfileStatus } = useAuth();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchProfileStatus();
    setTimeout(() => setRefreshing(false), 1000); // Give user visual feedback
  };

  return (
    <div className="page-container">
      <AppHeader
        title={t('profileVerification.title')}
      />
      <div className="centered-container">
        <div className="centered-card">
          <h1 className="auth-card-title">{t('profileVerification.pending.heading')}</h1>
          <p className="text-muted">
            {t('profileVerification.pending.thankYou')}
          </p>
          <p className="text-muted">
            {t('profileVerification.pending.processTime')}
          </p>
          <p className="text-muted">
            {t('profileVerification.pending.meantime')}
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
