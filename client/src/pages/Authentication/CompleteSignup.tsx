import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../../lib/supabaseClient";
import { completeOnboardingAPI, sendOtpAPI, verifyOtpAPI, checkPhoneAvailability } from "../../services/api/auth";
import { Eye, EyeOff, CheckCircle, AlertCircle, Check } from "lucide-react";
import { isValidPhoneNumber } from "../../utils/validation";
import { useLanguage } from "../../contexts/language/language-provider";
import { ThemeToggle } from "../../components/theme-toggle";
import { LanguageToggle } from "../../components/LanguageToggle";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "../../styles/variables.css";
import "../../styles/pages/VerificationPending.css";
import "../../styles/components/form.css";
import "../../styles/components/button.css";
import "../../styles/components/phone-input.css";
import "../../styles/pages/InviteRecruiter.css";
import { AppHeader } from "../../components/AppHeader";
import { useNavigate } from "react-router-dom";

// Form validation schema
const completeSignupSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters long" })
      .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
      .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
      .regex(/[0-9]/, { message: "Password must contain at least one number" }),
    confirmPassword: z.string(),
    phoneNumber: z.string().min(1, { message: "Phone number is required" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type CompleteSignupFormData = z.infer<typeof completeSignupSchema>;

export function CompleteSignup() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phoneValue, setPhoneValue] = useState<string | undefined>(undefined);
  const [selectedCountry, setSelectedCountry] = useState<string>("IN");
  const [phoneValidationError, setPhoneValidationError] = useState<string | null>(null);
  const [linkExpired, setLinkExpired] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);

  // Header actions component
  const headerActions = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <LanguageToggle />
      <ThemeToggle />
    </div>
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CompleteSignupFormData>({
    resolver: zodResolver(completeSignupSchema),
    mode: "onChange",
  });

  // Phone validation helper
  const isValidPhoneForCountry = useCallback((phone: string): boolean =>
    phone ? isValidPhoneNumber(phone, selectedCountry) : false, [selectedCountry]);

  // Debounce utility
  const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
      const handler = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
  };

  const debouncedPhone = useDebounce(phoneValue || "", 500);

  // Phone value sync
  useEffect(() => {
    setValue("phoneNumber", phoneValue || "", { shouldValidate: true });
  }, [phoneValue, setValue]);

  // Phone availability check
  useEffect(() => {
    if (!debouncedPhone || !isValidPhoneForCountry(debouncedPhone)) {
      setPhoneAvailable(null);
      return;
    }

    setCheckingPhone(true);
    checkPhoneAvailability(debouncedPhone)
      .then((result) => {
        setPhoneAvailable(result.available);
        if (!result.available) {
          setPhoneValidationError(t('signup.validation.phoneRegistered'));
        }
      })
      .catch(() => setPhoneAvailable(null))
      .finally(() => setCheckingPhone(false));
  }, [debouncedPhone, isValidPhoneForCountry, t]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Phone validation
  useEffect(() => {
    if (phoneValue) {
      const isValid = isValidPhoneForCountry(phoneValue);
      if (!isValid) {
        const countryName = selectedCountry === "CA" ? t("completeSignup.canadian") : t("completeSignup.indian");
        setPhoneValidationError(t("completeSignup.validPhoneRequired", { country: countryName }));
        setIsPhoneVerified(false);
      } else if (phoneAvailable === false) {
        setPhoneValidationError(t('signup.validation.phoneRegistered'));
        setIsPhoneVerified(false);
      } else {
        setPhoneValidationError(null);
      }
    } else {
      setPhoneValidationError(null);
      setIsPhoneVerified(false);
    }
  }, [phoneValue, selectedCountry, phoneAvailable, isValidPhoneForCountry, t]);

  // OTP: send verification code
  const sendOtp = useCallback(async () => {
    if (!phoneValue || !isValidPhoneForCountry(phoneValue)) {
      setError(t("completeSignup.pleaseEnterValidPhone"));
      return;
    }

    if (phoneAvailable === false) {
      setError(t('signup.validation.phoneRegistered'));
      return;
    }

    setIsVerifyingPhone(true);
    setError(null);

    try {
      await sendOtpAPI(phoneValue);
      setOtpCode("");
      setShowOtpInput(true);
      setResendTimer(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("signup.error.failedToSendCode"));
    } finally {
      setIsVerifyingPhone(false);
    }
  }, [phoneValue, phoneAvailable, isValidPhoneForCountry, t]);

  // OTP: verify code
  const verifyOtp = useCallback(async () => {
    if (!phoneValue || !otpCode || otpCode.length < 4) {
      setError(t("signup.validation.otpValid"));
      return;
    }

    setIsVerifyingPhone(true);
    setError(null);

    try {
      await verifyOtpAPI(phoneValue, otpCode);
      setIsPhoneVerified(true);
      setShowOtpInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("signup.error.failedToVerifyCode"));
    } finally {
      setIsVerifyingPhone(false);
    }
  }, [phoneValue, otpCode, t]);

  useEffect(() => {
    const checkAuthState = async () => {
      try {
        
        
        // First, check if we have an active session (user might already be authenticated via invite link)
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && session.user) {
          // For invited users, we should allow access if they have a valid session
          // regardless of metadata - the invitation flow creates a session
          setReady(true);
          return;
        }

        // If no session, check URL hash for auth tokens (from redirect)
        const hash = window.location.hash.startsWith("#") ? window.location.hash.substring(1) : window.location.hash;
        const params = new URLSearchParams(hash);
        
        // Check for error states
        const error = params.get("error");
        const errorCode = params.get("error_code");
        const errorDescription = params.get("error_description");

        if (error === "access_denied" && (errorCode === "otp_expired" || errorDescription?.includes("expired"))) {
          setLinkExpired(true);
          setReady(true);
          return;
        }

        // Check for auth tokens in URL hash
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");

        if (accessToken && refreshToken && type === "invite") {
          // Set session with tokens from URL
          const { error: setSessionError } = await supabase.auth.setSession({ 
            access_token: accessToken, 
            refresh_token: refreshToken 
          });
          
          if (setSessionError) {
            setLinkExpired(true);
          } else {
            setReady(true);
          }
        } else {
          // Also check URL search params (sometimes tokens come as query params)
          const searchParams = new URLSearchParams(window.location.search);
          const searchAccessToken = searchParams.get("access_token");
          const searchRefreshToken = searchParams.get("refresh_token");
          const searchType = searchParams.get("type");

          if (searchAccessToken && searchRefreshToken && searchType === "invite") {
            const { error: setSessionError } = await supabase.auth.setSession({ 
              access_token: searchAccessToken, 
              refresh_token: searchRefreshToken 
            });
            
            if (setSessionError) {
              setLinkExpired(true);
            } else {
              setReady(true);
            }
          } else {
            setLinkExpired(true);
          }
        }
      } catch (error) {
        setLinkExpired(true);
      } finally {
        setReady(true);
      }
    };

    checkAuthState();
  }, []);

  const onSubmit = async (data: CompleteSignupFormData) => {
    // Validate phone number
    if (!phoneValue || !isValidPhoneForCountry(phoneValue)) {
      setError(t("completeSignup.pleaseEnterValidPhone"));
      return;
    }

    // Check if phone is available
    if (phoneAvailable === false) {
      setError(t('signup.validation.phoneRegistered'));
      return;
    }

    // Ensure phone verified via OTP
    if (!isPhoneVerified) {
      setError(t("signup.validation.verifyPhoneFirst"));
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);
    
    try {
      await completeOnboardingAPI(data.password, phoneValue);
      setMessage(t("completeSignup.accountCompletedSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("completeSignup.failedToCompleteSignup"));
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="page-container hide-hamburger-menu">
        <AppHeader title="" hideHamburgerMenu={true} actions={headerActions} />
        <div className="centered-container">
          <div className="centered-card">
            <div className="flex items-center justify-center my-6">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            </div>
            <h1 className="auth-card-title">{t("completeSignup.loading")}</h1>
            <p className="text-center">{t("completeSignup.verifyingInvitation")}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show expired link message
  if (linkExpired) {
    return (
      <div className="page-container hide-hamburger-menu">
        <AppHeader title="" hideHamburgerMenu={true} actions={headerActions} />
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
            <h1 className="auth-card-title">{t("completeSignup.invalidAccess")}</h1>
            <p className="error-message">
              {t("completeSignup.invalidInvitationMessage")}
            </p>
            <p className="text-muted" style={{ marginTop: 20, textAlign: "center" }}>
              {t("completeSignup.contactAdminMessage")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isPhoneValid = phoneValue ? isValidPhoneForCountry(phoneValue) : false;
  const isSubmitDisabled = loading || !isPhoneValid || !isPhoneVerified || phoneAvailable === false;

  // Show success message
  if (message) {
    return (
      <div className="page-container hide-hamburger-menu">
        <AppHeader title="" hideHamburgerMenu={true} actions={headerActions} />
        <div className="centered-container">
          <div className="centered-card">
            <div
              className="icon-circle"
              style={{
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                color: "#22c55e",
              }}
            >
              <CheckCircle />
            </div>
            <h1 className="auth-card-title">{t("completeSignup.accountCompletedTitle")}</h1>
            <p className="text-center">{message}</p>
            <p className="text-muted" style={{ marginTop: 12, textAlign: "center" }}>
              {t("completeSignup.loginNowMessage")}
            </p>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <button className="button" onClick={() => navigate("/login")}>{t("buttons.goToLogin")}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container hide-hamburger-menu">
      <AppHeader title="" hideHamburgerMenu={true} actions={headerActions} />
      <div className="centered-container">
        <div className="complete-signup-form">
          <h1 className="auth-card-title">{t("completeSignup.title")}</h1>
          <p className="text-muted text-center" style={{ marginBottom: 24 }}>
            {t("completeSignup.subtitle")}
          </p>
          
          {error && <div className="error-container">{error}</div>}
          
          <form onSubmit={handleSubmit(onSubmit)} className={loading ? "form-loading" : ""}>
            <div className="form-group">
              <label htmlFor="phoneNumber" className="form-label">{t("completeSignup.mobileNumber")} *</label>
              <div className="input-container">
                <PhoneInput
                  international
                  countryCallingCodeEditable={false}
                  defaultCountry="IN"
                  countries={["IN", "CA"]}
                  value={phoneValue}
                  onChange={setPhoneValue}
                  className="form-phone-input"
                  disabled={isPhoneVerified}
                  onCountryChange={(country) => setSelectedCountry(country || "IN")}
                />
                {phoneAvailable === true && (
                  <div className="input-icon success-icon">
                    <Check size={16} />
                  </div>
                )}
              </div>
              {checkingPhone && (
                <p className="availability-message">{t('signup.checkingPhone')}</p>
              )}
              {phoneValidationError && (
                <p className="error-message">{phoneValidationError}</p>
              )}
              {errors.phoneNumber && (
                <p className="error-message">{errors.phoneNumber.message}</p>
              )}
              {isPhoneValid && phoneAvailable && !isPhoneVerified && (
                <button
                  type="button"
                  className="button btn-hover-float"
                  onClick={sendOtp}
                  disabled={isVerifyingPhone}
                  style={{ marginTop: 8 }}
                >
                  {isVerifyingPhone ? (
                    <span className="loading-spinner-small"></span>
                  ) : (
                    t("signup.verifyPhone")
                  )}
                </button>
              )}
              {isPhoneVerified && (
                <p className="success-message" style={{ marginTop: 8 }}>{t("signup.phoneVerified")}</p>
              )}
              {showOtpInput && (
                <div className="otp-container" style={{ marginTop: 8 }}>
                  <div className="otp-header">
                    <p>{t("signup.enterVerificationCode")}</p>
                  </div>
                  <input
                    type="text"
                    className="form-input otp-input"
                    placeholder={t("signup.verificationCodePlaceholder")}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={6}
                  />
                  <div className="otp-actions" style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="button btn-hover-float"
                      onClick={verifyOtp}
                      disabled={isVerifyingPhone || otpCode.length < 4}
                    >
                      {isVerifyingPhone ? (
                        <span className="loading-spinner-small"></span>
                      ) : (
                        t("signup.verifyCode")
                      )}
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={sendOtp}
                      disabled={isVerifyingPhone || resendTimer > 0}
                    >
                      {resendTimer > 0
                        ? t("signup.resendCodeWithTimer", { seconds: resendTimer })
                        : t("signup.resendCode")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">{t("completeSignup.setPassword")} *</label>
              <div className="input-container">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder={t("completeSignup.enterStrongPassword")}
                  {...register("password")}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t("completeSignup.hidePassword") : t("completeSignup.showPassword")}
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
              <label htmlFor="confirmPassword" className="form-label">{t("completeSignup.confirmPassword")} *</label>
              <div className="input-container">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  className="form-input"
                  placeholder={t("completeSignup.confirmYourPassword")}
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? t("completeSignup.hidePassword") : t("completeSignup.showPassword")}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="icon" size={16} />
                  ) : (
                    <Eye className="icon" size={16} />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="error-message">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button 
              type="submit" 
              className="button" 
              disabled={isSubmitDisabled}
            >
              {loading ? <span className="loading-spinner"></span> : t("completeSignup.completeSignupButton")}
            </button>
          </form>
          
          <p className="text-muted" style={{ marginTop: 16, textAlign: "center" }}>
            * {t("completeSignup.requiredFieldsNote")}
          </p>
        </div>
      </div>
    </div>
  );
}


