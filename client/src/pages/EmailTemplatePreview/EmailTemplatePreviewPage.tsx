import { useState, useEffect, useRef } from "react";
import { AppHeader } from "../../components/AppHeader";
import {
  getEmailTemplates,
  getEmailTemplatePreview,
  type EmailTemplateInfo,
  type EmailTemplatePreview,
} from "../../services/api/emailTemplates";
import {
  Mail,
  FileText,
  Eye,
  Code,
  ChevronRight,
  Loader2,
  AlertCircle,
  Menu,
  X,
  Send,
  Database,
  Paperclip,
  Users,
  UserCircle,
  Info,
} from "lucide-react";
import "../../styles/pages/EmailTemplatePreview.css";

interface UnifiedTemplate extends EmailTemplateInfo {
  /** For Supabase templates: hardcoded HTML preview */
  placeholderHtml?: string;
}

// Sidebar order follows the email-triggers-table.txt
const SUPABASE_TEMPLATES: UnifiedTemplate[] = [];

// Defines the desired sidebar order by id
const SIDEBAR_ORDER = [
  "recruiter-invitation",             // #1, #2a
  "onboarding-reminder",              // #2b, #15
  "confirm-signup",                   // #3
  "jobseeker-welcome",                // #4
  "jobseeker-assignment",             // #5
  "jobseeker-removal",                // #6
  "timesheet",                        // #7, #8, #9
  "invoice",                          // #10
  "consent",                          // #11, #12
  "employment-agreement",             // #13, #14
];

