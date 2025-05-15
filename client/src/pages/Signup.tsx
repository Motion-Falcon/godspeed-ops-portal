import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerUser } from '../lib/auth';
import { Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '../components/theme-toggle';
import '../styles/variables.css';
import '../styles/pages/Signup.css';
import '../styles/pages/Login.css';
import '../styles/components/form.css';
import '../styles/components/button.css';
import godspeedLogo from '../assets/logos/godspped-logo.png';

const signupSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
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

type SignupFormData = z.infer<typeof signupSchema>;

export function Signup() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema)
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await registerUser(data.email, data.password, data.name);
      navigate('/verification-pending', { state: { email: data.email } });
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Signup Form Column (left in Signup) */}
      <div className="auth-column">
        <div className="toggle-container mobile-toggle">
          <ThemeToggle />
        </div>
        <div className="form-container">
          <h1 className="auth-title">Sign Up</h1>

          {error && (
            <div className="error-container">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className={isLoading ? 'form-loading' : ''}>
            <div className="form-group">
              <label htmlFor="name" className="form-label">Name</label>
              <input
                id="name"
                placeholder="Your name"
                className="form-input"
                {...register('name')}
              />
              {errors.name && (
                <p className="error-message">{errors.name.message}</p>
              )}
            </div>

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
              <label htmlFor="password" className="form-label">Password</label>
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
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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
              className="button btn-hover-float"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="loading-spinner"></span>
              ) : (
                'Sign Up'
              )}
            </button>
          </form>

          <div className="auth-footer">
            <span>Already have an account?</span>
            <Link
              to="/login"
              className="auth-link"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>

      {/* Company Branding Column (right in Signup) */}
      <div className="auth-column brand">
        <div className="toggle-container">
          <ThemeToggle />
        </div>
        <div className="brand-content">
          <div className="brand-logo">
            <img src={godspeedLogo} alt="Godspeed Logo" className="godspeed-logo" />
          </div>
          <h2 className="brand-title">Godspeed <span className="gradient-text">Operations</span></h2>
          <p className="brand-description">
            Transform your ideas into beautiful digital experiences with our comprehensive suite of tools and resources.
          </p>
        </div>
      </div>
    </div>
  );
} 