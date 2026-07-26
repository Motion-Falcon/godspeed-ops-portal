import { X } from "lucide-react";
import { useLanguage } from "../contexts/language/language-provider";
import type { AccessRole } from "../lib/auth";
import "../styles/components/demo-login-modal.css";

export interface DemoUser {
  id: string;
  email: string;
  userType: AccessRole;
  name: string;
}

interface DemoLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: DemoUser) => void;
  isLoading: boolean;
}

const DEMO_USERS: DemoUser[] = [
  {
    id: "42f71a58-fa4f-464c-befe-49d9c5d60953",
    email: "admin@email.com",
    userType: "admin",
    name: "Admin User",
  },
  {
    id: "0485b2b9-b21d-4aa2-b450-0b87cedd49cc",
    email: "recruiter_director@email.com",
    userType: "recruiter_director",
    name: "Recruiter Director User",
  },
  {
    id: "bedaff32-74a6-40f9-bd05-5b7e79f57a56",
    email: "recruiter_manager@email.com",
    userType: "recruiter_manager",
    name: "Recruiter Manager User",
  },
  {
    id: "6bf3f186-4495-4c15-bcfd-a667cd96348a",
    email: "accountant_manager@email.com",
    userType: "accountant_manager",
    name: "Accountant Manager User",
  },
  {
    id: "db736cd9-acc5-48ad-937a-aab29178ebd2",
    email: "bookkeeper@email.com",
    userType: "bookkeeper",
    name: "Bookkeeper User",
  },
  {
    id: "9434de91-d86b-4cd5-931e-21705bc9dda7",
    email: "sales@email.com",
    userType: "sales",
    name: "Sales User",
  },
  {
    id: "7c2dfd3b-f492-4ade-99d2-c942e8a1274b",
    email: "recruiter@email.com",
    userType: "recruiter",
    name: "Recruiter User",
  },
  {
    id: "f798bae9-f720-4685-945b-0487465ce029",
    email: "jobseeker@email.com",
    userType: "jobseeker",
    name: "Jobseeker User",
  },
];

export function DemoLoginModal({
  isOpen,
  onClose,
  onSelectUser,
  isLoading,
}: DemoLoginModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const getUserTypeLabel = (userType: AccessRole) => {
    switch (userType) {
      case "admin":
        return t("roles.admin") || "Admin";
      case "recruiter_director":
        return t("roles.recruiter_director") || "Recruiter Director";
      case "recruiter_manager":
        return t("roles.recruiter_manager") || "Recruiter Manager";
      case "accountant_manager":
        return t("roles.accountant_manager") || "Accountant Manager";
      case "bookkeeper":
        return t("roles.bookkeeper") || "Bookkeeper";
      case "sales":
        return t("roles.sales") || "Sales";
      case "recruiter":
        return t("roles.recruiter") || "Recruiter";
      case "jobseeker":
        return t("roles.jobseeker") || "Job Seeker";
      default:
        return userType;
    }
  };

  return (
    <div className="demo-modal-overlay" onClick={onClose}>
      <div className="demo-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="demo-modal-header">
          <h2 className="demo-modal-title">{t("demoLogin.title")}</h2>
          <button
            type="button"
            className="demo-modal-close"
            onClick={onClose}
            disabled={isLoading}
            aria-label={t("buttons.close")}
          >
            <X size={20} />
          </button>
        </div>

        <p className="demo-modal-description">{t("demoLogin.description")}</p>

        <div className="demo-user-list">
          {DEMO_USERS.map((user) => (
            <button
              key={user.id}
              type="button"
              className="demo-user-card"
              onClick={() => onSelectUser(user)}
              disabled={isLoading}
            >
              <div className="demo-user-info">
                <div className="demo-user-name">{user.name}</div>
                <div className="demo-user-email">{user.email}</div>
              </div>
              <div className="demo-user-type">
                {getUserTypeLabel(user.userType)}
              </div>
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="demo-modal-loading">
            <span className="loading-spinner"></span>
            <span>{t("demoLogin.loggingIn")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

