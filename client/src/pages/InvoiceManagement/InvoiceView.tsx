import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  FileText,
  Building,
  DollarSign,
  User,
  Mail,
  Pencil,
  ArrowLeft,
  Download,
  CheckCircle,
  Clock,
  Loader2,
  Paperclip,
  Eye,
  AlertCircle,
} from "lucide-react";
import {
  getInvoice,
  InvoiceData,
  formatInvoiceForDisplay,
  sendInvoiceEmail,
} from "../../services/api/invoice";
import { getClient, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import { Loader } from "../../components/Loader";
import { useLanguage } from "../../contexts/language/language-provider";
import { supabase } from "../../lib/supabaseClient";
import "../../styles/pages/InvoiceView.css";

interface TimesheetItem {
  id?: string;
  description?: string;
  salesTax?: string;
  totalRegularHours?: number;
  totalOvertimeHours?: number;
  regularBillRate?: number | string;
  overtimeBillRate?: number | string;
  regularPayRate?: number | string;
  totalClientBill?: number;
  position?: {
    title?: string;
    positionCode?: string;
  };
  jobseekerProfile?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    employeeId?: string;
  };
}

interface SupplierPOItem {
  id?: string;
  selectedOption?: string;
  supplierPoNumber?: string;
}

interface AttachmentItem {
  id?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  filePath?: string;
  url?: string;
}

