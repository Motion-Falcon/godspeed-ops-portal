import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { JobSeekerDashboard } from './JobSeekerDashboard';
import '../styles/variables.css';
import '../styles/pages/Dashboard.css';
import '../styles/components/button.css';
import { RecruiterDashboard } from './RecruiterDashboard';

export function Dashboard() {
  const { user, isAdmin, isRecruiter, isJobSeeker, profileVerificationStatus, hasProfile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // // Check jobseeker profile state and redirect accordingly
    // if (isJobSeeker) {
    //   // Check if user has a profile using the hasProfile flag
    //   if (!hasProfile) {
    //     // No profile exists, redirect to create profile
    //     navigate('/profile/create');
    //   } else if (profileVerificationStatus === 'pending' || profileVerificationStatus === 'rejected') {
    //     // Profile exists but not verified
    //     navigate('/profile-verification-pending');
    //   }
    //   // If verified, continue to jobseeker dashboard which will render below
    // }
    
    setIsLoading(false);
  }, [user, navigate, isJobSeeker, profileVerificationStatus, hasProfile]);

  if (!user || isLoading) {
    return (
      <div className="centered-container">
        <span className="loading-spinner"></span>
      </div>
    );
  }

  // Render dashboard based on user type
  if (isAdmin || isRecruiter) {
    return <RecruiterDashboard />;
  } else {
    // This will only render for jobseekers with verified profiles
    // Others will be redirected in the useEffect
    return <JobSeekerDashboard />;
  }
} 