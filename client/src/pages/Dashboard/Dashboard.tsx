import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { JobSeekerDashboard } from "./JobSeekerDashboard";
import { RecruiterDashboard } from "./RecruiterDashboard";
import "../../styles/variables.css";
import "../../styles/pages/Dashboard.css";
import "../../styles/components/button.css";
import { AdminDashboard } from "./AdminDashboard";

export function Dashboard() {
  const {
    user,
    isAdmin,
    isRecruiter,
    isJobSeeker,
    profileVerificationStatus,
    hasProfile,
  } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
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
  if (isRecruiter) {
    return <RecruiterDashboard />;
  } else if (isAdmin) {
    return <AdminDashboard />;
  } else {
    // This will only render for jobseekers with verified profiles
    // Others will be redirected in the useEffect
    return <JobSeekerDashboard />;
  }
}
