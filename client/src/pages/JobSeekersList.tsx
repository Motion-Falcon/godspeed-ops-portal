import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Search, Filter, Eye } from 'lucide-react';
import { getJobseekerProfiles } from '../services/api';
import { JobSeekerProfile } from '../types/jobseeker';
import '../styles/pages/JobSeekersList.css';

export function JobSeekersList() {
  const [profiles, setProfiles] = useState<JobSeekerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { isAdmin, isRecruiter } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has access
    if (!isAdmin && !isRecruiter) {
      navigate('/dashboard');
      return;
    }

    const fetchProfiles = async () => {
      try {
        console.log('Fetching jobseeker profiles...');
        setLoading(true);
        const data = await getJobseekerProfiles();
        console.log('Fetched profiles:', data);
        setProfiles(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching profiles';
        console.error('Error fetching profiles:', err);
        setError(errorMessage);
        
        // Show more detailed error info in console
        if (err instanceof Error) {
          console.error('Error details:', {
            message: err.message,
            stack: err.stack,
            name: err.name
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [isAdmin, isRecruiter, navigate]);

  // Filter profiles based on search term and status filter
  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = 
      profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (profile.skills && profile.skills.some(skill => 
        skill.toLowerCase().includes(searchTerm.toLowerCase())
      )) ||
      (profile.location && profile.location.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || profile.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'verified':
        return 'status-badge verified';
      case 'pending':
        return 'status-badge pending';
      case 'rejected':
        return 'status-badge rejected';
      default:
        return 'status-badge';
    }
  };

  const handleViewProfile = (id: string) => {
    // Navigate to detailed view
    navigate(`/jobseekers/${id}`);
  };

  return (
    <div className="jobseekers-list-container">
      <header className="list-header">
        <div className="header-content">
          <button 
            className="button ghost back-button" 
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>
          <h1>Job Seekers Profiles</h1>
        </div>
      </header>

      <main className="list-main">
        <div className="filter-container">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, email, skills or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="status-filter">
            <Filter size={18} className="filter-icon" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-container">
            <span className="loading-spinner"></span>
            <p>Loading profiles...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button 
              className="button primary" 
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="empty-state">
            <p>No profiles match your search criteria.</p>
          </div>
        ) : (
          <div className="profiles-grid">
            {filteredProfiles.map(profile => (
              <div key={profile.id} className="profile-card">
                <div className="profile-header">
                  <h3 className="profile-name">{profile.name}</h3>
                  <span className={getStatusBadgeClass(profile.status)}>
                    {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                  </span>
                </div>
                
                <div className="profile-info">
                  <p className="profile-email">{profile.email}</p>
                  
                  {profile.location && (
                    <p className="profile-location">Location: {profile.location}</p>
                  )}
                  
                  {profile.skills && profile.skills.length > 0 && (
                    <div className="profile-skills">
                      <p className="skills-label">Skills:</p>
                      <div className="skills-list">
                        {profile.skills.slice(0, 3).map((skill, index) => (
                          <span key={index} className="skill-tag">{skill}</span>
                        ))}
                        {profile.skills.length > 3 && (
                          <span className="more-skills">+{profile.skills.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <p className="profile-date">
                    Joined: {new Date(profile.createdAt).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="profile-actions">
                  <button 
                    className="button primary view-profile-btn"
                    onClick={() => handleViewProfile(profile.id)}
                  >
                    <Eye size={16} className="icon" />
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
} 