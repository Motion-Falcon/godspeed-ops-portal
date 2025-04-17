import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { JobSeekerDashboard } from './JobSeekerDashboard';
import '../styles/variables.css';
import '../styles/pages/Dashboard.css';
import '../styles/components/button.css';
import { RecruiterDashboard } from './RecruiterDashboard';

export function Dashboard() {
  const { user, isAdmin, isRecruiter } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) {
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
    return <JobSeekerDashboard />;
  }
} 