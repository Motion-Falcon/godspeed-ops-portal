import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Clock, RotateCcw } from 'lucide-react';
import '../styles/components/toast.css';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'pending';
  isVisible: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  duration?: number;
}

export function Toast({
  message,
  type,
  isVisible,
  onClose,
  onRefresh,
  duration = 6000
}: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} />;
      case 'error':
        return <AlertCircle size={20} />;
      case 'pending':
        return <Clock size={20} />;
      default:
        return null;
    }
  };

  return (
    <div className={`toast toast-${type} ${isVisible ? 'toast-visible' : ''}`}>
      <div className="toast-content">
        <div className="toast-icon">{getIcon()}</div>
        <div className="toast-message">{message}</div>
        {type === 'error' && onRefresh && (
          <button
            className="toast-refresh-btn"
            onClick={onRefresh}
            title="Refresh page"
            aria-label="Refresh page"
          >
            <RotateCcw size={16} />
          </button>
        )}
        <button
          className="toast-close-btn"
          onClick={onClose}
          aria-label="Close notification"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
