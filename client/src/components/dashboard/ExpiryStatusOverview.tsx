import { useState, useEffect, useCallback } from "react";
import { 
  AlertTriangle, 
  AlertCircle, 
  CircleAlert, 
  Clock, 
  CheckCircle2,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { 
  getExpiryStatusCounts, 
  type ExpiryStatusResponse 
} from "../../services/api/jobseekerMetrics";
import { useLanguage } from "../../contexts/language/language-provider";
import "./ExpiryStatusOverview.css";

interface ExpiryStatusCardProps {
  title: string;
  status: "expired" | "critical" | "warning" | "caution" | "valid";
  count: number;
  icon: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
}

function ExpiryStatusCard({ 
  title, 
  status, 
  count, 
  icon, 
  onClick,
  loading = false 
}: ExpiryStatusCardProps) {

  if (loading) {
    return (
      <div className="expiry-status-card">
        <div className="expiry-status-header">
          <div className="skeleton-icon"></div>
          <div className="expiry-status-content">
            <div className="skeleton-text" style={{ width: "80px", height: "12px" }}></div>
            <div className="skeleton-text" style={{ width: "40px", height: "16px", marginTop: "2px" }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`expiry-status-card ${status} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
    >
      <div className="expiry-status-header">
        <div className={`expiry-status-icon ${status}`}>
          {icon}
        </div>
        <div className="expiry-status-content">
          <h4 className="expiry-status-title">{title}</h4>
          <span className="expiry-status-count">{count.toLocaleString()}</span>
        </div>
        {onClick && (
          <div className="expiry-status-action">
            <ExternalLink size={16} />
          </div>
        )}
      </div>
    </div>
  );
}

interface DocumentTypeOverviewProps {
  title: string;
  data: {
    expired: number;
    expiringUnder30: number;
    expiringUnder60: number;
    expiringUnder90: number;
    expiringAfter90: number;
    totalWithData: number;
  };
  loading?: boolean;
  onNavigate: () => void;
}

function DocumentTypeOverview({ title, data, loading = false, onNavigate }: DocumentTypeOverviewProps) {
  const { t } = useLanguage();

  const cards = [
    {
      title: t('sinWorkPermitManagement.filters.expired'),
      status: "expired" as const,
      count: data.expired,
      icon: <AlertTriangle size={24} />,
      filter: "expired"
    },
    {
      title: t('sinWorkPermitManagement.filters.expiringUnder30'),
      status: "critical" as const,
      count: data.expiringUnder30,
      icon: <AlertCircle size={24} />,
      filter: "expiring-30"
    },
    {
      title: t('sinWorkPermitManagement.filters.expiringUnder60'),
      status: "warning" as const,
      count: data.expiringUnder60,
      icon: <CircleAlert size={24} />,
      filter: "expiring-60"
    },
    {
      title: t('sinWorkPermitManagement.filters.expiringUnder90'),
      status: "caution" as const,
      count: data.expiringUnder90,
      icon: <Clock size={24} />,
      filter: "expiring-90"
    },
    {
      title: t('sinWorkPermitManagement.filters.expiringAfter90'),
      status: "valid" as const,
      count: data.expiringAfter90,
      icon: <CheckCircle2 size={24} />,
      filter: "expiring-after-90"
    }
  ];

  return (
    <div className="document-type-overview" onClick={onNavigate}>
      <div className="document-type-header">
        <h3 className="document-type-title">{title}</h3>
        <span className="document-type-total">
          {loading ? (
            <div className="skeleton-text" style={{ width: "40px", height: "10px" }}></div>
          ) : (
            `${data.totalWithData.toLocaleString()} ${t('dashboard.expiry.totalDocuments')}`
          )}
        </span>
      </div>
      
      <div className="expiry-status-grid">
        {cards.map((card) => (
          <ExpiryStatusCard
            key={card.filter}
            title={card.title}
            status={card.status}
            count={card.count}
            icon={card.icon}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
}

export function ExpiryStatusOverview() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<ExpiryStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getExpiryStatusCounts();
      setData(response);
    } catch (err) {
      console.error("Error fetching expiry status counts:", err);
      setError(err instanceof Error ? err.message : t('dashboard.expiry.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleNavigateToSinWorkPermit = useCallback(() => {
    navigate('/sin-work-permit-management');
  }, [navigate]);

  const handleRetry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <div className="expiry-status-overview">
        <div className="expiry-overview-header">
          <h2 className="expiry-overview-title">{t('dashboard.expiry.title')}</h2>
        </div>
        
        <div className="expiry-status-error">
          <div className="error-content">
            <AlertTriangle size={24} />
            <div className="error-text">
              <h4>{t('dashboard.expiry.errorTitle')}</h4>
              <p>{error}</p>
            </div>
          </div>
          <button className="retry-button" onClick={handleRetry}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="expiry-status-overview">
      <div className="expiry-overview-header">
        <h2 className="expiry-overview-title">{t('dashboard.expiry.title')}</h2>
        <p className="expiry-overview-description">
          {t('dashboard.expiry.description')}
        </p>
      </div>

      <div className="expiry-documents-grid">
        <DocumentTypeOverview
          title={t('dashboard.expiry.sinDocuments')}
          data={data?.sin || {
            expired: 0,
            expiringUnder30: 0,
            expiringUnder60: 0,
            expiringUnder90: 0,
            expiringAfter90: 0,
            totalWithData: 0
          }}
          loading={loading}
          onNavigate={handleNavigateToSinWorkPermit}
        />
        
        <DocumentTypeOverview
          title={t('dashboard.expiry.workPermitDocuments')}
          data={data?.workPermit || {
            expired: 0,
            expiringUnder30: 0,
            expiringUnder60: 0,
            expiringUnder90: 0,
            expiringAfter90: 0,
            totalWithData: 0
          }}
          loading={loading}
          onNavigate={handleNavigateToSinWorkPermit}
        />
      </div>

    </div>
  );
}
