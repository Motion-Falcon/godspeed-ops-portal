import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPassword } from "../lib/auth";
import { ArrowLeft, MailCheck } from "lucide-react";
import { ThemeToggle } from "../components/theme-toggle";
import { AppHeader } from "../components/AppHeader";
import "../styles/variables.css";
import "../styles/pages/ForgotPassword.css";
import "../styles/components/form.css";
import "../styles/components/button.css";

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const navigate = useNavigate();

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
        setError("An error occurred. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <>
        <AppHeader
          title="Password Reset"
          actions={
            <button
              className="button button-icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="icon" size={16} />
              <span>Back to Dashboard</span>
            </button>
          }
        />
        <div className="centered-container">
          <div className="centered-card">
            <div className="toggle-container">
              <ThemeToggle />
            </div>

            <div className="icon-circle">
              <MailCheck />
            </div>

            <h1 className="auth-card-title">Check your email</h1>

            <p>
              We've sent a password reset link to{" "}
              <span className="bold-text">{emailSent}</span>. Click the link to
              reset your password.
            </p>

            <div className="card-actions">
              <p className="text-muted">
                Didn't receive an email? Check your spam folder or request
                another reset link.
              </p>

              <button
                className="button outline"
                onClick={() => setIsSuccess(false)}
              >
                Try again
              </button>

              <div>
                <Link to="/login" className="auth-link">
                  Back to login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="Password Reset"
        actions={
          <button className="button button-icon" onClick={() => navigate("/")}>
            <ArrowLeft className="icon" size={16} />
            <span>Back to Dashboard</span>
          </button>
        }
      />
      <div className="centered-container">
        <div className="form-container">
          <div className="toggle-container">
            <ThemeToggle />
          </div>

          <div>
            <Link to="/login" className="back-link">
              <ArrowLeft className="icon" size={16} />
              Back to login
            </Link>

            <h1 className="auth-title">Reset your password</h1>
            <p className="brand-description">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>
          </div>

          {error && <div className="error-container">{error}</div>}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
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
                "Send reset link"
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
