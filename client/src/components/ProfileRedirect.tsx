import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export function ProfileRedirect() {
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfileId = async () => {
      if (!user) {
        setIsLoading(false);
        setError('User not authenticated');
        return;
      }

      try {
        const { data, error } = await supabase
          .from("jobseeker_profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error fetching profile ID:", error);
          setError('Could not find your profile. You may need to create one first.');
        } else if (data) {
          setProfileId(data.id);
        } else {
          setError('Profile not found. You may need to create one first.');
        }
      } catch (err) {
        console.error("Error fetching profile ID:", err);
        setError('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfileId();
  }, [user]);

  if (isLoading) {
    return <div className="centered-container">
      <span className="loading-spinner"></span>
    </div>;
  }

  if (error) {
    return <Navigate to="/profile/create" />;
  }

  if (profileId) {
    return <Navigate to={`/jobseekers/${profileId}`} />;
  }

  // Fallback - should not reach here normally
  return <Navigate to="/profile/create" />;
} 