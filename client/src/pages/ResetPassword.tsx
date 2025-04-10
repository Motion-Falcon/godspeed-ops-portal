import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updatePasswordWithResetToken } from '../lib/auth';
import { Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { ThemeToggle } from '../components/theme-toggle';
import '../styles/variables.css';
import '../styles/pages/ForgotPassword.css';
import '../styles/components/form.css';
import '../styles/components/button.css';

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
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

  useEffect(() => {
    // Check for token processing - give Supabase time to redirect with tokens
    const checkForTokens = () => {
      console.log('Checking for tokens...');
      console.log('URL hash:', location.hash);
      console.log('URL search:', location.search);
      
      // Check if we have access and refresh tokens in the URL hash
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const typeFromHash = hashParams.get('type');
      
      // Also check the query parameters
      const queryParams = new URLSearchParams(location.search);
      const token = queryParams.get('token');
      const typeFromQuery = queryParams.get('type');
      
      console.log('Hash params:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type: typeFromHash });
      console.log('Query params:', { token: !!token, type: typeFromQuery });
      
      if (accessToken && refreshToken) {
        console.log('Found hash tokens, proceeding with reset');
        setHasToken(true);
        setIsVerifying(false);
      } else if (token && typeFromQuery === 'recovery') {
        // If we have the initial token but not the processed tokens yet, 
        // wait a bit longer and check again
        console.log('Found initial token, waiting for Supabase redirect...');
        setTimeout(checkForTokens, 2000); // Check again in 2 seconds
      } else {
        // After multiple checks, if we still don't have tokens, show error
        console.log('No valid tokens found after verification time');
        setIsVerifying(false);
        setError('Password reset link is invalid or has expired. Please request a new one.');
      }
    };

    // Give Supabase a moment to process the token and redirect
    // Increased initial timeout to 2 seconds
    const timer = setTimeout(checkForTokens, 2000);
    
    return () => clearTimeout(timer);
  }, [location]);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema)
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await updatePasswordWithResetToken(data.password);
      setIsSuccess(true);
      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An error occurred while resetting your password.');
      }
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="centered-container">
        <div className="centered-card">
          <div className="toggle-container">
            <ThemeToggle />
          </div>
          
          <div className="flex items-center justify-center my-6">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          </div>
          
          <h1 className="auth-card-title">Verifying Reset Link</h1>
          
          <p className="text-center">
            Please wait while we verify your password reset link...
          </p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="centered-container">
        <div className="centered-card">
          <div className="toggle-container">
            <ThemeToggle />
          </div>
          
          <div className="icon-circle" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
            <Check />
          </div>
          
          <h1 className="auth-card-title">Password Reset Successful</h1>
          
          <p>
            Your password has been reset successfully. You will be redirected to the login page shortly.
          </p>
          
          <button
            className="button"
            onClick={() => navigate('/login')}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!hasToken) {
    return (
      <div className="centered-container">
        <div className="centered-card">
          <div className="toggle-container">
            <ThemeToggle />
          </div>
          
          <div className="icon-circle" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <AlertCircle />
          </div>
          
          <h1 className="auth-card-title">Invalid Reset Link</h1>
          
          <p className="error-message">
            {error}
          </p>
          
          <button
            className="button"
            onClick={() => navigate('/forgot-password')}
          >
            Request New Reset Link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="centered-container">
      <div className="centered-card">
        <div className="toggle-container">
          <ThemeToggle />
        </div>
        
        <h1 className="auth-card-title">Reset Your Password</h1>
        
        <p className="text-muted">
          Enter your new password below.
        </p>

        {error && (
          <div className="error-container">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
          <div className="form-group">
            <label htmlFor="password" className="form-label">New Password</label>
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

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
            <div className="input-container">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className="form-input"
                {...register('confirmPassword')}
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
              <p className="error-message">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            className="button"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-spinner"></span>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
} 