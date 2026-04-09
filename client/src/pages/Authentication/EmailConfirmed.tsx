import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle, MailCheck } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { supabase } from "../../lib/supabaseClient";
import { sendConfirmationWelcomeEmails } from "../../services/api/auth";
import { clearTokenCache } from "../../services/api/index";
import "../../styles/variables.css";
import "../../styles/pages/VerificationPending.css";
import "../../styles/components/button.css";

type ConfirmationStatus = "processing" | "success" | "error";

export function EmailConfirmed() {
  const [status, setStatus] = useState<ConfirmationStatus>("processing");
  const [message, setMessage] = useState(
    "Your email is confirmed. We're setting up your account and sending your welcome emails."
  );

  useEffect(() => {
    let isMounted = true;

    const handleConfirmation = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );

      const urlType = hashParams.get("type") || searchParams.get("type");
      const code = searchParams.get("code");
      const accessToken =
        hashParams.get("access_token") || searchParams.get("access_token");
      const refreshToken =
        hashParams.get("refresh_token") || searchParams.get("refresh_token");

      const hasTokenCallback =
        urlType === "signup" && !!accessToken && !!refreshToken;
      const hasCodeCallback = !!code && (urlType === "signup" || !urlType);
      const isConfirmationCallback = hasTokenCallback || hasCodeCallback;

      let shouldClearSession = isConfirmationCallback;

      try {
        if (!isConfirmationCallback) {
          throw new Error(
            "This confirmation link is missing or has already been used."
          );
        }

        let callbackAccessToken = accessToken;

        if (!callbackAccessToken && code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            code
          );

          if (error) {
            throw error;
          }

          callbackAccessToken = data.session?.access_token || null;
        }

        if (!callbackAccessToken) {
          throw new Error("Unable to create a session from this confirmation link.");
        }

        await sendConfirmationWelcomeEmails(callbackAccessToken, false);

        if (!isMounted) {
          return;
        }

        setStatus("success");
        setMessage(
          "Your email has been confirmed. We've sent your welcome and onboarding emails. You can log in now."
        );
      } catch (error) {
        console.error("Error handling email confirmation:", error);

        if (!isMounted) {
          return;
        }

        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "We couldn't finish your account setup from this confirmation link."
        );
      } finally {
        window.history.replaceState({}, document.title, "/email-confirmed");

        if (shouldClearSession) {
          try {
            await supabase.auth.signOut();
          } catch (signOutError) {
            console.error(
              "Error clearing temporary confirmation session:",
              signOutError
            );
          }

          clearTokenCache();
        }
      }
    };

    handleConfirmation();

    return () => {
      isMounted = false;
    };
  }, []);

  const Icon =
    status === "processing"
      ? MailCheck
      : status === "success"
      ? CheckCircle
      : AlertCircle;

  const iconStyle =
    status === "processing"
      ? undefined
      : {
          backgroundColor:
            status === "success"
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(239, 68, 68, 0.1)",
          color: status === "success" ? "#22c55e" : "#ef4444",
        };

  return (
    <div className="page-container">
      <AppHeader title="Email confirmed" />
      <div className="centered-container">
        <div className="centered-card">
          <div className="icon-circle" style={iconStyle}>
            <Icon />
          </div>

          <h1 className="auth-card-title">
            {status === "processing"
              ? "Email confirmed"
              : status === "success"
              ? "You're all set"
              : "Confirmation issue"}
          </h1>

          <p className="text-center">{message}</p>

          <div className="card-actions">
            {status === "processing" ? (
              <div className="flex items-center justify-center my-6">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              </div>
            ) : (
              <Link to="/login" className="button">
                Go to login
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
