import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../theme-toggle';
import '../../styles/auth.css';

interface AuthCardProps {
  type: 'login' | 'signup';
  children?: ReactNode;
  className?: string;
  miniVersion?: boolean;
}

export function AuthCard({ type, children, className, miniVersion = false }: AuthCardProps) {
  return (
    <div className={`auth-card ${className || ''}`}>
      <div className="toggle-container">
        <ThemeToggle />
      </div>
      
      <div className="auth-card-header">
        <div className="auth-card-logo">
          CN
        </div>
        
        <h2 className="auth-card-title">
          {type === 'login' ? 'Sign In' : 'Sign Up'}
        </h2>
      </div>
      
      {miniVersion ? (
        <>
          {type === 'login' ? (
            <>
              <div className="form-group">
                <input
                  type="email"
                  placeholder="Email"
                  className="form-input"
                />
                <input
                  type="password"
                  placeholder="Password"
                  className="form-input"
                  style={{ marginTop: '16px' }}
                />
              </div>
              <button className="button">
                Log in
              </button>
              <div className="auth-footer">
                Don't have an account?{' '}
                <Link to="/signup" className="auth-link">
                  Sign up
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Name"
                  className="form-input"
                />
              </div>
              <button className="button">
                Sign Up
              </button>
              <div className="auth-footer">
                Already have an account?{' '}
                <Link to="/login" className="auth-link">
                  Login
                </Link>
              </div>
            </>
          )}
        </>
      ) : (
        children
      )}
    </div>
  );
} 