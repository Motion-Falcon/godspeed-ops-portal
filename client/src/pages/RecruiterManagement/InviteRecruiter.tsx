import { useState } from "react";
import { inviteRecruiterAPI } from "../../services/api/user";
import { AppHeader } from "../../components/AppHeader";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/components/form.css";
import "../../styles/components/button.css";
import "../../styles/pages/RecruiterHierarchy.css";
import "../../styles/pages/InviteRecruiter.css";
import { UserPlus } from "lucide-react";

export function InviteRecruiter() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!email || !name) {
      setError(t("recruiterManagement.emailAndNameRequired"));
      return;
    }
    setIsLoading(true);
    try {
      await inviteRecruiterAPI(email.trim(), name.trim());
      setMessage(t("recruiterManagement.invitationSentSuccess"));
      setEmail("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("recruiterManagement.failedToSendInvitation"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-container recruiter-hierarchy">
      <AppHeader title={t("recruiterManagement.inviteRecruiter")} />
      <div className="content-container">
        {/* Dashboard-style heading */}
        <div className="dashboard-heading">
          <h1 className="dashboard-title">{t("recruiterManagement.inviteRecruiter")}</h1>
          <div className="user-role-badge">
            <UserPlus className="role-icon" />
            <span>{t("recruiterManagement.inviteRecruiter")}</span>
          </div>
        </div>
        <p className="dashboard-subtitle">
          {t("recruiterManagement.sendInvitationTitle")}
        </p>

        <div className="card invite-recruiter-container">
          <div className="card-body invite-recruiter-form">
            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-container">{error}</div>}
            <form onSubmit={onSubmit} className={isLoading ? "form-loading" : ""}>
              <div className="form-group">
                <label htmlFor="name" className="form-label">{t("forms.name")}</label>
                <input
                  id="name"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("recruiterManagement.recruiterName")}
                />
              </div>
              <div className="form-group">
                <label htmlFor="email" className="form-label">{t("forms.email")}</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("recruiterManagement.recruiterEmail")}
                />
              </div>
              <button type="submit" className="button btn-hover-float" disabled={isLoading}>
                {isLoading ? <span className="loading-spinner"></span> : t("recruiterManagement.sendInvite")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


