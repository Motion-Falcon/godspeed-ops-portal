import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Mail,
  User,
  Building,
  Clock,
  DollarSign,
  AlertCircle,
  FileText,
  CheckCircle,
  Download,
  Receipt,
  MapPin,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { Loader } from "../../components/Loader";
import { useLanguage } from "../../contexts/language/language-provider";
import { supabase } from "../../lib/supabaseClient";
import {
  getTimesheet,
  sendTimesheetEmails,
} from "../../services/api/timesheet";
import type { TimesheetWithJoins } from "../../services/types/timesheet";
import "../../styles/pages/TimesheetView.css";

export function TimesheetView() {
  const { id: paramId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const timesheetId = paramId || searchParams.get("id");

  const [timesheet, setTimesheet] = useState<TimesheetWithJoins | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  // Signed document URL state
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimesheetDetails = async () => {
      if (!timesheetId) {
        setError("Timesheet ID is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getTimesheet(timesheetId);
        setTimesheet(data);

        // Fetch PDF signed URL if document path exists
        if (data.document) {
          fetchSignedPdfUrl(data.document);
        }
      } catch (err) {
        console.error("Error fetching timesheet details:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load timesheet details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTimesheetDetails();
  }, [timesheetId]);

  const fetchSignedPdfUrl = async (path: string) => {
    try {
      const cleanPath = path.replace(/&#x2F;/g, "/");
      const { data, error: storageErr } = await supabase.storage
        .from("invoices")
        .createSignedUrl(cleanPath, 3600);

      if (data?.signedUrl) {
        setPdfSignedUrl(data.signedUrl);
      } else if (storageErr) {
        console.error("Error creating signed URL for timesheet document:", storageErr);
      }
    } catch (err) {
      console.error("Error fetching signed URL:", err);
    }
  };

  const handleSendEmail = async () => {
    if (!timesheetId || !timesheet) return;
    try {
      setIsSendingEmail(true);
      setError(null);
      const res = await sendTimesheetEmails(timesheetId);
      setStatusMessage(res.message || "Email sent successfully.");
      setTimesheet((prev) => (prev ? { ...prev, email_sent: true } : prev));
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error("Error sending timesheet email:", err);
      setError(
        err instanceof Error ? err.message : "Failed to send email."
      );
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleDownloadPdf = () => {
    if (pdfSignedUrl) {
      window.open(pdfSignedUrl, "_blank");
    }
  };

  const handleEdit = () => {
    if (!timesheet) return;
    const profileId = timesheet.jobseeker_profiles?.id ?? "";
    const clientId = timesheet.positions?.client ?? "";
    const positionId = timesheet.positions?.id ?? "";
    const weekStart = timesheet.week_start_date ?? "";

    const params = new URLSearchParams();
    if (profileId) params.set("profileId", profileId);
    if (clientId) params.set("clientId", clientId);
    if (positionId) params.set("positionId", positionId);
    if (weekStart) params.set("weekStart", weekStart);

    if (timesheet.is_bulk) {
      navigate(`/bulk-timesheet-management/jobseeker?${params.toString()}`);
    } else {
      navigate(`/timesheet-management?${params.toString()}`);
    }
  };

  if (loading) {
    return (
      <div className="timesheet-view-page-container">
        <AppHeader title={t("timesheetForm.viewTitle") || "View Timesheet"} />
        <div className="timesheet-view-loading-container">
          <Loader variant="inline" size="lg" message={t("common.loading") || "Loading..."} />
        </div>
      </div>
    );
  }

  if (error || !timesheet) {
    return (
      <div className="timesheet-view-page-container">
        <AppHeader title={t("timesheetForm.viewTitle") || "View Timesheet"} />
        <div className="timesheet-view-content">
          <div className="timesheet-view-card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <AlertCircle size={48} color="#ef4444" style={{ marginBottom: "16px" }} />
            <h3>{error || "Timesheet not found"}</h3>
            <button
              className="button secondary"
              style={{ marginTop: "16px" }}
              onClick={() => navigate("/timesheet-management/list")}
            >
              <ArrowLeft size={16} /> Back to Timesheet List
            </button>
          </div>
        </div>
      </div>
    );
  }

  const profile = timesheet.jobseeker_profiles;
  const position = timesheet.positions;

  const fullName = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
    : "Unknown Jobseeker";

  const dailyHoursList = Array.isArray(timesheet.daily_hours)
    ? timesheet.daily_hours
    : [];

  const positionLocation = [position?.city, position?.province].filter(Boolean).join(", ");

  return (
    <div className="timesheet-view-page-container">
      <AppHeader
        title={`View Timesheet #${timesheet.invoice_number || timesheet.id}`}
        statusMessage={statusMessage || error}
        statusType={error ? "error" : "success"}
        actions={
          <div className="timesheet-view-actions-group">
            <button
              className="button secondary"
              onClick={() => navigate("/timesheet-management/list")}
            >
              <ArrowLeft size={16} /> Back to List
            </button>
            {pdfSignedUrl && (
              <button
                className="button secondary"
                onClick={handleDownloadPdf}
              >
                <Download size={16} /> Download PDF
              </button>
            )}
            <button
              className="button secondary"
              onClick={handleSendEmail}
              disabled={isSendingEmail}
            >
              <Mail size={16} /> {isSendingEmail ? "Sending..." : timesheet.email_sent ? "Resend Email" : "Send Email"}
            </button>
            <button className="button primary" onClick={handleEdit}>
              <Pencil size={16} /> Edit Timesheet
            </button>
          </div>
        }
      />

      <div className="timesheet-view-content">
        <div className="timesheet-view-grid">
          {/* Main Content Column */}
          <div className="timesheet-view-left-col">
            {/* Overview / Header Card */}
            <div className="timesheet-view-card">
              <div className="timesheet-view-card-header">
                <h2 className="timesheet-view-card-title">
                  <FileText size={20} /> Timesheet Overview
                </h2>
                {timesheet.email_sent ? (
                  <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle size={14} /> Email Sent
                  </span>
                ) : (
                  <span className="badge badge-warning">Email Not Sent</span>
                )}
              </div>

              <div className="timesheet-meta-grid">
                <div className="timesheet-meta-item">
                  <span className="timesheet-meta-label">Invoice Number</span>
                  <span className="timesheet-meta-value">#{timesheet.invoice_number || "-"}</span>
                </div>
                <div className="timesheet-meta-item">
                  <span className="timesheet-meta-label">Week Period</span>
                  <span className="timesheet-meta-value">
                    {timesheet.week_start_date} to {timesheet.week_end_date}
                  </span>
                </div>
                <div className="timesheet-meta-item">
                  <span className="timesheet-meta-label">Total Regular Hours</span>
                  <span className="timesheet-meta-value">{timesheet.total_regular_hours} hrs</span>
                </div>
                <div className="timesheet-meta-item">
                  <span className="timesheet-meta-label">Total Overtime Hours</span>
                  <span className="timesheet-meta-value">{timesheet.total_overtime_hours} hrs</span>
                </div>
                {timesheet.created_at && (
                  <div className="timesheet-meta-item">
                    <span className="timesheet-meta-label">Created At</span>
                    <span className="timesheet-meta-value">
                      {new Date(timesheet.created_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Daily Hours Breakdown Card */}
            <div className="timesheet-view-card">
              <div className="timesheet-view-card-header">
                <h3 className="timesheet-view-card-title">
                  <Clock size={18} /> Daily Hours Entry
                </h3>
              </div>
              <table className="timesheet-daily-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Hours Logged</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyHoursList.length > 0 ? (
                    dailyHoursList.map((entry, index) => (
                      <tr key={index}>
                        <td>{entry.date}</td>
                        <td>
                          <strong>{entry.hours} hrs</strong>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        No daily hours recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Additional Notes Card */}
            {timesheet.notes && (
              <div className="timesheet-view-card">
                <div className="timesheet-view-card-header">
                  <h3 className="timesheet-view-card-title">
                    <FileText size={18} /> Additional Notes
                  </h3>
                </div>
                <p style={{ margin: 0, color: "var(--text)" }}>{timesheet.notes}</p>
              </div>
            )}
          </div>

          {/* Sidebar / Meta Column */}
          <div className="timesheet-view-right-col">
            {/* Jobseeker Info Card */}
            <div className="timesheet-view-card">
              <div className="timesheet-view-card-header">
                <h3 className="timesheet-view-card-title">
                  <User size={18} /> Jobseeker Details
                </h3>
              </div>
              <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
                <span className="timesheet-meta-label">Full Name</span>
                <span className="timesheet-meta-value">{fullName}</span>
              </div>
              <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
                <span className="timesheet-meta-label">Primary Email</span>
                <span className="timesheet-meta-value">{profile?.email || "-"}</span>
              </div>
              <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
                <span className="timesheet-meta-label">Billing Email</span>
                <span className="timesheet-meta-value">{profile?.billing_email || "-"}</span>
              </div>
              <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
                <span className="timesheet-meta-label">Payment Method</span>
                <span className="timesheet-meta-value">{profile?.payment_method || "-"}</span>
              </div>
              {profile?.cash_deduction && (
                <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
                  <span className="timesheet-meta-label">Cash Deduction</span>
                  <span className="timesheet-meta-value">{profile.cash_deduction}%</span>
                </div>
              )}
              {profile?.hst_gst && (
                <div className="timesheet-meta-item">
                  <span className="timesheet-meta-label">Tax Rate (HST/GST)</span>
                  <span className="timesheet-meta-value">{profile.hst_gst}%</span>
                </div>
              )}
            </div>

            {/* Client & Position Details */}
            <div className="timesheet-view-card">
              <div className="timesheet-view-card-header">
                <h3 className="timesheet-view-card-title">
                  <Building size={18} /> Client & Position
                </h3>
              </div>
              <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
                <span className="timesheet-meta-label">Client Name</span>
                <span className="timesheet-meta-value">{position?.client_name || "-"}</span>
              </div>
              <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
                <span className="timesheet-meta-label">Position Title</span>
                <span className="timesheet-meta-value">{position?.title || "-"}</span>
              </div>
              <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
                <span className="timesheet-meta-label">Position Code</span>
                <span className="timesheet-meta-value">{position?.position_code || "-"}</span>
              </div>
              {positionLocation && (
                <div className="timesheet-meta-item">
                  <span className="timesheet-meta-label">Location</span>
                  <span className="timesheet-meta-value" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <MapPin size={14} /> {positionLocation}
                  </span>
                </div>
              )}
            </div>

            {/* Pay & Rates Summary Card */}
            <div className="timesheet-view-card">
              <div className="timesheet-view-card-header">
                <h3 className="timesheet-view-card-title">
                  <DollarSign size={18} /> Jobseeker Pay & Rates
                </h3>
              </div>
              <table className="timesheet-pay-summary-table">
                <tbody>
                  <tr>
                    <td className="timesheet-pay-summary-label">Regular Pay Rate</td>
                    <td className="timesheet-pay-summary-value">${timesheet.regular_pay_rate?.toFixed(2)}/hr</td>
                  </tr>
                  {timesheet.premium_pay_rate > 0 && (
                    <tr>
                      <td className="timesheet-pay-summary-label">Premium Rate</td>
                      <td className="timesheet-pay-summary-value">${timesheet.premium_pay_rate?.toFixed(2)}/hr</td>
                    </tr>
                  )}
                  {timesheet.overtime_pay_rate > 0 && (
                    <tr>
                      <td className="timesheet-pay-summary-label">Overtime Rate</td>
                      <td className="timesheet-pay-summary-value">${timesheet.overtime_pay_rate?.toFixed(2)}/hr</td>
                    </tr>
                  )}
                  {Number(timesheet.bonus_amount) > 0 ? (
                    <tr>
                      <td className="timesheet-pay-summary-label">Bonus</td>
                      <td className="timesheet-pay-summary-value">+${Number(timesheet.bonus_amount).toFixed(2)}</td>
                    </tr>
                  ) : null}
                  {Number(timesheet.deduction_amount) > 0 ? (
                    <tr>
                      <td className="timesheet-pay-summary-label">Deduction</td>
                      <td className="timesheet-pay-summary-value">-${Number(timesheet.deduction_amount).toFixed(2)}</td>
                    </tr>
                  ) : null}
                  {Number(timesheet.tax_amount) > 0 ? (
                    <tr>
                      <td className="timesheet-pay-summary-label">Tax (HST/GST)</td>
                      <td className="timesheet-pay-summary-value">+${Number(timesheet.tax_amount).toFixed(2)}</td>
                    </tr>
                  ) : null}
                  <tr className="timesheet-grand-total-row">
                    <td className="timesheet-pay-summary-label" style={{ color: "var(--text)", fontWeight: 700 }}>
                      Grand Total Pay
                    </td>
                    <td className="timesheet-pay-summary-value">
                      ${timesheet.total_jobseeker_pay?.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Client Billing Summary Card (if bill rates available) */}
            {(timesheet.regular_bill_rate > 0 || timesheet.total_client_bill > 0) && (
              <div className="timesheet-view-card">
                <div className="timesheet-view-card-header">
                  <h3 className="timesheet-view-card-title">
                    <Receipt size={18} /> Client Billing Summary
                  </h3>
                </div>
                <table className="timesheet-pay-summary-table">
                  <tbody>
                    {timesheet.regular_bill_rate > 0 && (
                      <tr>
                        <td className="timesheet-pay-summary-label">Regular Bill Rate</td>
                        <td className="timesheet-pay-summary-value">${timesheet.regular_bill_rate?.toFixed(2)}/hr</td>
                      </tr>
                    )}
                    {timesheet.overtime_bill_rate > 0 && (
                      <tr>
                        <td className="timesheet-pay-summary-label">Overtime Bill Rate</td>
                        <td className="timesheet-pay-summary-value">${timesheet.overtime_bill_rate?.toFixed(2)}/hr</td>
                      </tr>
                    )}
                    {timesheet.total_client_bill > 0 && (
                      <tr className="timesheet-grand-total-row">
                        <td className="timesheet-pay-summary-label" style={{ color: "var(--text)", fontWeight: 700 }}>
                          Total Client Bill
                        </td>
                        <td className="timesheet-pay-summary-value">
                          ${timesheet.total_client_bill?.toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimesheetView;
