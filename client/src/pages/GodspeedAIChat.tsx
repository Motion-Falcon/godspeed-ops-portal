import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { IframeViewer } from '../components/IframeViewer';
import '../styles/pages/GodspeedAIChat.css';

export function GodspeedAIChat() {
  const { user, isAdmin, isRecruiter, isJobSeeker } = useAuth();
  const navigate = useNavigate();

  // Define the external AI chat URL - you can change this to your desired URL
  const AI_CHAT_URL = 'https://godspeed-ops-ai-mhbl.onrender.com/';
  
  // Define which user types can access the AI chat
  const ALLOWED_USER_TYPES: ('admin' | 'recruiter' | 'jobseeker')[] = ['admin'];
  
  // Get current user type
  const getCurrentUserType = (): 'admin' | 'recruiter' | 'jobseeker' | undefined => {
    if (isAdmin) return 'admin';
    if (isRecruiter) return 'recruiter';
    if (isJobSeeker) return 'jobseeker';
    return undefined;
  };

  const currentUserType = getCurrentUserType();

  // Handle access denied - redirect to dashboard
  const handleAccessDenied = () => {
    navigate('/dashboard');
  };

  // Check if user has access
  const hasAccess = ALLOWED_USER_TYPES.includes(currentUserType as 'admin');

  // Redirect to dashboard if no access
  useEffect(() => {
    if (user && !hasAccess) {
      navigate('/dashboard');
    }
  }, [user, hasAccess, navigate]);

  return (
    <div className="godspeed-ai-chat-container">
      <AppHeader 
        title="Godspeed AI Chat" 
        hideHamburgerMenu={false}
      />
      
      <main className="ai-chat-main">
        <div className="ai-chat-content">
          <IframeViewer
            url={AI_CHAT_URL}
            title="Godspeed AI Chat"
            allowedUserTypes={ALLOWED_USER_TYPES}
            currentUserType={currentUserType}
            onAccessDenied={handleAccessDenied}
          />
        </div>
      </main>
    </div>
  );
} 