import { useState, useEffect } from 'react';
import { LogOut, User as UserIcon, UserCheck, Shield, Activity } from 'lucide-react';
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

export function RecruiterDashboard() {
  const { user, isAdmin, isRecruiter } = useAuth();
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
        userType: user.user_metadata?.user_type || 'recruiter',
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

  // Get the role icon based on user type
  const getRoleIcon = () => {
    if (isAdmin) return <Shield className="role-icon admin" />;
    if (isRecruiter) return <UserCheck className="role-icon recruiter" />;
    return <UserIcon className="role-icon jobseeker" />;
  };

  // Get role name for display
  const getRoleName = () => {
    if (isAdmin) return 'Administrator';
    if (isRecruiter) return 'Recruiter';
    return 'Job Seeker';
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo-container">
            <div className="logo">
              CN
            </div>
            <span className="brand-title" style={{ margin: 0, fontSize: '1.25rem' }}>Recruiter Portal</span>
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
            {getRoleIcon()}
            <span>{getRoleName()}</span>
          </div>
        </div>
        <p className="dashboard-subtitle">
          Manage your job postings and candidates
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
                <p className="data-label">User Role</p>
                <p className="data-value">{getRoleName()}</p>
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
            <h2 className="card-title" style={{ marginBottom: '1rem' }}>Recruiter Actions</h2>
            <div className="action-list">
              <button 
                className="button outline" 
                style={{ justifyContent: 'flex-start' }}
                onClick={() => navigate('/profile/create')}
              >
                Create Job Posting
              </button>
              <button className="button outline" style={{ justifyContent: 'flex-start' }}>
                View Active Postings
              </button>
              <button 
                className="button outline" 
                style={{ justifyContent: 'flex-start' }}
                onClick={() => navigate('/jobseekers')}
              >
                Job Seekers
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
              
              {/* Admin-only actions */}
              {isAdmin && (
                <button className="button outline admin-action" style={{ justifyContent: 'flex-start' }}>
                  <Shield size={16} className="icon" />
                  Admin Dashboard
                </button>
              )}
              
              <button className="button outline recruiter-action" style={{ justifyContent: 'flex-start' }}>
                <UserCheck size={16} className="icon" />
                Manage Company Profile
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 