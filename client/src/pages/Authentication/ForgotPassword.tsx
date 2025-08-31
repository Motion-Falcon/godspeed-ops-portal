import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPassword } from "../../lib/auth";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import "../../styles/variables.css";
import "../../styles/pages/ForgotPassword.css";
import "../../styles/components/form.css";
import "../../styles/components/button.css";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/language/language-provider";

export function ForgotPassword() {
  const { t } = useLanguage();
  const forgotPasswordSchema = z.object({
    email: z.string().email({ message: t('forgot.validation.email') }),
  });

  type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const hideHamburgerMenu = !isAuthenticated;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      await resetPassword(data.email);
      setIsSuccess(true);
      setEmailSent(data.email);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(t('messages.error'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className={`page-container ${hideHamburgerMenu ? "hide-hamburger-menu" : ""}`}>
        <AppHeader
          title={t('forgot.title')}
          hideHamburgerMenu={hideHamburgerMenu}
        />
        <div className="centered-container">
          <div className="centered-card">

            <div className="icon-circle">
              <MailCheck />
            </div>

            <h1 className="auth-card-title">{t('forgot.success.title')}</h1>

            <p dangerouslySetInnerHTML={{ __html: t('forgot.success.message', { email: `<span class="bold-text">${emailSent}</span>` }) }} />

            <div className="card-actions">
              <p className="text-muted">
                {t('forgot.success.instructions')}
              </p>

              <button
                className="button outline"
                onClick={() => setIsSuccess(false)}
              >
                {t('forgot.success.tryAgain')}
              </button>

              <div>
                <Link to="/login" className="auth-link">
                  {t('forgot.success.backToLogin')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`page-container ${hideHamburgerMenu ? "hide-hamburger-menu" : ""}`}>
      <AppHeader
        title={t('forgot.title')}
        hideHamburgerMenu={hideHamburgerMenu}
      />
      <div className="centered-container">
        <div className="form-container">
          <div>
            <Link to="/login" className="back-link">
              <ArrowLeft className="icon" size={16} />
              {t('forgot.backToLogin')}
            </Link>
            <h1 className="auth-title">{t('forgot.resetTitle')}</h1>
            <p className="brand-description">
              {t('forgot.instructions')}
            </p>
          </div>
          {error && <div className="error-container">{error}</div>}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                {t('forms.email')}
              </label>
              <input
                id="email"
                type="email"
                placeholder={t('forms.emailPlaceholder')}
                className="form-input"
                {...register("email")}
              />
              {errors.email && (
                <p className="error-message">{errors.email.message}</p>
              )}
            </div>
            <button type="submit" className="button" disabled={isLoading}>
              {isLoading ? (
                <span className="loading-spinner"></span>
              ) : (
                t('forgot.sendResetLink')
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
