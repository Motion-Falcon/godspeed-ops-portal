import { useState, useEffect, useCallback } from "react";
import { useLocation, Navigate, useNavigate } from "react-router-dom";
import { Shield, CheckCircle } from "lucide-react";
import { sendOtpAPI, verifyOtpAPI } from "../services/api";
import { complete2FA } from "../lib/auth";
import "../styles/variables.css";
import "../styles/pages/TwoFactorAuth.css";
import "../styles/components/button.css";
import { AppHeader } from "../components/AppHeader";

export function TwoFactorAuth() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get data from navigation state (only exists on fresh navigation from login)
  const user = location.state?.user;
  const email = location.state?.email;
  const password = location.state?.password;
  const rememberMe = location.state?.rememberMe;
  const phoneNumber = user?.user_metadata?.phoneNumber;
  
  // Check if we have all required data (should only be present from login redirect)
  const hasRequiredState = !!(user && phoneNumber && email && password);
  
  const [otpCode, setOtpCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Clear location state immediately to prevent persistence
  useEffect(() => {
    if (!hasRequiredState) return;
    
    // Clear the navigation state to prevent refresh access
    window.history.replaceState({}, document.title, window.location.pathname);
  }, [hasRequiredState]);

  const sendOtp = useCallback(async () => {
    // Only send OTP if we have required state
    if (!phoneNumber || !hasRequiredState) return;
    
    setIsResending(true);
    setError(null);
    setResendSuccess(false);

    try {
      await sendOtpAPI(phoneNumber);
      setOtpCode("");
      setResendTimer(30);
      setResendSuccess(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code"
      );
    } finally {
      setIsResending(false);
    }
  }, [phoneNumber, hasRequiredState]);

  const verifyOtp = useCallback(async () => {
    if (!phoneNumber || !otpCode || otpCode.length < 4 || !email || !password) {
      setError("Please enter a valid verification code");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // First verify the OTP
      await verifyOtpAPI(phoneNumber, otpCode);
      
      // After successful OTP verification, complete the 2FA process
      // This will create the actual session
      await complete2FA(email, password, rememberMe);
      
      // 2FA verification successful, proceed to dashboard
      navigate("/dashboard");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to verify code"
      );
    } finally {
      setIsVerifying(false);
    }
  }, [phoneNumber, otpCode, email, password, rememberMe, navigate]);

  // Auto-send OTP on component mount - only if we have complete required state
  useEffect(() => {
    if (hasRequiredState && phoneNumber) {
      sendOtp();
    }
  }, [sendOtp, phoneNumber, hasRequiredState]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // If accessed without proper credentials, redirect to login
  if (!hasRequiredState) {
    return <Navigate to="/login" replace />;
  }

  // Mask phone number for display (show last 4 digits)
  const maskedPhone = phoneNumber.replace(/(\d{1,3})(\d{3,})(\d{4})/, "$1***$3");

  return (
    <>
      <AppHeader
        title="Two-Factor Authentication"
        hideHamburgerMenu={true}
      />
      <div className="centered-container">
        <div className="centered-card">
          <div className="icon-circle">
            <Shield />
          </div>

          <h1 className="auth-card-title">Two-Factor Authentication</h1>

          <p>
            For security, we've sent a verification code to{" "}
            <span className="bold-text">{maskedPhone}</span>. Please enter the code to complete your login.
          </p>

          <div className="card-actions">
            {error && <div className="error-container">{error}</div>}

            <div className="otp-container">
              <input
                type="text"
                className="form-input otp-input"
                placeholder="Enter verification code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                maxLength={6}
                autoFocus
              />
              
              <div className="otp-actions">
                <button
                  className="button btn-hover-float"
                  onClick={verifyOtp}
                  disabled={isVerifying || otpCode.length < 4}
                >
                  {isVerifying ? (
                    <span className="loading-spinner-small"></span>
                  ) : (
                    "Verify Code"
                  )}
                </button>
                
                {resendSuccess ? (
                  <div className="success-message">
                    <CheckCircle size={16} style={{ marginRight: "8px" }} />
                    Verification code sent successfully
                  </div>
                ) : (
                  <p className="text-muted">
                    Didn't receive the code? Check your messages or request a new one.
                  </p>
                )}

                <button
                  className="button outline"
                  onClick={sendOtp}
                  disabled={isResending || resendTimer > 0}
                >
                  {isResending ? (
                    <span className="loading-spinner-small"></span>
                  ) : resendTimer > 0 ? (
                    `Resend Code (${resendTimer}s)`
                  ) : (
                    "Resend Code"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 