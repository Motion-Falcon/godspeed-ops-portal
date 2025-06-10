import { X } from "lucide-react";
import "../../styles/components/training/VideoModal.css";

interface VideoModalProps {
  isOpen: boolean;
  videoId: string;
  title: string;
  onClose: () => void;
}

export function VideoModal({ isOpen, videoId, title, onClose }: VideoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="video-modal-overlay" onClick={onClose}>
      <div className="video-modal" onClick={(e) => e.stopPropagation()}>
        <div className="video-modal-header">
          <h2 className="video-modal-title">{title}</h2>
          <button 
            className="video-modal-close"
            onClick={onClose}
            aria-label="Close video"
          >
            <X size={24} />
          </button>
        </div>
        <div className="video-container">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
            title={title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="video-iframe"
          ></iframe>
        </div>
      </div>
    </div>
  );
} 