export function EmailTemplatePreviewPage() {
  const [, setSendgridTemplates] = useState<EmailTemplateInfo[]>([]);
  const [allTemplates, setAllTemplates] = useState<UnifiedTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmailTemplatePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"html" | "text">("html");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load template list on mount
  useEffect(() => {
    async function fetchTemplates() {
      try {
        setLoading(true);
        const data = await getEmailTemplates();
        setSendgridTemplates(data);

        // Merge SendGrid + Supabase and sort by sidebar order
        const merged: UnifiedTemplate[] = [
          ...SUPABASE_TEMPLATES,
          ...data.map((t) => ({ ...t } as UnifiedTemplate)),
        ];
        merged.sort((a, b) => {
          const ai = SIDEBAR_ORDER.indexOf(a.id);
          const bi = SIDEBAR_ORDER.indexOf(b.id);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        setAllTemplates(merged);

        if (merged.length > 0) {
          setSelectedId(merged[0].id);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load email templates");
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  // Load preview when selectedId changes
  useEffect(() => {
    if (!selectedId) return;

    const template = allTemplates.find((t) => t.id === selectedId);

    // If it's a frontend-only Supabase template (has placeholderHtml), build preview locally
    if (template?.placeholderHtml) {
      setPreview({
        id: template.id,
        name: template.name,
        subject: template.subject,
        description: template.description,
        service: template.service,
        tone: template.tone,
        triggerRef: template.triggerRef,
        attachments: template.attachments,
        from: template.from,
        cc: template.cc,
        dynamicCc: template.dynamicCc,
        html: template.placeholderHtml || "",
        text: null,
        sampleData: {},
      });
      return;
    }

    async function fetchPreview() {
      try {
        setPreviewLoading(true);
        setError(null);
        const data = await getEmailTemplatePreview(selectedId!);
        setPreview(data);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load template preview");
      } finally {
        setPreviewLoading(false);
      }
    }
    fetchPreview();
  }, [selectedId, allTemplates]);

  // Resize iframe to fit content
  useEffect(() => {
    if (!preview?.html || viewMode !== "html") return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.body) {
          iframe.style.height = doc.body.scrollHeight + 40 + "px";
        }
      } catch {
        // cross-origin safety
      }
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [preview?.html, viewMode]);

  function handleSelectTemplate(id: string) {
    setSelectedId(id);
    setViewMode("html");
    setMobileSidebarOpen(false);
  }

  const selectedTemplate = allTemplates.find((t) => t.id === selectedId);

  return (
    <div className="etp-page">
      <AppHeader title="Email Template Preview" />

      <div className="etp-container">
        {/* Mobile sidebar toggle */}
        <button
          className="etp-mobile-toggle"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          aria-label="Toggle template list"
        >
          {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          <span>Templates</span>
        </button>

        {/* Sidebar */}
        <aside className={`etp-sidebar ${mobileSidebarOpen ? "etp-sidebar--open" : ""}`}>
          <div className="etp-sidebar-header">
            <Mail size={18} />
            <h2>Email Templates</h2>
          </div>

          {loading ? (
            <div className="etp-sidebar-loading">
              <Loader2 size={20} className="etp-spinner" />
              <span>Loading templates...</span>
            </div>
          ) : (
            <nav className="etp-sidebar-list">
              {allTemplates.map((t) => (
                <button
                  key={t.id}
                  className={`etp-sidebar-item ${selectedId === t.id ? "etp-sidebar-item--active" : ""}`}
                  onClick={() => handleSelectTemplate(t.id)}
                >
                  <div className="etp-sidebar-item-content">
                    <div className="etp-sidebar-item-top">
                      <span className="etp-sidebar-item-name">{t.name}</span>
                      <span className={`etp-service-badge etp-service-badge--${t.service}`}>
                        {t.service === "sendgrid" ? <Send size={10} /> : <Database size={10} />}
                        {t.service === "sendgrid" ? "SendGrid" : "Supabase"}
                      </span>
                    </div>
                    <span className="etp-sidebar-item-desc">{t.description}</span>
                    <span className="etp-sidebar-item-trigger">{t.triggerRef}</span>
                  </div>
                  <ChevronRight size={14} className="etp-sidebar-item-arrow" />
                </button>
              ))}
            </nav>
          )}

          <div className="etp-sidebar-footer">
            <span className="etp-template-count">{allTemplates.length} templates</span>
          </div>
        </aside>

        {/* Main preview panel */}
        <main className="etp-main">
          {!selectedId && !loading && (
            <div className="etp-empty">
              <Mail size={48} />
              <h3>Select a template</h3>
              <p>Choose an email template from the sidebar to preview it.</p>
            </div>
          )}

          {error && (
            <div className="etp-error">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {previewLoading && (
            <div className="etp-preview-loading">
              <Loader2 size={32} className="etp-spinner" />
              <span>Loading preview...</span>
            </div>
          )}

          {!previewLoading && preview && selectedTemplate && (
            <>
              {/* Header bar */}
              <div className="etp-preview-header">
                <div className="etp-preview-meta">
                  <div className="etp-preview-title-row">
                    <h2 className="etp-preview-title">{preview.name}</h2>
                    <span className={`etp-service-badge etp-service-badge--${preview.service} etp-service-badge--lg`}>
                      {preview.service === "sendgrid" ? <Send size={12} /> : <Database size={12} />}
                      {preview.service === "sendgrid" ? "SendGrid" : "Supabase Auth"}
                    </span>
                  </div>
                  <p className="etp-preview-description">{preview.description}</p>
                </div>
              </div>

              {/* Supabase nudge banner */}
              {preview.service === "supabase" && (
                <div className="etp-supabase-nudge">
                  <Info size={16} />
                  <div>
                    <strong>Managed by Supabase Auth</strong>
                    <p>This email is triggered and sent directly by Supabase. To customise its content, go to <strong>Supabase Dashboard → Authentication → Email Templates</strong>. The preview below is a placeholder.</p>
                  </div>
                </div>
              )}

              {/* Metadata rows: Subject, From, CC, Attachments */}
              <div className="etp-meta-table">
                <div className="etp-meta-row">
                  <span className="etp-meta-label">Subject</span>
                  <span className="etp-meta-value">{preview.subject}</span>
                </div>
                <div className="etp-meta-row">
                  <UserCircle size={14} className="etp-meta-icon" />
                  <span className="etp-meta-label">From</span>
                  <span className="etp-meta-value">{preview.from}</span>
                </div>
                {(preview.cc.length > 0 || preview.dynamicCc) && (
                  <div className="etp-meta-row">
                    <Users size={14} className="etp-meta-icon" />
                    <span className="etp-meta-label">CC</span>
                    <span className="etp-meta-value">
                      {preview.cc.length > 0 ? preview.cc.join(", ") : ""}
                      {preview.dynamicCc && (
                        <span className="etp-meta-dynamic"> + dynamic client CC emails</span>
                      )}
                    </span>
                  </div>
                )}
                {preview.attachments.length > 0 && (
                  <div className="etp-meta-row">
                    <Paperclip size={14} className="etp-meta-icon" />
                    <span className="etp-meta-label">Attachments</span>
                    <span className="etp-meta-value">{preview.attachments.join(", ")}</span>
                  </div>
                )}
                <div className="etp-meta-row">
                  <span className="etp-meta-label">Trigger</span>
                  <span className="etp-meta-value etp-meta-trigger">{preview.triggerRef}</span>
                </div>
              </div>

              {/* View mode toggle */}
              <div className="etp-view-toggle">
                <button
                  className={`etp-view-btn ${viewMode === "html" ? "etp-view-btn--active" : ""}`}
                  onClick={() => setViewMode("html")}
                >
                  <Eye size={14} />
                  HTML Preview
                </button>
                {preview.text && (
                  <button
                    className={`etp-view-btn ${viewMode === "text" ? "etp-view-btn--active" : ""}`}
                    onClick={() => setViewMode("text")}
                  >
                    <Code size={14} />
                    Plain Text
                  </button>
                )}
              </div>

              {/* Preview content */}
              <div className="etp-preview-content">
                {viewMode === "html" ? (
                  <div className="etp-iframe-wrapper">
                    <iframe
                      ref={iframeRef}
                      className="etp-iframe"
                      srcDoc={preview.html}
                      title={`Preview of ${preview.name}`}
                      sandbox="allow-same-origin"
                    />
                  </div>
                ) : (
                  <pre className="etp-text-preview">{preview.text}</pre>
                )}
              </div>

              {/* Sample data */}
              {preview.service === "sendgrid" && (
                <details className="etp-sample-data">
                  <summary>
                    <FileText size={14} />
                    Sample Data Used
                  </summary>
                  <pre className="etp-sample-data-content">
                    {JSON.stringify(preview.sampleData, null, 2)}
                  </pre>
                </details>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
