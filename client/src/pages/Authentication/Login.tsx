import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { validateCredentials } from '../../lib/auth';
import { Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '../../components/theme-toggle';
import { useLanguage } from '../../contexts/language/language-provider';
import '../../styles/variables.css';
import '../../styles/pages/Login.css';
import '../../styles/components/form.css';
import '../../styles/components/button.css';
import canhireLogo from '../../assets/logos/canhire-logo.png';
import motionFalconLogo from '../../assets/logos/motion-falcon-logo.png';
import { LanguageToggle } from '../../components/LanguageToggle';

export function Login() {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loginSchema = z.object({
    email: z.string().email({ message: t('validation.emailInvalid') }),
    password: z.string().min(1, { message: t('validation.required') }),
    rememberMe: z.boolean().optional()
  });

  type LoginFormData = z.infer<typeof loginSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false
    }
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the new secure credential validation
      const result = await validateCredentials(data.email, data.password);
      
      // Check if email is verified
      if (!result.user.user_metadata.email_verified && result.user.email) {
        // If not verified, redirect to verification pending page
        navigate('/verification-pending', { 
          state: { 
            email: result.email,
            fromLogin: true 
          } 
        });
        return;
      }

      // Check if 2FA is required
      if (result.user.user_metadata.user_type === 'recruiter' || result.user.user_metadata.user_type === 'admin') {
        // Check if user has a phone number for 2FA
        const phoneNumber = result.user?.user_metadata?.phoneNumber;
        
        if (phoneNumber) {
          // Redirect to 2FA verification - store credentials securely in session state
          navigate('/two-factor-auth', {
            state: { 
              user: result.user,
              email: data.email,
              password: data.password,
              rememberMe: data.rememberMe,
              timestamp: Date.now()
            }
          });
          return;
        } else {
          // No phone number available for 2FA
          setError(t('auth.twoFactorPhoneRequired'));
          setIsLoading(false);
          return;
        }
      }

      // Regular user - proceed to dashboard (session already set)
      navigate('/dashboard');
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(t('auth.invalidCredentials'));
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Company Branding Column (left in Login) */}
      <div className="auth-column brand">
        <div className="brand-content">
          <div className="brand-logo">
            <img src={canhireLogo} alt={t('common.godspeedLogo')} className="godspeed-logo" />
          </div>
          <h2 className="brand-title">{t('auth.welcomeBack')}</h2>
          <p className="brand-description">
            {t('auth.loginDescription')}
          </p>
        </div>
      </div>
      
      {/* Login Form Column (right in Login) */}
      <div className="auth-column">
        <div className="toggle-container">
        <LanguageToggle /> <ThemeToggle />
        </div>
        <div className="form-container">
          <h1 className="auth-title">{t('auth.login')}</h1>

          {error && (
            <div className="error-container">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group">
              <label htmlFor="email" className="form-label">{t('forms.email')}</label>
              <input
                id="email"
                type="email"
                placeholder={t('forms.emailPlaceholder')}
                className="form-input"
                {...register('email')}
              />
              {errors.email && (
                <p className="error-message">{errors.email.message}</p>
              )}
            </div>

            <div className="form-group">
              <div className="form-header">
                <label htmlFor="password" className="form-label">{t('forms.password')}</label>
                <Link
                  to="/forgot-password"
                  className="forgot-link auth-link"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <div className="input-container">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  {...register('password')}
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

            <div className="checkbox-container">
              <input 
                type="checkbox" 
                id="remember" 
                className="form-checkbox"
                {...register('rememberMe')} 
              />
              <label
                htmlFor="remember"
                className="checkbox-label"
              >
                {t('auth.rememberMe')}
              </label>
            </div>

            <button
              type="submit"
              className="button"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="loading-spinner"></span>
              ) : (
                t('auth.login')
              )}
            </button>
          </form>

          <div className="auth-footer">
            {t('auth.noAccount')}{' '}
            <Link
              to="/signup"
              className="auth-link"
            >
              {t('auth.signup')}
            </Link>
          </div>

          <div className="terms-privacy-notice">
            {t('auth.termsPrivacyNotice')}{' '}
            <a 
              href="/terms-of-service" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="auth-link"
            >
              {t('auth.termsOfService')}
            </a>
            {' '}{t('common.and')}{' '}
            <a 
              href="/privacy-policy" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="auth-link"
            >
              {t('auth.privacyPolicy')}
            </a>.
          </div>
        </div>
      </div>
      
      {/* Motion Falcon Footer - Left Bottom */}
      <div className="motion-falcon-footer left">
        <span>Powered by</span>
        <img 
          src={motionFalconLogo} 
          alt="Motion Falcon" 
          className="motion-falcon-logo" 
        />
        <span>Motion Falcon</span>
      </div>
    </div>
  );
} 