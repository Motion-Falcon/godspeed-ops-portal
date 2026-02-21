import React from "react";
import { XCircle, User, Mail, Calendar, Info, ShieldCheck, Clock, Type } from "lucide-react";
import { ConsentRecord } from "../../services/api/consent";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/components/ConsentRecordDetailModal.css";

interface ConsentRecordDetailModalProps {
  isOpen: boolean;
  record: ConsentRecord | null;
  onClose: () => void;
  formatDate: (date?: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getTypeDisplay: (type: string) => string;
}

export function ConsentRecordDetailModal({
  isOpen,
  record,
  onClose,
  formatDate,
  getStatusIcon,
  getTypeDisplay,
}: ConsentRecordDetailModalProps) {
  const { t } = useLanguage();

  if (!isOpen || !record) return null;

  return (
    <div className="record-detail-modal-overlay" onClick={onClose}>
      <div className="record-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="record-detail-header">
          <h3 className="record-detail-title">
            <Info size={22} className="status-icon completed" style={{ color: "var(--primary)" }} />
            {t("consent.detail.recipientDetails")}
          </h3>
          <button className="record-close-button" onClick={onClose} aria-label="Close">
            <XCircle size={24} />
          </button>
        </div>

        <div className="record-detail-content">
          <div className="record-detail-grid">
            <div className="record-detail-item">
              <div className="record-detail-header-info">
                <User size={16} className="record-detail-icon" />
                <span className="record-detail-label">
                  {t("consent.detail.table.recipientName")}
                </span>
              </div>
              <span className="record-detail-value">
                {record.entityName || t("consent.common.unknown")}
              </span>
            </div>

            <div className="record-detail-item">
              <div className="record-detail-header-info">
                <Mail size={16} className="record-detail-icon" />
                <span className="record-detail-label">
                  {t("consent.detail.table.email")}
                </span>
              </div>
              <span className="record-detail-value">
                {record.entityEmail || t("consent.common.notAvailable")}
              </span>
            </div>

            <div className="record-detail-item">
              <div className="record-detail-header-info">
                <Type size={16} className="record-detail-icon" />
                <span className="record-detail-label">
                  {t("consent.detail.table.type")}
                </span>
              </div>
              <span className="record-detail-value">
                <span className={`type-badge ${record.consentableType}`}>
                  {getTypeDisplay(record.consentableType)}
                </span>
              </span>
            </div>

            <div className="record-detail-item">
              <div className="record-detail-header-info">
                <ShieldCheck size={16} className="record-detail-icon" />
                <span className="record-detail-label">
                  {t("consent.detail.table.status")}
                </span>
              </div>
              <span className="record-detail-value">
                {getStatusIcon(record.status)}
                <span className={`status-text ${record.status}`} style={{ textTransform: "capitalize", margin: 0 }}>
                  {record.status === 'completed' ? t("consent.detail.status.completed") :
                    record.status === 'pending' ? t("consent.detail.status.pending") :
                      record.status === 'expired' ? t("consent.detail.status.expired") :
                        record.status}
                </span>
              </span>
            </div>

            <div className="record-detail-item">
              <div className="record-detail-header-info">
                <Calendar size={16} className="record-detail-icon" />
                <span className="record-detail-label">
                  {t("consent.detail.table.sentDate")}
                </span>
              </div>
              <span className="record-detail-value">{formatDate(record.sentAt)}</span>
            </div>

            <div className="record-detail-item">
              <div className="record-detail-header-info">
                <Clock size={16} className="record-detail-icon" />
                <span className="record-detail-label">
                  {t("consent.detail.table.completedDate")}
                </span>
              </div>
              <span className="record-detail-value">
                {record.completedAt
                  ? formatDate(record.completedAt)
                  : t("consent.detail.notCompleted")}
              </span>
            </div>

            {record.consentedName && (
              <div className="record-detail-item full-width">
                <div className="record-detail-header-info">
                  <User size={16} className="record-detail-icon" />
                  <span className="record-detail-label">
                    {t("consent.detail.consentedName")}
                  </span>
                </div>
                <span className="record-detail-value">{record.consentedName}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
