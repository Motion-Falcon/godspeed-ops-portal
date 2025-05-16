import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginUser } from '../lib/auth';
import { Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '../components/theme-toggle';
import '../styles/variables.css';
import '../styles/pages/Login.css';
import '../styles/components/form.css';
import '../styles/components/button.css';
import godspeedLogo from '../assets/logos/godspped-logo.png';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
  rememberMe: z.boolean().optional()
});

type LoginFormData = z.infer<typeof loginSchema>;

export function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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
      // Attempt to login
      const result = await loginUser(data.email, data.password, !!data.rememberMe);
      
      // Check if email is verified
      if (!result.emailVerified) {
        // If not verified, redirect to verification pending page
        navigate('/verification-pending', { 
          state: { 
            email: result.email || data.email,
            fromLogin: true 
          } 
        });
      } else {
        // If verified, proceed to dashboard
        navigate('/dashboard');
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Invalid email or password');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Company Branding Column (left in Login) */}
      <div className="auth-column brand">
        <div className="toggle-container mobile-toggle">
          <ThemeToggle />
        </div>
        <div className="brand-content">
          <div className="brand-logo">
            <img src={godspeedLogo} alt="Godspeed Logo" className="godspeed-logo" />
          </div>
          <h2 className="brand-title">Welcome back</h2>
          <p className="brand-description">
            Log in to access your dashboard and continue where you left off.
          </p>
        </div>
      </div>
      
      {/* Login Form Column (right in Login) */}
      <div className="auth-column">
        <div className="toggle-container">
          <ThemeToggle />
        </div>
        <div className="form-container">
          <h1 className="auth-title">Login</h1>

          {error && (
            <div className="error-container">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="form-input"
                {...register('email')}
              />
              {errors.email && (
                <p className="error-message">{errors.email.message}</p>
              )}
            </div>

            <div className="form-group">
              <div className="form-header">
                <label htmlFor="password" className="form-label">Password</label>
                <Link
                  to="/forgot-password"
                  className="forgot-link auth-link"
                >
                  Forgot password?
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
                Remember me
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
                'Log in'
              )}
            </button>
          </form>

          <div className="auth-footer">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="auth-link"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 