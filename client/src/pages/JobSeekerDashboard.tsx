import { useState, useEffect } from 'react';
import { LogOut, User as UserIcon, Briefcase, FileText, Bell, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../components/theme-toggle';
import { checkApiHealth } from '../services/api';

interface UserData {
  id: string;
  email: string | null | undefined;
  name: string;
  userType: string;
  createdAt: string;
  lastSignIn: string;
}

export function JobSeekerDashboard() {
  const { user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    if (user) {
      setUserData({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || 'User',
        userType: user.user_metadata?.user_type || 'jobseeker',
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

  const handleCheckHealth = async () => {
    setHealthStatus('Checking...');
    try {
      const result = await checkApiHealth();
      if (result.status === 'healthy') {
        setHealthStatus(`✅ Connection healthy: ${result.user}`);
      } else {
        setHealthStatus(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      setHealthStatus(`❌ Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            <span className="brand-title" style={{ margin: 0, fontSize: '1.25rem' }}>Job Seeker Portal</span>
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
        <div className="dashboard-heading">
          <h1 className="dashboard-title">Welcome, {userData.name}!</h1>
          <div className="user-role-badge">
            <UserIcon className="role-icon jobseeker" />
            <span>Job Seeker</span>
          </div>
        </div>
        <p className="dashboard-subtitle">
          Find your dream job and manage your applications
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
            <h2 className="card-title" style={{ marginBottom: '1rem' }}>Job Seeker Actions</h2>
            <div className="action-list">
              <button className="button outline" style={{ justifyContent: 'flex-start' }}>
                <Briefcase size={16} className="icon" />
                Browse Job Listings
              </button>
              <button className="button outline" style={{ justifyContent: 'flex-start' }}>
                <FileText size={16} className="icon" />
                Manage My Resume
              </button>
              <button className="button outline" style={{ justifyContent: 'flex-start' }}>
                <Bell size={16} className="icon" />
                Job Alerts
              </button>
              
              <button className="button outline" style={{ justifyContent: 'flex-start' }}>
                My Applications
              </button>
              
              {/* Reset Password button */}
              <button 
                className="button outline" 
                style={{ justifyContent: 'flex-start' }}
                onClick={() => navigate('/reset-password')}
              >
                Reset Password
              </button>
              
              {/* Health check button */}
              <button 
                className="button outline" 
                onClick={handleCheckHealth}
                style={{ justifyContent: 'flex-start' }}
              >
                <Activity size={16} className="icon" />
                Check Auth Status
              </button>
              
              {healthStatus && (
                <div className="health-status">
                  {healthStatus}
                </div>
              )}
            </div>
          </div>
          
          {/* Job recommendations card */}
          <div className="card" style={{ gridColumn: "span 2" }}>
            <h2 className="card-title">Recommended Jobs</h2>
            <p className="card-subtitle">Based on your profile and preferences</p>
            
            <div className="recommendations-placeholder" style={{ 
              padding: "1rem", 
              backgroundColor: "var(--background-secondary)",
              borderRadius: "0.5rem",
              marginTop: "1rem"
            }}>
              <p>Complete your profile to see personalized job recommendations</p>
              <button className="button primary" style={{ marginTop: "0.5rem" }}>
                Update Profile
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 