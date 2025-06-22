import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import { BookOpen, FileText, Video, Award, ChevronRight, ArrowLeft, Search, Play, Clock } from "lucide-react";
import { VideoModal } from "./VideoModal";
import { ComingSoonModal } from "./ComingSoonModal";
import "../../styles/pages/TrainingModules.css";
import "../../styles/pages/JobSeekerManagement.css";

interface Module {
  id: string;
  title: string;
  description: string;
  type: "document" | "video" | "interactive";
  duration: string;
  completed?: boolean;
  icon: JSX.Element;
  youtubeId?: string;
  comingSoon?: boolean;
}

export function TrainingModules() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isVideoModalOpen, setIsVideoModalOpen] = useState<boolean>(false);
  const [currentVideoId, setCurrentVideoId] = useState<string>("");
  const [currentVideoTitle, setCurrentVideoTitle] = useState<string>("");
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState<boolean>(false);
  const [currentComingSoonModule, setCurrentComingSoonModule] = useState<Module | null>(null);

  // Sample training modules data - Videos moved first
  // In a real application, this would come from an API
  const trainingModules: Module[] = [
    {
      id: "tm-007",
      title: "WHMIS Training",
      description: "Workplace Hazardous Materials Information System training for safe handling of hazardous materials",
      type: "video",
      duration: "5 min",
      completed: false,
      icon: <Video className="module-icon video" />,
      youtubeId: "IZY5r7_f6eE"
    },
    {
      id: "tm-008",
      title: "Health & Safety Training",
      description: "Comprehensive workplace health and safety protocols to ensure a safe working environment",
      type: "video",
      duration: "6 min",
      completed: false,
      icon: <Video className="module-icon video" />,
      youtubeId: "mzKdX6NeRGo"
    },
    {
      id: "tm-002",
      title: "Effective Resume Screening",
      description: "Best practices for efficiently screening resumes and identifying top candidates",
      type: "document",
      duration: "15 min",
      completed: false,
      icon: <FileText className="module-icon document" />,
      comingSoon: true
    },
    {
      id: "tm-003",
      title: "Interview Techniques",
      description: "Advanced interviewing techniques for accurate candidate assessment",
      type: "interactive",
      duration: "45 min",
      completed: false,
      icon: <BookOpen className="module-icon interactive" />,
      comingSoon: true
    },
    {
      id: "tm-004",
      title: "Client Management Essentials",
      description: "Essential strategies for managing client relationships effectively",
      type: "document",
      duration: "20 min",
      completed: false,
      icon: <FileText className="module-icon document" />,
      comingSoon: true
    },
    {
      id: "tm-006",
      title: "Job Seeker Resume Building",
      description: "Tips and techniques for creating an effective resume that stands out",
      type: "interactive",
      duration: "30 min",
      completed: false,
      icon: <BookOpen className="module-icon interactive" />,
      comingSoon: true
    }
  ];

  // Filter modules based on selected category and search query
  const filteredModules = trainingModules.filter(module => {
    const matchesCategory = 
      selectedCategory === "all" || 
      selectedCategory === module.type;
    
    const matchesSearch = 
      module.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  const handleModuleClick = (module: Module) => {
    if (module.comingSoon) {
      // Open coming soon modal
      setCurrentComingSoonModule(module);
      setIsComingSoonModalOpen(true);
    } else if (module.youtubeId) {
      // Open YouTube video in modal
      setCurrentVideoId(module.youtubeId);
      setCurrentVideoTitle(module.title);
      setIsVideoModalOpen(true);
    } else {
      // Handle other module types
      console.log(`Opening module: ${module.id}`);
      // navigate(`/training-modules/${module.id}`);
    }
  };

  const closeVideoModal = () => {
    setIsVideoModalOpen(false);
    setCurrentVideoId("");
    setCurrentVideoTitle("");
  };

  const closeComingSoonModal = () => {
    setIsComingSoonModalOpen(false);
    setCurrentComingSoonModule(null);
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <AppHeader 
        title="Training Modules" 
        actions={
          <>
            <button
              className="button button-icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={16} className="icon" /> Back
            </button>
          </>
        }
      />

      {/* Main content */}
      <main className="training-modules-main">
        <div className="dashboard-heading">
          <h1 className="dashboard-title">Training & Development</h1>
          <div className="user-role-badge">
            <Award className="role-icon" />
            <span>Learning Portal</span>
          </div>
        </div>
        <p className="dashboard-subtitle">
          Enhance your skills with our curated training resources
        </p>

        {/* Filters and search */}
        <div className="module-filters">
          <div className="category-filters">
            <button 
              className={`filter-button ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All
            </button>
            <button 
              className={`filter-button ${selectedCategory === 'video' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('video')}
            >
              Videos
            </button>
            <button 
              className={`filter-button ${selectedCategory === 'document' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('document')}
            >
              Documents
            </button>
            <button 
              className={`filter-button ${selectedCategory === 'interactive' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('interactive')}
            >
              Interactive
            </button>
          </div>
          
          <div className="search-box">
          <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search modules..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {/* Module cards */}
        <div className="modules-grid">
          {filteredModules.length > 0 ? (
            filteredModules.map((module) => (
              <div 
                key={module.id} 
                className={`module-card ${module.completed ? 'completed' : ''} ${module.youtubeId ? 'video-module' : ''} ${module.comingSoon ? 'coming-soon-module' : ''}`}
                onClick={() => handleModuleClick(module)}
              >
                <div className="module-card-header">
                  {module.icon}
                  <span className="module-type">{module.type}</span>
                  {module.completed && (
                    <span className="completion-badge">
                      <Award size={14} />
                      Completed
                    </span>
                  )}
                  {module.comingSoon && (
                    <span className="coming-soon-badge">
                      <Clock size={14} />
                      Coming Soon
                    </span>
                  )}
                </div>
                <h3 className="module-title">{module.title}</h3>
                <p className="module-description">{module.description}</p>
                <div className="module-footer">
                  <span className="module-duration">{module.duration}</span>
                  {module.youtubeId ? (
                    <div className="video-play-indicator">
                      <Play size={16} className="play-icon" />
                    </div>
                  ) : module.comingSoon ? (
                    <div className="coming-soon-indicator">
                      <Clock size={16} className="clock-icon" />
                    </div>
                  ) : (
                    <ChevronRight size={16} className="arrow-icon" />
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="no-modules-message">
              <p>No training modules match your search criteria.</p>
              <button 
                className="button outline"
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Video Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        videoId={currentVideoId}
        title={currentVideoTitle}
        onClose={closeVideoModal}
      />

      {/* Coming Soon Modal */}
      <ComingSoonModal
        isOpen={isComingSoonModalOpen}
        module={currentComingSoonModule}
        onClose={closeComingSoonModal}
      />
    </div>
  );
} 