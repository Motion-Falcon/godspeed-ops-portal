import { X, Clock, BookOpen } from "lucide-react";
import "../../styles/components/training/ComingSoonModal.css";

interface Module {
  id: string;
  title: string;
  description: string;
  type: "document" | "video" | "interactive";
  duration: string;
  icon: JSX.Element;
}

interface ComingSoonModalProps {
  isOpen: boolean;
  module: Module | null;
  onClose: () => void;
}

export function ComingSoonModal({ isOpen, module, onClose }: ComingSoonModalProps) {
  if (!isOpen || !module) return null;

  const getModuleFeatures = () => {
    // Mock features based on module type
    const features = {
      document: [
        "Interactive PDF with annotations",
        "Progress tracking",
        "Downloadable resources",
        "Quick reference guide"
      ],
      interactive: [
        "Hands-on exercises",
        "Real-time feedback",
        "Practice scenarios", 
        "Certificate upon completion"
      ]
    };
    return features[module.type as keyof typeof features] || [];
  };

  return (
    <div className="coming-soon-modal-overlay" onClick={onClose}>
      <div className="coming-soon-modal" onClick={(e) => e.stopPropagation()}>
        <div className="coming-soon-modal-header">
          <div className="coming-soon-header-content">
            <div className="coming-soon-icon">
              <Clock size={32} />
            </div>
            <div>
              <h2 className="coming-soon-modal-title">{module.title}</h2>
              <p className="coming-soon-modal-subtitle">Coming Soon</p>
            </div>
          </div>
          <button 
            className="coming-soon-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="coming-soon-modal-content">
          <div className="coming-soon-description">
            <p>{module.description}</p>
          </div>

          <div className="coming-soon-details">
            
            <div className="coming-soon-detail-item">
              <BookOpen size={20} />
              <div>
                <h4>Duration</h4>
                <p>{module.duration}</p>
              </div>
            </div>
          </div>

          <div className="coming-soon-features">
            <h4>What to Expect</h4>
            <ul>
              {getModuleFeatures().map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="coming-soon-modal-footer">
          <p>We'll notify you when this module becomes available!</p>
        </div>
      </div>
    </div>
  );
} 