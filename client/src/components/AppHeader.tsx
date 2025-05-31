import { ReactNode, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import godspeedLogo from '../assets/logos/godspped-logo-fulllength.png';
import { HamburgerMenu } from './HamburgerMenu';
import '../styles/components/header.css';

interface AppHeaderProps {
  title: string;
  actions?: ReactNode;
  statusMessage?: string | null;
  statusType?: 'success' | 'error' | 'pending';
  hideHamburgerMenu?: boolean;
}

export function AppHeader({
  title,
  actions,
  statusMessage,
  statusType = 'success',
  hideHamburgerMenu = false
}: AppHeaderProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(true); // Keep track of menu state with a ref as well
  const isInitialMount = useRef(true);
  
  // Log state changes for debugging
  useEffect(() => {
    console.log('Menu state changed:', menuOpen);
    menuOpenRef.current = menuOpen;
    
    // Skip checking on initial render
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
  }, [menuOpen]);

  // Use a stable handler that doesn't capture stale state
  const toggleMenu = () => {
    console.log('Toggle clicked, current state:', menuOpenRef.current);
    setMenuOpen(prevState => {
      const newState = !prevState;
      console.log('Setting menu state to:', newState);
      return newState;
    });
  };

  const closeMenu = () => {
    console.log('Close menu called');
    // Only close if we're not in the initial render
    if (!isInitialMount.current) {
      setMenuOpen(false);
    } else {
      console.log('Ignoring close menu call during initial render');
    }
  };

  return (
    <div className="header-wrapper">
      <header className="common-header">
        <div className="header-main">
          <div className="header-left">
            <div className="logo-container" onClick={() => navigate('/')}>
              <img src={godspeedLogo} alt="Godspeed Logo" className="header-logo" />
            </div>
          </div>
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
      <div className="page-title-container">
        <h1 className="page-title">{title}</h1>
      </div>
      
      {/* Render the hamburger menu outside of the header for proper positioning */}
      {!hideHamburgerMenu && (
        <HamburgerMenu isOpen={menuOpen} onClose={closeMenu} onOpen={toggleMenu}/>
      )}
    </div>
  );
} 