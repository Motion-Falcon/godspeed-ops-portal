import { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../contexts/language/language-provider';
import '../styles/components/demo-login-modal.css';

interface DemoUser {
  id: string;
  email: string;
  userType: 'admin' | 'recruiter' | 'jobseeker';
  name: string;
}

interface DemoLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: DemoUser) => void;
  isLoading: boolean;
}

const DEMO_USERS: DemoUser[] = [
  {
    id: '8cfe69ea-7d7b-4892-b6fc-1db2d9e9e7cf',
    email: 'admin@email.com',
    userType: 'admin',
    name: 'Admin User'
  },
  {
    id: '39e77231-c23f-46ec-b03c-4d3ff0af8115',
    email: 'recruiter@email.com',
    userType: 'recruiter',
    name: 'Recruiter User'
  },
  {
    id: '589d46ea-9113-46d6-b5d7-1fb702bbe658',
    email: 'jobseeker@email.com',
    userType: 'jobseeker',
    name: 'Jobseeker User'
  }
];

export function DemoLoginModal({ isOpen, onClose, onSelectUser, isLoading }: DemoLoginModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const getUserTypeLabel = (userType: string) => {
    switch (userType) {
      case 'admin':
        return t('roles.admin');
      case 'recruiter':
        return t('roles.recruiter');
      case 'jobseeker':
        return t('roles.jobseeker');
      default:
        return userType;
    }
  };

  return (
    <div className="demo-modal-overlay" onClick={onClose}>
      <div className="demo-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="demo-modal-header">
          <h2 className="demo-modal-title">{t('demoLogin.title')}</h2>
          <button
            type="button"
            className="demo-modal-close"
            onClick={onClose}
            disabled={isLoading}
            aria-label={t('buttons.close')}
          >
            <X size={20} />
          </button>
        </div>

        <p className="demo-modal-description">
          {t('demoLogin.description')}
        </p>

        <div className="demo-user-list">
          {DEMO_USERS.map((user) => (
            <button
              key={user.id}
              type="button"
              className="demo-user-card"
              onClick={() => onSelectUser(user)}
              disabled={isLoading}
            >
              <div className="demo-user-info">
                <div className="demo-user-name">{user.name}</div>
                <div className="demo-user-email">{user.email}</div>
              </div>
              <div className="demo-user-type">
                {getUserTypeLabel(user.userType)}
              </div>
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="demo-modal-loading">
            <span className="loading-spinner"></span>
            <span>{t('demoLogin.loggingIn')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

