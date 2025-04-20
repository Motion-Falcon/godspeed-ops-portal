import { XCircle } from 'lucide-react';
import '../styles/components/ConfirmationModal.css';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  confirmButtonClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText,
  cancelText = 'Cancel',
  confirmButtonClass = 'danger',
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="confirmation-modal">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="close-button" onClick={onCancel}>
            <XCircle size={20} />
          </button>
        </div>
        <div className="modal-content">
          <p className="modal-message">{message}</p>
        </div>
        <div className="modal-actions">
          <button 
            className="button ghost" 
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`button ${confirmButtonClass}`} 
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
} 