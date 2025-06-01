import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPosition, PositionData, deletePosition } from '../../services/api';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { AppHeader } from '../../components/AppHeader';
import { ArrowLeft, Edit, Trash2, Briefcase } from 'lucide-react';
import '../../styles/pages/ClientView.css';
import '../../styles/pages/PositionManagement.css';
import '../../styles/components/header.css';

interface ExtendedPositionData extends PositionData {
  [key: string]: unknown;
}

export function PositionView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [position, setPosition] = useState<ExtendedPositionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showEditConfirmation, setShowEditConfirmation] = useState(false);

  const convertToCamelCase = (data: Record<string, unknown>): ExtendedPositionData => {
    const converted: Record<string, unknown> = {};
    
    Object.entries(data).forEach(([key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      converted[camelKey] = value;
    });
    
    return converted as ExtendedPositionData;
  };

  useEffect(() => {
    const fetchPosition = async () => {
      if (!id) return;
      
      try {
        const fetchedPosition = await getPosition(id);
        const convertedPosition = convertToCamelCase(fetchedPosition as unknown as Record<string, unknown>);
        setPosition(convertedPosition);
        console.log("Position data loaded:", convertedPosition);
      } catch (err) {
        console.error('Error fetching position:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch position details';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPosition();
  }, [id]);

  const handleNavigateBack = () => {
    navigate('/position-management');
  };

  const confirmEditPosition = () => {
    setShowEditConfirmation(true);
  };

  const confirmDeletePosition = () => {
    setShowDeleteConfirmation(true);
  };

  const handleDeletePosition = async () => {
    if (!id) return;
    
    try {
      await deletePosition(id);
      navigate('/position-management', { 
        state: { message: 'Position deleted successfully' } 
      });
    } catch (err) {
      console.error('Error deleting position:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete position';
      setError(errorMessage);
    }
  };

  // Format date with type checking
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (e) {
      return 'N/A';
    }
  };
  
  // Format date range to show duration
  const formatDateRange = (startDate?: string | null, endDate?: string | null) => {
    if (!startDate) return 'N/A';
    
    const start = new Date(startDate);
    const formattedStart = start.toLocaleDateString();
    
    if (!endDate) return `${formattedStart} (ongoing)`;
    
    const end = new Date(endDate);
    const formattedEnd = end.toLocaleDateString();
    
    // Calculate duration in days
    const durationMs = end.getTime() - start.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    
    return `${formattedStart} to ${formattedEnd} (${durationDays} days)`;
  };

  const renderDetailItem = (label: string, value?: string | number | boolean | null | object) => {
    let displayValue;
    
    if (value === null || value === undefined || value === '') {
      displayValue = 'N/A';
    } else if (typeof value === 'boolean') {
      displayValue = value ? 'Yes' : 'No';
    } else if (typeof value === 'object') {
      // Handle documents required object
      if (label === 'Documents Required' && value) {
        const documents = Object.entries(value)
          .filter(([, isRequired]) => isRequired)
          .map(([doc]) => formatDocumentName(doc))
          .join(', ');
        displayValue = documents || 'None';
      } else {
        displayValue = JSON.stringify(value);
      }
    } else {
      displayValue = value;
    }
    
    return (
      <div className="detail-item">
        <p className="detail-label">{label}:</p>
        <p className="detail-value">{displayValue}</p>
      </div>
    );
  };

  // Format document names for better display
  const formatDocumentName = (docKey: string) => {
    // Convert camelCase to space-separated words
    return docKey
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  if (loading) {
    return (
      <div className="client-view-container">
        <div className="loading-container">
          <span className="loading-spinner"></span>
          <p>Loading position details...</p>
        </div>
      </div>
    );
  }

  if (error || !position) {
    return (
      <div className="client-view-container">
        <div className="error-container">
          <p className="error-message">{error || 'Failed to load position'}</p>
          <div className="error-actions">
            <button 
              className="button " 
              onClick={handleNavigateBack}
            >
              Back to Positions
            </button>
            <button 
              className="button primary" 
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const positionTitle = position.title || 'Unnamed Position';

  return (
    <div className="client-view-container">
      <AppHeader
        title={positionTitle || 'Position Details'}
        actions={
          <>
            <button 
              className="button" 
              onClick={handleNavigateBack}
            >
              <ArrowLeft size={16} />
              <span>Back to Positions</span>
            </button>
            <button 
              className="button secondary"
              onClick={confirmEditPosition}
            >
              <Edit size={16} />
              Edit
            </button>
            <button 
              className="button danger"
              onClick={confirmDeletePosition}
            >
              <Trash2 size={16} />
              Delete
            </button>
          </>
        }
        statusMessage={error}
        statusType="error"
      />

      <main className="client-main">
        <div className="client-overview section-card">
          <div className="client-banner"></div>
          
          <div className="client-details">
            <div className="client-avatar">
              <Briefcase size={40} />
            </div>
            <div className="client-info-header">
              <h1 className="client-name">{positionTitle}</h1>
              {renderDetailItem('Client', position.clientName)}
              {renderDetailItem('Position Code', position.positionCode)}
              {renderDetailItem('Duration', formatDateRange(position.startDate, position.endDate))}
              {renderDetailItem('Created', formatDate(position.createdAt))}
              {renderDetailItem('Updated', formatDate(position.updatedAt))}
            </div>
          </div>
        </div>
        
        <div className="client-content grid-container">
          <div className="basic-details-section section-card">
            <h2 className="section-title">Basic Details</h2>
            <div className="detail-group">
              {renderDetailItem('Title', position.title)}
              {renderDetailItem('Client', position.clientName)}
              {renderDetailItem('Position Code', position.positionCode)}
              {renderDetailItem('Start Date', formatDate(position.startDate))}
              {renderDetailItem('End Date', position.endDate ? formatDate(position.endDate) : 'No end date (ongoing)')}
              {renderDetailItem('Show on Job Portal', position.showOnJobPortal)}
              {renderDetailItem('Client Manager', position.clientManager)}
              {renderDetailItem('Sales Manager', position.salesManager)}
              {renderDetailItem('Position Number', position.positionNumber)}
              {renderDetailItem('Description', position.description)}
            </div>
          </div>
          
          <div className="address-section section-card">
            <h2 className="section-title">Address Details</h2>
            <div className="detail-group">
              {renderDetailItem('Street Address', position.streetAddress)}
              {renderDetailItem('City', position.city)}
              {renderDetailItem('Province', position.province)}
              {renderDetailItem('Postal Code', position.postalCode)}
            </div>
          </div>
          
          <div className="employment-section section-card">
            <h2 className="section-title">Employment Categorization</h2>
            <div className="detail-group">
              {renderDetailItem('Employment Term', position.employmentTerm)}
              {renderDetailItem('Employment Type', position.employmentType)}
              {renderDetailItem('Position Category', position.positionCategory)}
              {renderDetailItem('Experience', position.experience)}
            </div>
          </div>
          
          <div className="documents-section section-card">
            <h2 className="section-title">Documents Required</h2>
            <div className="detail-group">
              {renderDetailItem('Documents Required', position.documentsRequired)}
            </div>
          </div>
          
          <div className="position-details-section section-card">
            <h2 className="section-title">Position Details</h2>
            <div className="detail-group">
              {renderDetailItem('Payrate Type', position.payrateType)}
              {renderDetailItem('Number of Positions', position.numberOfPositions)}
              {renderDetailItem('Regular Pay Rate', position.regularPayRate)}
              {renderDetailItem('Markup', position.markup)}
              {renderDetailItem('Bill Rate', position.billRate)}
            </div>
          </div>
          
          <div className="overtime-section section-card">
            <h2 className="section-title">Overtime</h2>
            <div className="detail-group">
              {renderDetailItem('Overtime Enabled', position.overtimeEnabled)}
              {position.overtimeEnabled && (
                <>
                  {renderDetailItem('Overtime Hours', position.overtimeHours)}
                  {renderDetailItem('Overtime Bill Rate', position.overtimeBillRate)}
                  {renderDetailItem('Overtime Pay Rate', position.overtimePayRate)}
                </>
              )}
            </div>
          </div>
          
          <div className="payment-section section-card">
            <h2 className="section-title">Payment & Billings</h2>
            <div className="detail-group">
              {renderDetailItem('Preferred Payment Method', position.preferredPaymentMethod)}
              {renderDetailItem('Terms', position.terms)}
            </div>
          </div>
          
          <div className="notes-section section-card">
            <h2 className="section-title">Notes</h2>
            <div className="detail-group">
              {renderDetailItem('Notes', position.notes)}
            </div>
          </div>
          
          <div className="tasks-section section-card">
            <h2 className="section-title">Tasks</h2>
            <div className="detail-group">
              {renderDetailItem('Assigned To', position.assignedTo)}
              {renderDetailItem('Project Completion Date', formatDate(position.projCompDate))}
              {renderDetailItem('Task Time', position.taskTime)}
            </div>
          </div>
        </div>
      </main>

      {showDeleteConfirmation && (
        <ConfirmationModal
          isOpen={showDeleteConfirmation}
          title="Delete Position"
          message="Are you sure you want to delete this position? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDeletePosition}
          onCancel={() => setShowDeleteConfirmation(false)}
        />
      )}

      {showEditConfirmation && (
        <ConfirmationModal
          isOpen={showEditConfirmation}
          title="Edit Position"
          message="Are you sure you want to edit this position?"
          confirmText="Edit"
          cancelText="Cancel"
          onConfirm={() => {
            navigate(`/position-management/edit/${id}`);
          }}
          onCancel={() => {
            setShowEditConfirmation(false);
          }}
        />
      )}
    </div>
  );
} 