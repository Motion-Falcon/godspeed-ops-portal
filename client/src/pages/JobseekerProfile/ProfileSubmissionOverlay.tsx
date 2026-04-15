import { CheckCircle2, Loader2 } from "lucide-react";

export type SubmissionOverlayStepStatus = "pending" | "active" | "complete";

export interface SubmissionOverlayStep {
  key: string;
  label: string;
  description: string;
  status: SubmissionOverlayStepStatus;
}

interface ProfileSubmissionOverlayProps {
  isOpen: boolean;
  title: string;
  description: string;
  variant?: "progress" | "success";
  steps?: SubmissionOverlayStep[];
}

export function ProfileSubmissionOverlay({
  isOpen,
  title,
  description,
  variant = "progress",
  steps = [],
}: ProfileSubmissionOverlayProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="profile-submission-overlay" role="status" aria-live="polite">
      <div
        className={`profile-submission-modal ${
          variant === "success" ? "is-success" : ""
        }`}
      >
        <div className="profile-submission-header">
          <div className="profile-submission-icon">
            {variant === "success" ? (
              <CheckCircle2 size={28} />
            ) : (
              <Loader2 size={28} className="profile-submission-spinner" />
            )}
          </div>
          <div>
            <h2 className="profile-submission-title">{title}</h2>
            <p className="profile-submission-description">{description}</p>
          </div>
        </div>

        {variant === "progress" && steps.length > 0 && (
          <div className="profile-submission-steps">
            {steps.map((step) => (
              <div
                key={step.key}
                className={`profile-submission-step is-${step.status}`}
              >
                <div className="profile-submission-step-indicator">
                  {step.status === "complete" ? (
                    <CheckCircle2 size={18} />
                  ) : step.status === "active" ? (
                    <Loader2 size={18} className="profile-submission-spinner" />
                  ) : (
                    <span className="profile-submission-step-dot" />
                  )}
                </div>
                <div className="profile-submission-step-copy">
                  <p className="profile-submission-step-label">{step.label}</p>
                  <p className="profile-submission-step-description">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
