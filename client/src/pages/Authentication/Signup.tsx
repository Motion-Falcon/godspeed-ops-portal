import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerUser } from "../../lib/auth";
import { Eye, EyeOff, Check } from "lucide-react";
import { ThemeToggle } from "../../components/theme-toggle";
import { isValidPhoneNumber } from "../../utils/validation";
import "../../styles/variables.css";
import "../../styles/pages/Signup.css";
import "../../styles/pages/Login.css";
import "../../styles/components/form.css";
import "../../styles/components/button.css";
import "../../styles/components/phone-input.css";
import canhireLogo from "../../assets/logos/canhire-logo.png";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import {
  checkAuthEmailAvailability,
  checkPhoneAvailability,
  sendOtpAPI,
  verifyOtpAPI,
} from "../../services/api/auth";
import { LanguageToggle } from "../../components/LanguageToggle";
import { useLanguage } from "../../contexts/language/language-provider";

export function Signup() {
  // Basic state
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phone and verification state
  const [phoneValue, setPhoneValue] = useState<string | undefined>(undefined);
  const [selectedCountry, setSelectedCountry] = useState<string>("IN");
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [phoneValidationError, setPhoneValidationError] = useState<
    string | null
  >(null);

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Availability checking state
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);

  const navigate = useNavigate();

  // Move signupSchema here so t is available
  const signupSchema = z
    .object({
      name: z.string().min(2, { message: t('signup.validation.nameLength') }),
      email: z.string().email({ message: t('signup.validation.email') }),
      phoneNumber: z.string().min(1, { message: t('signup.validation.phoneRequired') }),
      password: z
        .string()
        .min(8, { message: t('signup.validation.passwordLength') })
        .regex(/[A-Z]/, {
          message: t('signup.validation.passwordUppercase'),
        })
        .regex(/[a-z]/, {
          message: t('signup.validation.passwordLowercase'),
        })
        .regex(/[0-9]/, { message: t('signup.validation.passwordNumber') }),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordMismatch'),
      path: ["confirmPassword"],
    });

  // Move type definition after schema
  type SignupFormData = z.infer<typeof signupSchema>;

  // Simplified debounced availability check
  const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
      const handler = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError: setFormError,
    clearErrors,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
  });

  const watchedEmail = watch("email") || "";
  const debouncedEmail = useDebounce(watchedEmail, 500);
  const debouncedPhone = useDebounce(phoneValue || "", 500);

  // Validation helpers
  const isValidEmail = (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhoneForCountry = (phone: string): boolean =>
    phone ? isValidPhoneNumber(phone, selectedCountry) : false;

  // Email availability check
  useEffect(() => {
    if (!debouncedEmail || !isValidEmail(debouncedEmail)) {
      setEmailAvailable(null);
      return;
    }

    setCheckingEmail(true);
    checkAuthEmailAvailability(debouncedEmail)
      .then((result) => {
        setEmailAvailable(result.available);
        if (!result.available) {
          setFormError("email", {
            type: "manual",
            message:
              "This email is already registered. Please use a different email or log in.",
          });
        } else {
          clearErrors("email");
        }
      })
      .catch(() => setEmailAvailable(null))
      .finally(() => setCheckingEmail(false));
  }, [debouncedEmail, setFormError, clearErrors]);

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
          setFormError("phoneNumber", {
            type: "manual",
            message:
              "This phone number is already registered. Please use a different number.",
          });
        } else {
          clearErrors("phoneNumber");
        }
      })
      .catch(() => setPhoneAvailable(null))
      .finally(() => setCheckingPhone(false));
  }, [debouncedPhone, setFormError, clearErrors]);

  // Phone value sync
  useEffect(() => {
    setValue("phoneNumber", phoneValue || "", { shouldValidate: true });
  }, [phoneValue, setValue]);

  // Phone validation
  useEffect(() => {
    if (phoneValue) {
      const isValid = isValidPhoneForCountry(phoneValue);
      if (!isValid) {
        const countryName = selectedCountry === "CA" ? t('signup.validation.canadian') : t('signup.validation.indian');
        setPhoneValidationError(
          t('signup.validation.phoneValid', { country: countryName })
        );
        setFormError("phoneNumber", {
          type: "manual",
          message: t('signup.validation.phoneValid', { country: countryName }),
        });
      } else {
        setPhoneValidationError(null);
      }
    } else {
      setPhoneValidationError(null);
    }
  }, [phoneValue, selectedCountry, setFormError, t]);

  // Resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // OTP functions
  const sendOtp = useCallback(async () => {
    if (!phoneValue || !isValidPhoneForCountry(phoneValue) || !phoneAvailable) {
      setError(t('signup.validation.phoneAvailable'));
      return;
    }

    setIsVerifyingPhone(true);
    setError(null);

    try {
      await sendOtpAPI(phoneValue);
      setOtpCode("");
      setShowOtpInput(true);
      setResendTimer(30);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t('signup.error.failedToSendCode')
      );
    } finally {
      setIsVerifyingPhone(false);
    }
  }, [phoneValue, phoneAvailable, t]);

  const verifyOtp = useCallback(async () => {
    if (!phoneValue || !otpCode || otpCode.length < 4) {
      setError(t('signup.validation.otpValid'));
      return;
    }

    setIsVerifyingPhone(true);
    setError(null);

    try {
      await verifyOtpAPI(phoneValue, otpCode);
      setIsPhoneVerified(true);
      setShowOtpInput(false);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : t('signup.error.failedToVerifyCode')
      );
    } finally {
      setIsVerifyingPhone(false);
    }
  }, [phoneValue, otpCode, t]);

  const onSubmit = async (data: SignupFormData) => {
    // Validation checks
    if (emailAvailable === false) {
      setError(
        t('signup.validation.emailRegistered')
      );
      return;
    }

    if (phoneAvailable === false) {
      setError(
        t('signup.validation.phoneRegistered')
      );
      return;
    }

    if (phoneValue && !isPhoneVerified) {
      setError(t('signup.validation.verifyPhoneFirst'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await registerUser(
        data.email,
        data.password,
        data.name,
        data.phoneNumber
      );
      navigate("/verification-pending", { state: { email: data.email } });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : t('signup.error.unexpected')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isPhoneValid = phoneValue ? isValidPhoneForCountry(phoneValue) : false;
  const isSubmitDisabled =
    isLoading ||
    (!!phoneValue && !isPhoneVerified) ||
    emailAvailable === false ||
    phoneAvailable === false;

  return (
    <div className="auth-container">
      {/* Signup Form Column */}
      <div className="auth-column">
        <div className="form-container">
          <h1 className="auth-title">{t('auth.signup')}</h1>

          {error && <div className="error-container">{error}</div>}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className={isLoading ? "form-loading" : ""}
          >
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                {t('forms.name')}
              </label>
              <input
                id="name"
                placeholder={t('forms.namePlaceholder')}
                className="form-input"
                {...register("name")}
              />
              {errors.name && (
                <p className="error-message">{errors.name.message}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                {t('forms.email')}
              </label>
              <div className="input-container">
                <input
                  id="email"
                  type="email"
                  placeholder={t('forms.emailPlaceholder')}
                  className="form-input"
                  {...register("email")}
                />
                {emailAvailable === true && (
                  <div className="input-icon success-icon">
                    <Check size={16} />
                  </div>
                )}
              </div>
              {checkingEmail && (
                <p className="availability-message">{t('signup.checkingEmail')}</p>
              )}
              {errors.email && !checkingEmail && (
                <p className="error-message">{errors.email.message}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="phoneNumber" className="form-label">
                {t('forms.phone')}
              </label>
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
                  onCountryChange={(country) =>
                    setSelectedCountry(country || "IN")
                  }
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
              {errors.phoneNumber && !checkingPhone && (
                <p className="error-message">{errors.phoneNumber.message}</p>
              )}

              {isPhoneValid && phoneAvailable && !isPhoneVerified && (
                <button
                  type="button"
                  className="button btn-hover-float"
                  onClick={sendOtp}
                  disabled={isVerifyingPhone}
                >
                  {isVerifyingPhone ? (
                    <span className="loading-spinner-small"></span>
                  ) : (
                    t('signup.verifyPhone')
                  )}
                </button>
              )}

              {isPhoneVerified && (
                <p className="success-message">{t('signup.phoneVerified')}</p>
              )}

              {showOtpInput && (
                <div className="otp-container">
                  <div className="otp-header">
                    <p>{t('signup.enterVerificationCode')}</p>
                  </div>
                  <input
                    type="text"
                    className="form-input otp-input"
                    placeholder={t('signup.verificationCodePlaceholder')}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={6}
                  />
                  <div className="otp-actions">
                    <button
                      type="button"
                      className="button btn-hover-float"
                      onClick={verifyOtp}
                      disabled={isVerifyingPhone || otpCode.length < 4}
                    >
                      {isVerifyingPhone ? (
                        <span className="loading-spinner-small"></span>
                      ) : (
                        t('signup.verifyCode')
                      )}
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={sendOtp}
                      disabled={isVerifyingPhone || resendTimer > 0}
                    >
                      {resendTimer > 0
                        ? t('signup.resendCodeWithTimer', { seconds: resendTimer })
                        : t('signup.resendCode')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                {t('forms.password')}
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
                  aria-label={showPassword ? t('signup.hidePassword') : t('signup.showPassword')}
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
                {t('forms.confirmPassword')}
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
                  aria-label={
                    showConfirmPassword ? t('signup.hidePassword') : t('signup.showPassword')
                  }
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

            <button
              type="submit"
              className="button btn-hover-float"
              disabled={isSubmitDisabled}
            >
              {isLoading ? (
                <span className="loading-spinner"></span>
              ) : (
                t('auth.signup')
              )}
            </button>
          </form>

          <div className="auth-footer">
            <span>{t('signup.alreadyHaveAccount')}</span>
            <Link to="/login" className="auth-link">
              {t('auth.login')}
            </Link>
          </div>
        </div>
      </div>

      {/* Company Branding Column */}
      <div className="auth-column brand">
        <div className="toggle-container">
        <LanguageToggle /> <ThemeToggle />
        </div>
        <div className="brand-content">
          <div className="brand-logo">
            <img
              src={canhireLogo}
              alt={t('common.canhireLogo')}
              className="godspeed-logo"
            />
          </div>
          <h2 className="brand-title">
            Godspeed <span className="gradient-text">Operations</span>
          </h2>
          <p className="brand-description">
            {t('signup.brandDescription')}
          </p>
        </div>
      </div>
    </div>
  );
}
