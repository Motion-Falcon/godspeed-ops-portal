import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { BookOpen, FileText, Video, Award, ChevronRight, ArrowLeft, Search } from "lucide-react";
import "../styles/pages/TrainingModules.css";
import "../styles/pages/JobSeekerManagement.css";

interface Module {
  id: string;
  title: string;
  description: string;
  type: "document" | "video" | "interactive";
  duration: string;
  completed?: boolean;
  icon: JSX.Element;
}

export function TrainingModules() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sample training modules data
  // In a real application, this would come from an API
  const trainingModules: Module[] = [
    {
      id: "tm-001",
      title: "Godspeed Platform Orientation",
      description: "Introduction to the Godspeed recruiting platform and its features",
      type: "video",
      duration: "25 min",
      completed: true,
      icon: <Video className="module-icon video" />
    },
    {
      id: "tm-002",
      title: "Effective Resume Screening",
      description: "Best practices for efficiently screening resumes and identifying top candidates",
      type: "document",
      duration: "15 min",
      completed: false,
      icon: <FileText className="module-icon document" />
    },
    {
      id: "tm-003",
      title: "Interview Techniques",
      description: "Advanced interviewing techniques for accurate candidate assessment",
      type: "interactive",
      duration: "45 min",
      completed: false,
      icon: <BookOpen className="module-icon interactive" />
    },
    {
      id: "tm-004",
      title: "Client Management Essentials",
      description: "Essential strategies for managing client relationships effectively",
      type: "document",
      duration: "20 min",
      completed: false,
      icon: <FileText className="module-icon document" />
    },
    {
      id: "tm-005",
      title: "Diversity & Inclusion in Hiring",
      description: "Best practices for promoting diversity and inclusion in the hiring process",
      type: "video",
      duration: "35 min",
      completed: true,
      icon: <Video className="module-icon video" />
    },
    {
      id: "tm-006",
      title: "Job Seeker Resume Building",
      description: "Tips and techniques for creating an effective resume that stands out",
      type: "interactive",
      duration: "30 min",
      completed: false,
      icon: <BookOpen className="module-icon interactive" />
    }
  ];

  // Filter modules based on selected category and search query
  const filteredModules = trainingModules.filter(module => {
    const matchesCategory = 
      selectedCategory === "all" || 
      selectedCategory === module.type || 
      (selectedCategory === "completed" && module.completed) ||
      (selectedCategory === "incomplete" && !module.completed);
    
    const matchesSearch = 
      module.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  const handleModuleClick = (moduleId: string) => {
    // In a real application, this would navigate to the specific module
    console.log(`Opening module: ${moduleId}`);
    // navigate(`/training-modules/${moduleId}`);
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
            <button 
              className={`filter-button ${selectedCategory === 'completed' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('completed')}
            >
              Completed
            </button>
            <button 
              className={`filter-button ${selectedCategory === 'incomplete' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('incomplete')}
            >
              Incomplete
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
                className={`module-card ${module.completed ? 'completed' : ''}`}
                onClick={() => handleModuleClick(module.id)}
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
                </div>
                <h3 className="module-title">{module.title}</h3>
                <p className="module-description">{module.description}</p>
                <div className="module-footer">
                  <span className="module-duration">{module.duration}</span>
                  <ChevronRight size={16} className="arrow-icon" />
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
    </div>
  );
} 