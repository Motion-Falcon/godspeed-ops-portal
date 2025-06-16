import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Shield, 
  UserCheck, 
  Clock, 
  Key,
  KeyRound
} from 'lucide-react';
import '../styles/pages/userProfile.css';

interface UserDetails {
  id: string;
  email: string;
  phone?: string;
  name: string;
  userType: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  lastSignIn?: string;
  emailConfirmedAt?: string;
}

export function UserProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const details: UserDetails = {
        id: user.id,
        email: user.email || '',
        phone: user.user_metadata?.phoneNumber || '',
        name: user.user_metadata?.name || '',
        userType: user.user_metadata?.user_type || 'jobseeker',
        emailVerified: user.user_metadata?.email_verified || false,
        phoneVerified: user.user_metadata?.phone_verified || false,
        createdAt: user.created_at || '',
        lastSignIn: user.last_sign_in_at || '',
        emailConfirmedAt: user.email_confirmed_at || ''
      };
      
      setUserDetails(details);
      setIsLoading(false);
    }
  }, [user]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Not available';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'Administrator';
      case 'recruiter':
        return 'Recruiter';
      case 'jobseeker':
        return 'Job Seeker';
      default:
        return role;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'role-badge admin';
      case 'recruiter':
        return 'role-badge recruiter';
      case 'jobseeker':
        return 'role-badge jobseeker';
      default:
        return 'role-badge';
    }
  };

  if (isLoading) {
    return (
      <div className="user-profile-page">
        <AppHeader title="User Profile" hideHamburgerMenu={false} />
        <div className="user-profile-container">
          <div className="profile-card loading">
            <div className="loading-skeleton header-skeleton"></div>
            <div className="loading-skeleton text-skeleton"></div>
            <div className="loading-skeleton text-skeleton"></div>
            <div className="loading-skeleton text-skeleton"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!userDetails) {
    return (
      <div className="user-profile-page">
        <AppHeader title="User Profile" hideHamburgerMenu={false} />
        <div className="user-profile-container">
          <div className="error-card">
            <h3>Unable to load profile</h3>
            <p>Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-profile-page">
      <AppHeader title="User Profile" hideHamburgerMenu={false} />
      
      <div className="user-profile-container">
        <div className="profile-card">
          {/* Header Section */}
          <div className="profile-header">
            <div className="profile-avatar">
              <User size={32} />
            </div>
            <div className="profile-basic-info">
              <h1 className="profile-name">{userDetails.name}</h1>
              <div className={getRoleBadgeClass(userDetails.userType)}>
                <Shield size={14} />
                <span>{getRoleDisplayName(userDetails.userType)}</span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="profile-details-grid">
            {/* Contact Information */}
            <div className="detail-section">
              <h3 className="section-title">
                <Mail size={18} />
                Contact Information
              </h3>
              
              <div className="detail-row">
                <label>Email Address</label>
                <div className="detail-value">
                  <span>{userDetails.email}</span>
                  <div className="verification-status">
                    {userDetails.emailVerified ? (
                      <span className="verified">
                        <UserCheck size={14} />
                        Verified
                      </span>
                    ) : (
                      <span className="pending">
                        <Clock size={14} />
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="detail-row">
                <label>Phone Number</label>
                <div className="detail-value">
                  <span>{userDetails.phone || 'Not provided'}</span>
                  <div className="verification-status">
                    {userDetails.phoneVerified ? (
                      <span className="verified">
                        <UserCheck size={14} />
                        Verified
                      </span>
                    ) : (
                      <span className="pending">
                        <Clock size={14} />
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="detail-section">
              <h3 className="section-title">
                <Key size={18} />
                Account Information
              </h3>
              
              <div className="detail-row">
                <label>User ID</label>
                <div className="detail-value">
                  <code className="user-id">{userDetails.id}</code>
                </div>
              </div>

              <div className="detail-row">
                <label>Account Created</label>
                <div className="detail-value">
                  <span>{formatDate(userDetails.createdAt)}</span>
                </div>
              </div>

              <div className="detail-row">
                <label>Email Confirmed</label>
                <div className="detail-value">
                  <span>{formatDate(userDetails.emailConfirmedAt)}</span>
                </div>
              </div>

              <div className="detail-row">
                <label>Last Sign In</label>
                <div className="detail-value">
                  <span>{formatDate(userDetails.lastSignIn)}</span>
                </div>
              </div>
            </div>
          {/* Account Actions */}
          <div className="account-actions">
            <h3 className="section-title">
              <Key size={18} />
              Account Actions
            </h3>
            <div className="action-buttons">
              <button
                className="button outline"
                onClick={() => navigate("/reset-password")}
              >
                <KeyRound size={16} className="icon" />
                Reset Password
              </button>
            </div>
          </div>
          </div>

        </div>
      </div>
    </div>
  );
} 