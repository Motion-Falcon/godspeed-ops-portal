import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updatePasswordWithResetToken } from "../lib/auth";
import { Eye, EyeOff, Check, AlertCircle, ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import "../styles/variables.css";
import "../styles/pages/ForgotPassword.css";
import "../styles/components/form.css";
import "../styles/components/button.css";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../contexts/AuthContext";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" })
      .regex(/[A-Z]/, {
        message: "Password must contain at least one uppercase letter",
      })
      .regex(/[a-z]/, {
        message: "Password must contain at least one lowercase letter",
      })
      .regex(/[0-9]/, { message: "Password must contain at least one number" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export function ResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
console.log(isAuthenticated, 'isAuthenticated');

  useEffect(() => {
    // Check for token in URL hash or query params
    const checkForTokens = async () => {
      // Check URL hash for access_token
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const type = hashParams.get("type");

      // Check URL query for initial recovery token
      const queryParams = new URLSearchParams(location.search);
      const recoveryToken = queryParams.get("token");
      const recoveryType = queryParams.get("type");

      if (accessToken && type === "recovery") {
        // We have a valid token in the hash
        setHasToken(true);
        setIsVerifying(false);
      } else if (recoveryToken && recoveryType === "recovery") {
        // We have the initial token but Supabase is still processing the redirect

        // Direct validation attempt with the token from the URL
        handleInitialToken(recoveryToken);
      } else {
        // No tokens found in URL, check if we have a session already

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setHasToken(true);
          setIsVerifying(false);
        } else {
          // No valid tokens or session found
          setIsVerifying(false);
          setError(
            "Password reset link is invalid or has expired. Please request a new one."
          );
        }
      }
    };

    // Process the token directly with Supabase
    const handleInitialToken = async (token: string) => {
      try {
        // Create a session directly using the token
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: "recovery",
        });

        if (error) {
          // Even if token verification fails, check if we somehow have a session
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            setHasToken(true);
            setIsVerifying(false);
          } else {
            setIsVerifying(false);
            setError(
              "Password reset link is invalid or has expired. Please request a new one."
            );
          }
        } else if (data && data.session) {
          setHasToken(true);
          setIsVerifying(false);
        } else {
          // If token seems valid but no session yet, wait a bit longer
          setTimeout(checkForTokens, 2000);
        }
      } catch (err) {
        setIsVerifying(false);
        setError(
          "An error occurred while validating your reset link. Please try again."
        );
      }
    };

    // Start the token check process after a short delay
    const timer = setTimeout(() => checkForTokens(), 1000);
    return () => clearTimeout(timer);
  }, [location]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      await updatePasswordWithResetToken(data.password);
      setIsSuccess(true);
      // Redirect after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An error occurred while resetting your password.");
      }
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="page-container">
        <AppHeader
          title="Reset Password"
          actions={
            <button
              className="button button-icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="icon" size={16} />
              <span>Back to Dashboard</span>
            </button>
          }
          hideHamburgerMenu={!isAuthenticated}
        />
        <div className="centered-container">
          <div className="centered-card">
            <div className="flex items-center justify-center my-6">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            </div>

            <h1 className="auth-card-title">Verifying Reset Link</h1>

            <p className="text-center">
              Please wait while we verify your password reset link...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="page-container">
        <AppHeader
          title="Reset Password"
          actions={
            <button
              className="button button-icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="icon" size={16} />
              <span>Back to Dashboard</span>
            </button>
          }
          hideHamburgerMenu={!isAuthenticated}
        />
        <div className="centered-container">
          <div className="centered-card">
            <div
              className="icon-circle"
              style={{
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                color: "#22c55e",
              }}
            >
              <Check />
            </div>

            <h1 className="auth-card-title">Password Reset Successful</h1>

            <p>
              Your password has been reset successfully. You will be redirected
              to the login page shortly.
            </p>

            <button className="button" onClick={() => navigate("/login")}>
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasToken) {
    return (
      <div className="page-container">
        <AppHeader
          title="Reset Password"
          actions={
            <button
              className="button button-icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="icon" size={16} />
              <span>Back to Dashboard</span>
            </button>
          }
          hideHamburgerMenu={!isAuthenticated}
        />
        <div className="centered-container">
          <div className="centered-card">
            <div
              className="icon-circle"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444",
              }}
            >
              <AlertCircle />
            </div>

            <h1 className="auth-card-title">Invalid Reset Link</h1>

            <p className="error-message">{error}</p>

            <button
              className="button"
              onClick={() => navigate("/forgot-password")}
            >
              Request New Reset Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <AppHeader
        title="Reset Password"
        actions={
          <button className="button button-icon" onClick={() => navigate("/")}>
            <ArrowLeft className="icon" size={16} />
            <span>Back to Dashboard</span>
          </button>
        }
        hideHamburgerMenu={!isAuthenticated}
      />
      <div className="centered-container">
        <div className="centered-card">
          <h1 className="auth-card-title">Reset Your Password</h1>

          <p className="text-muted">Enter your new password below.</p>

          {error && <div className="error-container">{error}</div>}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                New Password
              </label>
              <div className="input-container">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  {...register("password")}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="icon" size={16} />
                  ) : (
                    <Eye className="icon" size={16} />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="error-message">{errors.password.message}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm Password
              </label>
              <div className="input-container">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  className="form-input"
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="icon" size={16} />
                  ) : (
                    <Eye className="icon" size={16} />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="error-message">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <button type="submit" className="button" disabled={isLoading}>
              {isLoading ? (
                <span className="loading-spinner"></span>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
