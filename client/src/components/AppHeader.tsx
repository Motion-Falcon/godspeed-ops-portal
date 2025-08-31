import { ReactNode, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, ChevronDown, RefreshCcw } from 'lucide-react';
import godspeedLogo from '../assets/logos/hdgroup-logo-with-bg.png';
import godspeedIconLogo from '../assets/logos/godspped-logo.png';
import canHireIconLogo from '../assets/logos/canhire-logo.png';
import allStaffIconLogo from '../assets/logos/allstaff-logo.png';
import hdGroupIconLogo from '../assets/logos/hdgroup-logo.png';
import { HamburgerMenu } from './HamburgerMenu';
import { useLanguage } from '../contexts/language/language-provider';
import '../styles/components/header.css';

// Company data
const companies = [
  { name: 'CanHire Ops', logo: canHireIconLogo, url: 'https://app.canhiresolutions.ca' },
  { name: 'All Staff Inc. Ops', logo: allStaffIconLogo, url: 'https://app.allstaff.ca' },
  { name: 'Godspeed Ops', logo: godspeedIconLogo, url: 'https://app.godspeedxp.com' }
];

interface AppHeaderProps {
  title: string;
  actions?: ReactNode;
  statusMessage?: string | null;
  statusType?: 'success' | 'error' | 'pending';
  hideHamburgerMenu?: boolean;
  showCompanySwitcher?: boolean;
}

export function AppHeader({
  title,
  actions,
  statusMessage,
  statusType = 'success',
  hideHamburgerMenu = false,
  showCompanySwitcher = false
}: AppHeaderProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStatusMessage, setShowStatusMessage] = useState(false);
  const [companySwitcherOpen, setCompanySwitcherOpen] = useState(false);
  const menuOpenRef = useRef(true); // Keep track of menu state with a ref as well
  const isInitialMount = useRef(true);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const companySwitcherRef = useRef<HTMLDivElement>(null);

  // Scroll to top when component mounts (page loads)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Handle click outside for company switcher
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (companySwitcherRef.current && !companySwitcherRef.current.contains(event.target as Node)) {
        setCompanySwitcherOpen(false);
      }
    };

    if (companySwitcherOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [companySwitcherOpen]);

  // Handle status message visibility and timeout
  useEffect(() => {
    if (statusMessage) {
      setShowStatusMessage(true);
      
      // Clear existing timeout if any
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      
      // Set timeout to hide message after 3 seconds
      statusTimeoutRef.current = setTimeout(() => {
        setShowStatusMessage(false);
      }, 6000);
    } else {
      setShowStatusMessage(false);
      // Clear timeout if statusMessage becomes null/undefined
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    }

    // Cleanup timeout on unmount
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, [statusMessage]);
  
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

  const handleRefreshPage = () => {
    window.location.reload();
  };

  const handleCompanySelect = (url: string) => {
    setCompanySwitcherOpen(false);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="header-wrapper">
      <header className={`common-header ${hideHamburgerMenu ? "hide-hamburger-menu" : ""}`}>
        <div className="header-main">
          <div className="header-left">
            <div className="logo-container" onClick={() => navigate('/')}>
              <img src={godspeedLogo} alt={t('common.godspeedLogo')} className="header-logo" />
            </div>
          </div>
          <div className="header-actions">
            {showCompanySwitcher && (
              <div className="portal-switcher" ref={companySwitcherRef}>
                <button
                  className="portal-switcher-trigger"
                  onClick={() => setCompanySwitcherOpen(!companySwitcherOpen)}
                  aria-expanded={companySwitcherOpen}
                  aria-haspopup="listbox"
                >
                  <div className="trigger-content">
                    <div className="current-portal">
                      <img 
                        src={hdGroupIconLogo} 
                        alt="HD Group Logo"
                        className="portal-logo"
                      />
                      <div className="portal-info">
                        <span className="portal-label">Portal</span>
                        <span className="portal-name">HD Group Ops</span>
                      </div>
                    </div>
                    <div className="switcher-actions">
                      <RefreshCcw size={14} className="refresh-icon" />
                      <ChevronDown 
                        size={14} 
                        className={`chevron ${companySwitcherOpen ? 'rotated' : ''}`}
                      />
                    </div>
                  </div>
                </button>
                
                {companySwitcherOpen && (
                  <div className="portal-switcher-dropdown">
                    <div className="dropdown-header">
                      <span>Switch to another portal</span>
                    </div>
                    <div className="portal-options">
                      {companies.map((company, index) => (
                        <button
                          key={index}
                          className="portal-option"
                          onClick={() => handleCompanySelect(company.url)}
                        >
                          <div className="option-content">
                            <img 
                              src={company.logo} 
                              alt={company.name}
                              className="portal-logo"
                            />
                            <div className="option-info">
                              <span className="option-name">{company.name}</span>
                              <span className="option-desc">Operations Portal</span>
                            </div>
                          </div>
                          <RefreshCcw size={12} className="option-action" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {actions}
          </div>
        </div>
        
        {statusMessage && showStatusMessage && (
          <div className="status-update-container">
            <span className={`status-update-message ${statusType}`}>{statusMessage}</span>
            {statusType === 'error' && (
              <button 
                className="refresh-page-btn"
                onClick={handleRefreshPage}
                title={t('common.refreshPage')}
              >
                <RotateCcw size={16} />
                {t('common.refresh')}
              </button>
            )}
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