export function InvoiceView() {
  const { id: paramId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const invoiceId = paramId || searchParams.get("id");

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Email modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState<string>("");
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState<string | null>(null);

  // Signed PDF URL
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);
  const [isGeneratingPdfUrl, setIsGeneratingPdfUrl] = useState<boolean>(false);

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      if (!invoiceId) {
        setError("Invoice ID is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getInvoice(invoiceId);
        setInvoice(data);

        // Fetch client details if client object not fully attached
        if (data.clientId) {
          try {
            const clientData = await getClient(data.clientId);
            setClient(clientData);
          } catch (clientErr) {
            console.error("Error loading detailed client data:", clientErr);
          }
        }

        // Set default email address for sending
        const recipientEmail =
          data.invoice_sent_to ||
          data.client?.emailAddress1 ||
          "";
        setEmailInput(recipientEmail);

        // Fetch PDF signed URL if document path exists
        if (data.documentPath) {
          fetchSignedPdfUrl(data.documentPath);
        }
      } catch (err) {
        console.error("Error fetching invoice details:", err);
        setError(err instanceof Error ? err.message : "Failed to load invoice details");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceDetails();
  }, [invoiceId]);

  const fetchSignedPdfUrl = async (path: string) => {
    try {
      setIsGeneratingPdfUrl(true);
      const cleanPath = path.replace(/&#x2F;/g, "/");
      const { data, error: storageErr } = await supabase.storage
        .from("invoices")
        .createSignedUrl(cleanPath, 3600); // 1 hour expiration

      if (data?.signedUrl) {
        setPdfSignedUrl(data.signedUrl);
      } else if (storageErr) {
        console.error("Error creating signed URL for invoice PDF:", storageErr);
      }
    } catch (err) {
      console.error("Failed to generate PDF URL:", err);
    } finally {
      setIsGeneratingPdfUrl(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!pdfSignedUrl && invoice?.documentPath) {
      await fetchSignedPdfUrl(invoice.documentPath);
    }

    if (pdfSignedUrl) {
      const a = document.createElement("a");
      a.href = pdfSignedUrl;
      a.download = invoice?.documentFileName || `Invoice_${invoice?.invoiceNumber || "document"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleSendEmailSubmit = async () => {
    if (!invoiceId || !emailInput.trim()) return;

    try {
      setIsSendingEmail(true);
      setEmailStatusMessage(null);
      const response = await sendInvoiceEmail(invoiceId, emailInput.trim());

      if (response.success) {
        setEmailStatusMessage(`Invoice successfully sent to ${emailInput.trim()}`);
        setInvoice((prev) => (prev ? { ...prev, emailSent: true } : prev));
        setTimeout(() => {
          setIsEmailModalOpen(false);
          setEmailStatusMessage(null);
        }, 2000);
      } else {
        throw new Error(response.message || "Failed to send invoice email");
      }
    } catch (err) {
      console.error("Error sending invoice email:", err);
      setEmailStatusMessage(err instanceof Error ? err.message : "Failed to send invoice email");
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="invoice-view-page-container">
        <AppHeader title={t("invoiceManagement.viewInvoice") || "View Client Invoice"} />
        <div className="invoice-view-loading-container">
          <Loader variant="inline" size="lg" message={t("common.loading")} />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="invoice-view-page-container">
        <AppHeader title={t("invoiceManagement.viewInvoice") || "View Client Invoice"} />
        <div className="invoice-view-content">
          <div className="invoice-view-card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <AlertCircle size={48} color="#ef4444" style={{ marginBottom: "16px" }} />
            <h3>{error || "Invoice not found"}</h3>
            <button
              className="button secondary"
              style={{ marginTop: "16px" }}
              onClick={() => navigate("/invoice-management/list")}
            >
              <ArrowLeft size={16} /> Back to Invoice List
            </button>
          </div>
        </div>
      </div>
    );
  }

  const formatted = formatInvoiceForDisplay(invoice);
  const clientData = client || invoice.client;

  // Complete address format
  const addressParts = [
    clientData?.streetAddress1,
    clientData?.city1,
    clientData?.province1,
    clientData?.postalCode1,
  ].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : "N/A";

  // Parse invoice JSONB structure
  const rawData = invoice.invoiceData || {};
  const timesheets = (rawData.timesheets as TimesheetItem[]) || [];
  const supplierPOItems = (rawData.supplierPOItems as SupplierPOItem[]) || [];
  const attachments = (rawData.attachments as AttachmentItem[]) || [];
  const messageOnInvoice = (rawData.messageOnInvoice as string) || "";
  const termsOnInvoice = (rawData.termsOnInvoice as string) || "";

  return (
    <div className="invoice-view-page-container">
      <AppHeader
        title={`${t("invoiceManagement.viewInvoice") || "View Invoice"} #${invoice.invoiceNumber}`}
        actions={
          <div className="invoice-view-actions-group">
            <button
              className="button secondary"
              onClick={() => navigate("/invoice-management/list")}
            >
              <ArrowLeft size={16} />
              {t("buttons.back") || "Back to Invoices"}
            </button>
            <button
              className="button secondary button-icon"
              onClick={() => navigate(`/invoice-management/create?id=${invoice.id}`)}
            >
              <Pencil size={16} />
              {t("invoiceManagement.editInvoice") || "Edit Invoice"}
            </button>
            {invoice.documentPath && (
              <button
                className="button secondary button-icon"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdfUrl}
              >
                <Download size={16} />
                {t("invoiceManagement.download") || "Download PDF"}
              </button>
            )}
            <button
              className="button primary button-icon"
              onClick={() => setIsEmailModalOpen(true)}
            >
              <Mail size={16} />
              {invoice.emailSent ? "Resend Email" : "Send Email"}
            </button>
          </div>
        }
      />

      <div className="invoice-view-content">
        {/* Header Bar Banner */}
        <div className="invoice-view-header-bar">
          <div className="invoice-view-title-box">
            <h1 className="invoice-view-h1">
              Invoice #{invoice.invoiceNumber}
              {invoice.emailSent ? (
                <span className="invoice-status-badge sent">
                  <CheckCircle size={14} /> Emailed
                </span>
              ) : (
                <span className="invoice-status-badge pending">
                  <Clock size={14} /> Draft / Not Sent
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* Main Details Grid */}
        <div className="invoice-view-grid">
          {/* Left Column: Details & Line Items */}
          <div className="invoice-view-main-column">
            {/* Overview & Meta Card */}
            <div className="invoice-view-card">
              <div className="invoice-view-card-header">
                <h2 className="invoice-view-card-title">
                  <FileText size={18} /> Overview & Dates
                </h2>
              </div>
              <div className="invoice-meta-grid">
                <div className="invoice-meta-item">
                  <span className="invoice-meta-label">Invoice Number</span>
                  <span className="invoice-meta-value">#{invoice.invoiceNumber}</span>
                </div>
                <div className="invoice-meta-item">
                  <span className="invoice-meta-label">Invoice Date</span>
                  <span className="invoice-meta-value">{formatted.formattedInvoiceDate}</span>
                </div>
                <div className="invoice-meta-item">
                  <span className="invoice-meta-label">Due Date</span>
                  <span className="invoice-meta-value">{formatted.formattedDueDate}</span>
                </div>
                <div className="invoice-meta-item">
                  <span className="invoice-meta-label">Payment Terms</span>
                  <span className="invoice-meta-value">{invoice.paymentTerms || "Net 30"}</span>
                </div>
              </div>
            </div>

            {/* Line Items Table Card */}
            <div className="invoice-view-card">
              <div className="invoice-view-card-header">
                <h2 className="invoice-view-card-title">
                  <DollarSign size={18} /> Invoice Line Items ({timesheets.length})
                </h2>
              </div>
              <div className="invoice-table-wrapper">
                <table className="invoice-view-table">
                  <thead>
                    <tr>
                      <th>Position / Candidate</th>
                      <th>Description</th>
                      <th style={{ textAlign: "center" }}>Hours</th>
                      <th style={{ textAlign: "right" }}>Bill Rate</th>
                      <th style={{ textAlign: "center" }}>Tax Rate</th>
                      <th style={{ textAlign: "right" }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheets.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                          No line items available for this invoice.
                        </td>
                      </tr>
                    ) : (
                      timesheets.map((item, idx) => {
                        const regularHours = item.totalRegularHours || 0;
                        const overtimeHours = item.totalOvertimeHours || 0;
                        const totalHours = regularHours + overtimeHours;

                        const billRate =
                          typeof item.regularBillRate === "number"
                            ? item.regularBillRate
                            : parseFloat(item.regularBillRate || "0");

                        const lineTotal =
                          item.totalClientBill ||
                          totalHours * billRate;

                        const candidateName = item.jobseekerProfile
                          ? `${item.jobseekerProfile.firstName || ""} ${item.jobseekerProfile.lastName || ""}`.trim()
                          : "N/A";

                        const positionTitle = item.position?.title || item.position?.positionCode || "Position";

                        return (
                          <tr key={item.id || idx}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{positionTitle}</div>
                              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                Candidate: {candidateName}
                              </div>
                            </td>
                            <td>{item.description || "N/A"}</td>
                            <td style={{ textAlign: "center" }}>
                              {totalHours.toFixed(2)} hrs
                              {overtimeHours > 0 && (
                                <div style={{ fontSize: "0.75rem", color: "var(--warning-color, #d97706)" }}>
                                  ({overtimeHours.toFixed(2)} OT)
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              ${billRate.toFixed(2)} / hr
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {item.salesTax || "13.00% [ON]"}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>
                              ${lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Supplier PO Items Card (if present) */}
            {supplierPOItems.length > 0 && (
              <div className="invoice-view-card">
                <div className="invoice-view-card-header">
                  <h2 className="invoice-view-card-title">
                    <User size={18} /> Supplier & PO Numbers
                  </h2>
                </div>
                <ul style={{ paddingLeft: "20px", margin: 0 }}>
                  {supplierPOItems.map((po, idx) => (
                    <li key={po.id || idx} style={{ marginBottom: "8px" }}>
                      <strong>{po.selectedOption || "PO/Supplier"}:</strong> {po.supplierPoNumber || "N/A"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Additional Info / Terms & Notes Card */}
            <div className="invoice-view-card">
              <div className="invoice-view-card-header">
                <h2 className="invoice-view-card-title">
                  <FileText size={18} /> Messages & Terms
                </h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {messageOnInvoice && (
                  <div>
                    <span className="invoice-meta-label">Message on Invoice</span>
                    <p style={{ margin: "4px 0 0", color: "var(--text)" }}>{messageOnInvoice}</p>
                  </div>
                )}
                {termsOnInvoice && (
                  <div>
                    <span className="invoice-meta-label">Terms on Invoice</span>
                    <p style={{ margin: "4px 0 0", color: "var(--text)" }}>{termsOnInvoice}</p>
                  </div>
                )}
                {invoice.notes && (
                  <div>
                    <span className="invoice-meta-label">Internal Notes</span>
                    <p style={{ margin: "4px 0 0", color: "var(--text)" }}>{invoice.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Client Details & Financial Summary */}
          <div className="invoice-view-sidebar-column">
            {/* Client Info Card */}
            <div className="invoice-view-card">
              <div className="invoice-view-card-header">
                <h2 className="invoice-view-card-title">
                  <Building size={18} /> Client Information
                </h2>
              </div>
              <div className="invoice-client-details">
                <div className="invoice-client-name">
                  {clientData?.companyName || "Unknown Client"}
                </div>
                {clientData?.shortCode && (
                  <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                    Code: {clientData.shortCode}
                  </div>
                )}
                <div>
                  <span className="invoice-meta-label">Complete Address</span>
                  <div className="invoice-client-address">{fullAddress}</div>
                </div>
                <div>
                  <span className="invoice-meta-label">Client Email</span>
                  <div style={{ fontSize: "0.9375rem", color: "var(--text)" }}>
                    {invoice.invoice_sent_to || clientData?.emailAddress1 || "No email provided"}
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary Card */}
            <div className="invoice-view-card">
              <div className="invoice-view-card-header">
                <h2 className="invoice-view-card-title">
                  <DollarSign size={18} /> Financial Summary
                </h2>
              </div>
              <div className="invoice-summary-box">
                <div className="invoice-summary-row">
                  <span>Total Billable Hours</span>
                  <strong>{(invoice.totalHours || 0).toFixed(2)} hrs</strong>
                </div>
                <div className="invoice-summary-row">
                  <span>Subtotal</span>
                  <span>${(invoice.subtotal || 0).toFixed(2)}</span>
                </div>
                {invoice.totalHst ? (
                  <div className="invoice-summary-row">
                    <span>HST</span>
                    <span>${invoice.totalHst.toFixed(2)}</span>
                  </div>
                ) : null}
                {invoice.totalGst ? (
                  <div className="invoice-summary-row">
                    <span>GST</span>
                    <span>${invoice.totalGst.toFixed(2)}</span>
                  </div>
                ) : null}
                {invoice.totalQst ? (
                  <div className="invoice-summary-row">
                    <span>QST</span>
                    <span>${invoice.totalQst.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="invoice-summary-row">
                  <span>Total Tax</span>
                  <span>${(invoice.totalTax || 0).toFixed(2)}</span>
                </div>
                <div className="invoice-summary-row total">
                  <span>Grand Total</span>
                  <span>{formatted.formattedGrandTotal}</span>
                </div>
              </div>
            </div>

            {/* PDF Document Preview Card */}
            {invoice.documentPath && (
              <div className="invoice-view-card">
                <div className="invoice-view-card-header">
                  <h2 className="invoice-view-card-title">
                    <FileText size={18} /> PDF Document
                  </h2>
                </div>
                <div className="invoice-pdf-preview-card">
                  <div className="invoice-pdf-preview-icon">
                    <FileText size={28} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{invoice.documentFileName || "Invoice.pdf"}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {invoice.documentFileSize
                        ? `${(invoice.documentFileSize / 1024 / 1024).toFixed(2)} MB`
                        : "Generated PDF Document"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", width: "100%", justifyContent: "center" }}>
                    {pdfSignedUrl && (
                      <button
                        className="button secondary button-icon"
                        style={{ fontSize: "0.8125rem" }}
                        onClick={() => window.open(pdfSignedUrl, "_blank")}
                      >
                        <Eye size={14} /> Preview PDF
                      </button>
                    )}
                    <button
                      className="button primary button-icon"
                      style={{ fontSize: "0.8125rem" }}
                      onClick={handleDownloadPdf}
                    >
                      <Download size={14} /> Download
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Attachments Card (if present) */}
            {attachments.length > 0 && (
              <div className="invoice-view-card">
                <div className="invoice-view-card-header">
                  <h2 className="invoice-view-card-title">
                    <Paperclip size={18} /> Attachments ({attachments.length})
                  </h2>
                </div>
                <ul style={{ paddingLeft: "0", listStyle: "none", margin: 0 }}>
                  {attachments.map((att, idx) => (
                    <li
                      key={att.id || idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 0",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <Paperclip size={16} color="var(--text-muted)" />
                      <span style={{ fontSize: "0.875rem", flex: 1, wordBreak: "break-all" }}>
                        {att.fileName || "Attachment"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Send Email Modal */}
      {isEmailModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--card, #ffffff)",
              color: "var(--text)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              border: "1px solid var(--border)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Send Invoice Email</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "16px" }}>
              Specify the recipient email address to deliver Invoice #{invoice.invoiceNumber}.
            </p>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "6px" }}>
                Recipient Email
              </label>
              <input
                type="email"
                className="input"
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)" }}
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="client@example.com"
              />
            </div>

            {emailStatusMessage && (
              <div
                style={{
                  padding: "10px",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  marginBottom: "16px",
                  backgroundColor: emailStatusMessage.includes("successfully") ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: emailStatusMessage.includes("successfully") ? "#16a34a" : "#dc2626",
                }}
              >
                {emailStatusMessage}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                className="button secondary"
                onClick={() => setIsEmailModalOpen(false)}
                disabled={isSendingEmail}
              >
                Cancel
              </button>
              <button
                className="button primary button-icon"
                onClick={handleSendEmailSubmit}
                disabled={isSendingEmail || !emailInput.trim()}
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 size={16} className="timesheet-loading-spinner" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail size={16} />
                    Send Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceView;
