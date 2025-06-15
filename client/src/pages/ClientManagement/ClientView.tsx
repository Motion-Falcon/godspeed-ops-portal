import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building, Edit } from 'lucide-react';
import { getClient, ClientData } from '../../services/api/client';
import { AppHeader } from '../../components/AppHeader';
import '../../styles/pages/ClientView.css';
import '../../styles/components/header.css';

// Interface that can handle both camelCase and snake_case properties
interface ExtendedClientData extends ClientData {
  company_name?: string;
  contact_person_name1?: string;
  work_province?: string;
  [key: string]: unknown; // Allow string indexing for dynamic access
}

export function ClientView() {
  const [client, setClient] = useState<ExtendedClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Helper function to convert snake_case keys to camelCase
  const convertToCamelCase = (data: ClientData): ExtendedClientData => {
    if (!data) return {} as ExtendedClientData;
    
    const result: ExtendedClientData = { ...data as unknown as ExtendedClientData };
    
    // Keep both versions of keys to ensure we can access data regardless of format
    Object.entries(data).forEach(([key, value]) => {
      if (key.includes('_')) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelKey] = value;
      }
    });
    
    return result;
  };

  // Helper function to get a value regardless of key format
  const getFieldValue = (obj: ExtendedClientData | null, camelCaseKey: string): string | number | boolean | null | undefined => {
    if (!obj) return null;
    
    // Try camelCase first
    if (obj[camelCaseKey] !== undefined) {
      return obj[camelCaseKey] as string | number | boolean | null | undefined;
    }
    
    // Try snake_case
    const snakeCaseKey = camelCaseKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    return obj[snakeCaseKey] !== undefined ? obj[snakeCaseKey] as string | number | boolean | null | undefined : null;
  };

  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        if (!id) throw new Error("Client ID is missing");
        const data = await getClient(id);
        setClient(convertToCamelCase(data));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching the client');
        console.error('Error fetching client:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchClient();
    }
  }, [id]);

  const handleEditClient = () => {
    if (!id) return;
    navigate(`/client-management/edit/${id}`);
  };

  // Format date with type checking
  const formatDate = (dateString?: string | number | boolean | null | undefined) => {
    if (!dateString || typeof dateString !== 'string') return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  const renderDetailItem = (label: string, value?: string | number | boolean | null) => {
    const displayValue = value === null || value === undefined || value === '' 
      ? 'N/A' 
      : typeof value === 'boolean' 
        ? (value ? 'Yes' : 'No') 
        : value;
    
    return (
      <div className="detail-item">
        <p className="detail-label">{label}:</p>
        <p className="detail-value">{displayValue}</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="client-view-container">
        <div className="loading-container">
          <span className="loading-spinner"></span>
          <p>Loading client details...</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="client-view-container">
        <div className="error-container">
          <p className="error-message">{error || 'Failed to load client'}</p>
          <div className="error-actions">
            <button 
              className="button " 
              onClick={() => navigate('/client-management')}
            >
              Back to Clients
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

  const companyName = getFieldValue(client, 'companyName') || 'Unnamed Client';

  return (
    <div className="client-view-container">
      <AppHeader
        title={typeof companyName === 'string' ? companyName : 'Client Details'}
        actions={
          <>
            <button 
              className="button" 
              onClick={() => navigate('/client-management')}
            >
              <ArrowLeft size={16} />
              <span>Back to Clients</span>
            </button>
            <button 
              className="button primary"
              onClick={handleEditClient}
            >
              <Edit size={16} />
              Edit Client
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
              <Building size={40} />
            </div>
            <div className="client-info-header">
              <h1 className="client-name">{companyName}</h1>
              {renderDetailItem('Billing Name', getFieldValue(client, 'billingName'))}
              {renderDetailItem('Short Code', getFieldValue(client, 'shortCode'))}
              {renderDetailItem('Created', formatDate(getFieldValue(client, 'createdAt')))}
              {renderDetailItem('Last Updated', formatDate(getFieldValue(client, 'updatedAt') || getFieldValue(client, 'lastUpdated')))}
            </div>
          </div>
        </div>
        
        <div className="profile-content grid-container">
          <div className="personal-details-section section-card">
            <h2 className="section-title">Company Information</h2>
            <div className="detail-group">
              {renderDetailItem('Company Name', getFieldValue(client, 'companyName'))}
              {renderDetailItem('Billing Name', getFieldValue(client, 'billingName'))}
              {renderDetailItem('Short Code', getFieldValue(client, 'shortCode'))}
              {renderDetailItem('List Name', getFieldValue(client, 'listName'))}
              {renderDetailItem('Website', getFieldValue(client, 'website'))}
              {renderDetailItem('Client Manager', getFieldValue(client, 'clientManager'))}
              {renderDetailItem('Sales Person', getFieldValue(client, 'salesPerson'))}
              {renderDetailItem('Accounting Person', getFieldValue(client, 'accountingPerson'))}
              {renderDetailItem('Merge Invoice', getFieldValue(client, 'mergeInvoice'))}
              {renderDetailItem('Currency', getFieldValue(client, 'currency'))}
              {renderDetailItem('Work Province', getFieldValue(client, 'workProvince'))}
            </div>
          </div>
          
          <div className="contact-section section-card">
            <h2 className="section-title">Primary Contact</h2>
            <div className="detail-group">
              {renderDetailItem('Contact Person', getFieldValue(client, 'contactPersonName1'))}
              {renderDetailItem('Email Address', getFieldValue(client, 'emailAddress1'))}
              {renderDetailItem('Mobile', getFieldValue(client, 'mobile1'))}
              {renderDetailItem('Address', getFieldValue(client, 'streetAddress1'))}
              {renderDetailItem('City', getFieldValue(client, 'city1'))}
              {renderDetailItem('Province', getFieldValue(client, 'province1'))}
              {renderDetailItem('Postal Code', getFieldValue(client, 'postalCode1'))}
            </div>
          </div>
          
          <div className="contact-section section-card">
            <h2 className="section-title">Secondary Contact</h2>
            <div className="detail-group">
              {renderDetailItem('Contact Person', getFieldValue(client, 'contactPersonName2'))}
              {renderDetailItem('Email Address', getFieldValue(client, 'emailAddress2'))}
              {renderDetailItem('Mobile', getFieldValue(client, 'mobile2'))}
              {renderDetailItem('CC on Invoices', getFieldValue(client, 'invoiceCC2'))}
              {renderDetailItem('Address', getFieldValue(client, 'streetAddress2'))}
              {renderDetailItem('City', getFieldValue(client, 'city2'))}
              {renderDetailItem('Province', getFieldValue(client, 'province2'))}
              {renderDetailItem('Postal Code', getFieldValue(client, 'postalCode2'))}
            </div>
          </div>
          
          <div className="contact-section section-card">
            <h2 className="section-title">Tertiary Contact</h2>
            <div className="detail-group">
              {renderDetailItem('Contact Person', getFieldValue(client, 'contactPersonName3'))}
              {renderDetailItem('Email Address', getFieldValue(client, 'emailAddress3'))}
              {renderDetailItem('Mobile', getFieldValue(client, 'mobile3'))}
              {renderDetailItem('CC on Invoices', getFieldValue(client, 'invoiceCC3'))}
              {renderDetailItem('Address', getFieldValue(client, 'streetAddress3'))}
              {renderDetailItem('City', getFieldValue(client, 'city3'))}
              {renderDetailItem('Province', getFieldValue(client, 'province3'))}
              {renderDetailItem('Postal Code', getFieldValue(client, 'postalCode3'))}
            </div>
          </div>
          
          <div className="department-section section-card">
            <h2 className="section-title">Department Information</h2>
            <div className="detail-group">
              {renderDetailItem('Dispatch Department Email', getFieldValue(client, 'dispatchDeptEmail'))}
              {renderDetailItem('CC Dispatch on Invoices', getFieldValue(client, 'invoiceCCDispatch'))}
              {renderDetailItem('Accounts Department Email', getFieldValue(client, 'accountsDeptEmail'))}
              {renderDetailItem('CC Accounts on Invoices', getFieldValue(client, 'invoiceCCAccounts'))}
              {renderDetailItem('Invoice Language', getFieldValue(client, 'invoiceLanguage'))}
            </div>
          </div>
          
          <div className="payment-section section-card">
            <h2 className="section-title">Payment & Billing</h2>
            <div className="detail-group">
              {renderDetailItem('Preferred Payment Method', getFieldValue(client, 'preferredPaymentMethod'))}
              {renderDetailItem('Terms', getFieldValue(client, 'terms'))}
              {renderDetailItem('Pay Cycle', getFieldValue(client, 'payCycle'))}
              {renderDetailItem('Credit Limit', getFieldValue(client, 'creditLimit'))}
              {renderDetailItem('Notes', getFieldValue(client, 'notes'))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 