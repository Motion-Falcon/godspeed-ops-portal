import { ReactNode } from 'react';
import godspeedLogo from '../assets/logos/godspped-logo-fulllength.png';
import '../styles/components/header.css';

interface AppHeaderProps {
  title: string;
  actions?: ReactNode;
  statusMessage?: string | null;
  statusType?: 'success' | 'error' | 'pending';
}

export function AppHeader({
  title,
  actions,
  statusMessage,
  statusType = 'success'
}: AppHeaderProps) {
  return (
    <header className="common-header">
      <div className="header-main">
        <div className="header-left">
          <div className="logo-container">
            <img src={godspeedLogo} alt="Godspeed Logo" className="header-logo" />
          </div>
        </div>
        <h1>{title}</h1>
        <div className="header-actions">
          {actions}
        </div>
      </div>
      
      {statusMessage && (
        <div className="status-update-container">
          <span className={`status-update-message ${statusType}`}>{statusMessage}</span>
        </div>
      )}
    </header>
  );
} 