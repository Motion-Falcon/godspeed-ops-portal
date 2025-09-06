import { useState, useEffect } from "react";
import {
  User as UserIcon,
  CheckCircle,
  FileText,
  MapPin,
  Award,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { getJobseekerProfile } from "../../services/api/jobseeker";
import { JobSeekerDetailedProfile } from "../../types/jobseeker";
import "./ProfileCompletion.css";

interface ProfileCompletionSection {
  name: string;
  completed: number;
  total: number;
  percentage: number;
  icon: React.ReactNode;
}

interface ProfileCompletionProps {
  userId: string;
}

export function ProfileCompletion({ userId }: ProfileCompletionProps) {
  // const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profile, setProfile] = useState<JobSeekerDetailedProfile | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileCompletion, setProfileCompletion] = useState<{
    overall: number;
    sections: ProfileCompletionSection[];
  } | null>(null);

  // Function to calculate profile completion
  const calculateProfileCompletion = (
    profile: JobSeekerDetailedProfile | null
  ) => {
    if (!profile) {
      return {
        overall: 0,
        sections: [
          {
            name: "Personal Info",
            completed: 0,
            total: 13,
            percentage: 0,
            icon: <UserIcon size={16} />,
          },
          {
            name: "Address",
            completed: 0,
            total: 4,
            percentage: 0,
            icon: <MapPin size={16} />,
          },
          {
            name: "Qualifications",
            completed: 0,
            total: 7,
            percentage: 0,
            icon: <Award size={16} />,
          },
          {
            name: "Documents",
            completed: 0,
            total: 1,
            percentage: 0,
            icon: <FileText size={16} />,
          },
        ],
      };
    }

    // Personal Info Section - Count each field individually (13 fields)
    const personalInfoFields = [
      profile.firstName,
      profile.lastName,
      profile.dob,
      profile.email,
      profile.mobile,
      profile.licenseNumber,
      profile.passportNumber,
      profile.sinNumber,
      profile.sinExpiry,
      profile.workPermitUci,
      profile.workPermitExpiry,
      profile.businessNumber,
      profile.corporationName,
    ];
    const personalInfoCompleted = personalInfoFields.filter(
      (field) => field && field.toString().trim() !== ""
    ).length;

    // Address Section - Count each field individually (4 fields)
    const addressFields = [
      profile.street,
      profile.city,
      profile.province,
      profile.postalCode,
    ];
    const addressCompleted = addressFields.filter(
      (field) => field && field.toString().trim() !== ""
    ).length;

    // Qualifications Section - Count each field individually (7 fields)
    const qualificationFields = [
      profile.workPreference,
      profile.bio,
      profile.licenseType,
      profile.experience,
      profile.manualDriving,
      profile.availability,
      profile.weekendAvailability !== undefined ? "set" : null, // Boolean field - check if defined
    ];
    const qualificationsCompleted = qualificationFields.filter(
      (field) => field && field.toString().trim() !== ""
    ).length;

    // Documents Section - At least one document (1 field)
    const documentsCompleted =
      profile.documents && profile.documents.length > 0 ? 1 : 0;
    const documentsTotal = 1;

    const sections: ProfileCompletionSection[] = [
      {
        name: "Personal Info",
        completed: personalInfoCompleted,
        total: personalInfoFields.length,
        percentage: Math.round(
          (personalInfoCompleted / personalInfoFields.length) * 100
        ),
        icon: <UserIcon size={16} />,
      },
      {
        name: "Address",
        completed: addressCompleted,
        total: addressFields.length,
        percentage: Math.round((addressCompleted / addressFields.length) * 100),
        icon: <MapPin size={16} />,
      },
      {
        name: "Qualifications",
        completed: qualificationsCompleted,
        total: qualificationFields.length,
        percentage: Math.round(
          (qualificationsCompleted / qualificationFields.length) * 100
        ),
        icon: <Award size={16} />,
      },
      {
        name: "Documents",
        completed: documentsCompleted,
        total: documentsTotal,
        percentage: Math.round((documentsCompleted / documentsTotal) * 100),
        icon: <FileText size={16} />,
      },
    ];

    // Calculate overall completion
    const totalFields =
      personalInfoFields.length +
      addressFields.length +
      qualificationFields.length +
      documentsTotal;
    const totalCompleted =
      personalInfoCompleted +
      addressCompleted +
      qualificationsCompleted +
      documentsCompleted;
    const overallPercentage = Math.round((totalCompleted / totalFields) * 100);

    return {
      overall: overallPercentage,
      sections,
    };
  };

  // Function to get verification status display
  const getVerificationStatusDisplay = () => {
    if (!profile) return null;

    // Since dashboard is only visible after verification, show simple verified status
    return {
      icon: <CheckCircle className="status-icon verified" size={14} />,
      text: "Verified",
      class: "status-verified",
    };
  };

  useEffect(() => {
    if (userId) {
      fetchUserProfileId(userId);
    }
  }, [userId]);

  const fetchUserProfileId = async (userId: string) => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("jobseeker_profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error fetching profile ID:", error);
      } else if (data) {
        setProfileId(data.id);
        // Fetch detailed profile data
        await fetchDetailedProfile(data.id);
      }
    } catch (err) {
      console.error("Error fetching profile ID:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDetailedProfile = async (profileId: string) => {
    try {
      const profileData = await getJobseekerProfile(profileId);
      setProfile(profileData);

      // Calculate completion after profile is loaded
      const completion = calculateProfileCompletion(profileData);
      setProfileCompletion(completion);
    } catch (error) {
      console.error("Error fetching detailed profile:", error);
    }
  };

  // Render loading skeleton instead of null to prevent layout shift
  if (isLoading || !profileId) {
    return (
      <div className="card profile-completion-card">
        <div className="card-header">
          <div className="card-header-content">
            <div className="card-title-section">
              <CheckCircle className="icon" size={20} />
              <h2 className="card-title">Profile Completion</h2>
            </div>
            <div className="verification-status-simple status-verified">
              <CheckCircle className="status-icon verified" size={14} />
              <span className="status-text-simple">Verified</span>
            </div>
          </div>
        </div>

        <div className="profile-completion-content">
          {/* Loading skeleton for overall progress */}
          <div className="overall-progress">
            <div className="progress-header">
              <div className="skeleton-text" style={{ width: "120px", height: "14px" }}></div>
              <div className="skeleton-text" style={{ width: "40px", height: "14px" }}></div>
            </div>
            <div className="progress-bar">
              <div className="skeleton-progress-fill"></div>
            </div>
            <div className="skeleton-text" style={{ width: "280px", height: "14px", margin: "0 auto" }}></div>
          </div>

          {/* Loading skeleton for sections */}
          <div className="sections-breakdown">
            <div className="skeleton-text" style={{ width: "140px", height: "16px", marginBottom: "var(--spacing-5)" }}></div>
            <div className="sections-list">
              {[1, 2, 3, 4].map((index) => (
                <div key={index} className="section-item">
                  <div className="section-header">
                    <div className="section-info">
                      <div className="skeleton-icon"></div>
                      <div className="skeleton-text" style={{ width: "100px", height: "14px" }}></div>
                    </div>
                    <div className="section-stats">
                      <div className="skeleton-text" style={{ width: "30px", height: "14px" }}></div>
                      <div className="skeleton-text" style={{ width: "35px", height: "14px" }}></div>
                    </div>
                  </div>
                  <div className="section-progress-bar">
                    <div className="skeleton-progress-fill"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const verificationStatus = getVerificationStatusDisplay();

  return (
    <div className="card profile-completion-card">
      <div className="card-header">
        <div className="card-header-content">
          <div className="card-title-section">
            <CheckCircle className="icon" size={20} />
            <h2 className="card-title">Profile Completion</h2>
          </div>
          {/* Verification Status - Simple verified nudge */}
          {verificationStatus && (
            <div
              className={`verification-status-simple ${verificationStatus.class}`}
            >
              {verificationStatus.icon}
              <span className="status-text-simple">
                {verificationStatus.text}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="profile-completion-content">
        {/* Overall Progress Bar */}
        {profileCompletion && (
          <div className="overall-progress">
            <div className="progress-header">
              <span className="progress-label">Overall Progress</span>
              <span className="progress-percentage">
                {profileCompletion.overall}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${profileCompletion.overall}%` }}
              ></div>
            </div>
            <p className="progress-text">
              {profileCompletion.overall < 100
                ? `Complete your profile to increase visibility to employers`
                : `Your profile is complete!`}
            </p>
          </div>
        )}

        {/* Section Breakdown */}
        {profileCompletion && (
          <div className="sections-breakdown">
            <h3 className="sections-title">Section Progress</h3>
            <div className="sections-list">
              {profileCompletion.sections.map((section, index) => (
                <div key={index} className="section-item">
                  <div className="section-header">
                    <div className="section-info">
                      {section.icon}
                      <span className="section-name">{section.name}</span>
                    </div>
                    <div className="section-stats">
                      <span className="section-completion">
                        {section.completed}/{section.total}
                      </span>
                      <span className="section-percentage">
                        {section.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="section-progress-bar">
                    <div
                      className="section-progress-fill"
                      style={{ width: `${section.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
