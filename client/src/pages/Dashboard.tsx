import { useState, useEffect } from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../components/theme-toggle';
import '../styles/variables.css';
import '../styles/pages/Dashboard.css';
import '../styles/components/button.css';

interface UserData {
  id: string;
  email: string | null | undefined;
  name: string;
  createdAt: string;
  lastSignIn: string;
}

export function Dashboard() {
  const { user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    if (user) {
      setUserData({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || 'User',
        createdAt: new Date(user.created_at).toLocaleDateString(),
        lastSignIn: user.last_sign_in_at 
          ? new Date(user.last_sign_in_at).toLocaleString() 
          : 'First login'
      });
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logoutUser();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      setIsLoggingOut(false);
    }
  };

  if (!userData) {
    return (
      <div className="centered-container">
        <span className="loading-spinner"></span>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo-container">
            <div className="logo">
              CN
            </div>
            <span className="brand-title" style={{ margin: 0, fontSize: '1.25rem' }}>Company Portal</span>
          </div>
          
          <div className="header-actions">
            <ThemeToggle />
            <button 
              className="button ghost button-icon" 
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <span className="loading-spinner"></span>
              ) : (
                <>
                  <LogOut className="icon" size={16} />
                  <span>Log out</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="dashboard-main">
        <h1 className="dashboard-title">Welcome, {userData.name}!</h1>
        <p className="dashboard-subtitle">
          Here's your account information
        </p>

        <div className="dashboard-grid">
          <div className="card">
            <div className="card-header">
              <UserIcon className="icon" size={20} />
              <h2 className="card-title">Account Details</h2>
            </div>
            
            <div>
              <div className="data-item">
                <p className="data-label">Name</p>
                <p className="data-value">{userData.name}</p>
              </div>
              
              <div className="data-item">
                <p className="data-label">Email Address</p>
                <p className="data-value">{userData.email}</p>
              </div>
              
              <div className="data-item">
                <p className="data-label">Account ID</p>
                <p className="data-value" style={{ fontSize: '0.875rem' }}>{userData.id}</p>
              </div>
              
              <div className="data-item">
                <p className="data-label">Account Created</p>
                <p className="data-value">{userData.createdAt}</p>
              </div>
              
              <div className="data-item">
                <p className="data-label">Last Login</p>
                <p className="data-value">{userData.lastSignIn}</p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: '1rem' }}>Quick Actions</h2>
            <div className="action-list">
              <button className="button outline" style={{ justifyContent: 'flex-start' }}>
                Update Profile
              </button>
              <button className="button outline" style={{ justifyContent: 'flex-start' }}>
                Change Password
              </button>
              <button className="button outline" style={{ justifyContent: 'flex-start' }}>
                Notification Settings
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 