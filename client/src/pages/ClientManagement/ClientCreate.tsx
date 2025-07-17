import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  saveClientDraft, 
  getClientDraftById, 
  createClient, 
  ClientData, 
  deleteClientDraft,
  getClient,
  updateClient
} from '../../services/api/client';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { AppHeader } from '../../components/AppHeader';
import { ArrowLeft, Save } from 'lucide-react';
import { PAYMENT_METHODS, PAYMENT_TERMS, PAY_CYCLES, CREDIT_LIMITS, LIST_NAMES } from '../../constants/formOptions';
import '../../styles/pages/ClientManagement.css';
import '../../styles/components/form.css';
import '../../styles/components/header.css';

// Define form schema
const clientFormSchema = z.object({
  // Basic Details
  companyName: z.string().min(1, { message: 'Company name is required' }),
  billingName: z.string().min(1, { message: 'Billing name is required' }),
  shortCode: z.string().min(2, { message: 'Short code must be at least 2 characters' }).max(4, { message: 'Short code must be 4 characters or less' }),
  listName: z.string().optional(),
  website: z.string().url({ message: 'Must be a valid URL' }).optional().or(z.literal('')),
  clientManager: z.string().optional(),
  salesPerson: z.string().optional(),
  accountingPerson: z.string().optional(),
  accountingManager: z.string().optional(),
  clientRep: z.string().optional(),
  mergeInvoice: z.boolean().default(false),
  currency: z.enum(['CAD', 'USD']),
  workProvince: z.string().min(1, { message: 'Work province is required' }),
  wsibCode: z.string().regex(/^[A-Z][0-9]$/, { message: 'WSIB code must be 1 letter followed by 1 number (e.g., A1)' }).optional().or(z.literal('')),
  
  // Contact Details
  contactPersonName1: z.string().min(1, { message: 'Contact person name is required' }),
  emailAddress1: z.string().email({ message: 'Valid email is required' }),
  mobile1: z.string().min(1, { message: 'Mobile number is required' }),
  contactPersonName2: z.string().optional(),
  emailAddress2: z.string().email({ message: 'Valid email is required' }).optional().or(z.literal('')),
  invoiceCC2: z.boolean().default(false),
  mobile2: z.string().optional(),
  contactPersonName3: z.string().optional(),
  emailAddress3: z.string().email({ message: 'Valid email is required' }).optional().or(z.literal('')),
  invoiceCC3: z.boolean().default(false),
  mobile3: z.string().optional(),
  dispatchDeptEmail: z.string().email({ message: 'Valid email is required' }).optional().or(z.literal('')),
  invoiceCCDispatch: z.boolean().default(false),
  accountsDeptEmail: z.string().email({ message: 'Valid email is required' }).optional().or(z.literal('')),
  invoiceCCAccounts: z.boolean().default(false),
  invoiceLanguage: z.enum(['English', 'French']),
  
  // Address Details
  streetAddress1: z.string().min(1, { message: 'Street address is required' }),
  city1: z.string().min(1, { message: 'City is required' }),
  province1: z.string().min(1, { message: 'Province is required' }),
  postalCode1: z.string().min(1, { message: 'Postal code is required' }),
  streetAddress2: z.string().optional(),
  city2: z.string().optional(),
  province2: z.string().optional(),
  postalCode2: z.string().optional(),
  streetAddress3: z.string().optional(),
  city3: z.string().optional(),
  province3: z.string().optional(),
  postalCode3: z.string().optional(),
  
  // Payment & Billings
  preferredPaymentMethod: z.string().min(1, { message: 'Payment method is required' }),
  terms: z.string().min(1, { message: 'Terms are required' }),
  payCycle: z.string().min(1, { message: 'Pay cycle is required' }),
  creditLimit: z.string().min(1, { message: 'Credit limit is required' }),
  notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

interface ClientCreateProps {
  isEditMode?: boolean;
  isEditDraftMode?: boolean;
}

export function ClientCreate({ isEditMode = false, isEditDraftMode = false }: ClientCreateProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('Create Client');

  // Get ID from URL params or location state
  const idFromParams = params.id;
  const idFromLocation = location.state?.id;
  const id = idFromParams || idFromLocation;

  // Initialize form with validation
  const methods = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      currency: 'CAD',
      mergeInvoice: false,
      invoiceCC2: false,
      invoiceCC3: false,
      invoiceCCDispatch: false,
      invoiceCCAccounts: false,
      invoiceLanguage: 'English',
    },
    mode: 'onBlur',
  });

  const { handleSubmit, reset, formState, watch } = methods;
  const { isDirty } = formState;

  // Function to convert snake_case keys to camelCase
  const convertToCamelCase = (data: ClientData | Record<string, unknown>): ClientFormData => {
    const result: Record<string, unknown> = {};
    
    // Function to decode HTML entities
    const decodeHtmlEntities = (text: string): string => {
      const textArea = document.createElement('textarea');
      textArea.innerHTML = text;
      return textArea.value;
    };
    
    // Process each key-value pair
    Object.entries(data).forEach(([key, value]) => {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      
      // Decode HTML entities for website field
      if (camelKey === 'website' && typeof value === 'string' && value) {
        result[camelKey] = decodeHtmlEntities(value);
      } else {
        result[camelKey] = value;
      }
    });
    
    return result as ClientFormData;
  };

  // Watch for form changes
  useEffect(() => {
    if (isDirty) {
      setHasUnsavedChanges(true);
    }
  }, [watch(), isDirty]);

  // Set page title based on mode
  useEffect(() => {
    if (isEditMode) {
      setPageTitle('Edit Client');
    } else if (isEditDraftMode) {
      setPageTitle('Edit Client Draft');
    } else {
      setPageTitle('Create Client');
    }
  }, [isEditMode, isEditDraftMode]);

  // Load client data if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      console.log("Loading client for editing with ID:", id);
      const loadClient = async () => {
        setLoading(true);
        try {
          const client = await getClient(id);
          console.log("Client data loaded:", client);
          
          if (client) {
            // Convert snake_case keys to camelCase for the form
            const formattedClient = convertToCamelCase(client);
            console.log("Formatted client data:", formattedClient);
            
            setClientId(id);
            
            // Reset form with client data
            reset(formattedClient);
            
            // Client is already saved, so form is not dirty
            setHasUnsavedChanges(false);
          }
        } catch (err) {
          console.error('Error loading client:', err);
          const errorMessage = err instanceof Error ? err.message : 'Error loading client';
          setError(errorMessage);
          setTimeout(() => setError(null), 3000);
        } finally {
          setLoading(false);
        }
      };

      loadClient();
    }
  }, [id, isEditMode, reset]);

  // Load draft if in edit draft mode
  useEffect(() => {
    if (isEditDraftMode && id) {
      console.log("Loading draft for editing with ID:", id);
      const loadDraft = async () => {
        setLoading(true);
        try {
          const { draft, lastUpdated } = await getClientDraftById(id);
          console.log("Draft data loaded:", draft);
          
          if (draft) {
            // Ensure data is in camelCase format
            const formattedDraft = convertToCamelCase(draft);
            console.log("Formatted draft data:", formattedDraft);
            
            setDraftId(draft.id as string);
            setLastSaved(lastUpdated);
            
            // Reset form with draft data
            reset(formattedDraft);
            
            // Draft is already saved, so form is not dirty
            setHasUnsavedChanges(false);
          }
        } catch (err) {
          console.error('Error loading draft:', err);
          const errorMessage = err instanceof Error ? err.message : 'Error loading draft';
          setError(errorMessage);
          setTimeout(() => setError(null), 3000);
        } finally {
          setLoading(false);
        }
      };

      loadDraft();
    }
  }, [id, isEditDraftMode, reset]);

  // Prevent accidental navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Save draft periodically (only if not in client edit mode)
  useEffect(() => {
    let saveDraftInterval: NodeJS.Timeout;
    
    if (hasUnsavedChanges && !isEditMode) {
      saveDraftInterval = setInterval(() => {
        handleSaveDraft();
      }, 60000); // Auto-save every minute
    }

    return () => {
      if (saveDraftInterval) clearInterval(saveDraftInterval);
    };
  }, [hasUnsavedChanges, isEditMode, watch()]);

  const handleSaveDraft = async () => {
    if (!hasUnsavedChanges || isEditMode) return;
    
    setSaving(true);
    try {
      const formData = methods.getValues();
      
      // Prepare draft data with ID if available
      const draftData = {
        ...formData,
        id: draftId || (isEditDraftMode ? id : undefined),
        isDraft: true,
      };
      
      // Use the updated saveClientDraft function that now handles both new drafts and updates
      const { draft, lastUpdated } = await saveClientDraft(draftData);
      
      if (draft) {
        setDraftId(draft.id as string);
        setLastSaved(lastUpdated);
        setHasUnsavedChanges(false);
        setSuccess('Draft saved successfully');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: unknown) {
      console.error('Error saving draft:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save draft';
      setError(errorMessage);
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleFormSubmit = async (data: ClientFormData) => {
    setLoading(true);
    try {
      if (isEditMode && (clientId || id)) {
        // Update existing client
        const clientIdToUse = clientId || id;
        await updateClient(clientIdToUse, data as ClientData);
        setSuccess('Client updated successfully');
        
        // Navigate back to client management after short delay
        setTimeout(() => {
          navigate('/client-management', {
            state: { message: 'Client updated successfully' }
          });
        }, 2000);
      } else {
        // Create new client
        await createClient(data as ClientData);
        setSuccess('Client created successfully');
        setHasUnsavedChanges(false);
        
        // If we were editing a draft, delete it after successful submission
        if (isEditDraftMode && (draftId || id)) {
          try {
            const draftIdToDelete = draftId || id;
            await deleteClientDraft(draftIdToDelete);
            console.log(`Draft ${draftIdToDelete} deleted after successful client creation`);
          } catch (err) {
            console.error('Error deleting draft after client creation:', err);
            // Don't return error to user since client was created successfully
          }
        }
        
        // Navigate back to client management after short delay
        setTimeout(() => {
          navigate('/client-management', {
            state: { message: 'Client created successfully' }
          });
        }, 2000);
      }
    } catch (err: unknown) {
      console.error('Error processing client:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to process client';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges && !isEditMode) {
      setShowExitConfirmation(true);
    } else {
      navigateBack();
    }
  };

  const navigateBack = () => {
    if (isEditDraftMode) {
      navigate('/client-management/drafts');
    } else {
      navigate('/client-management');
    }
  };

  // Basic component structure - detailed form to be added
  return (
    <div className="page-container">
      <AppHeader
        title={pageTitle}
        actions={
          <>
            {!isEditMode && (
              <button 
                className="button secondary button-icon" 
                onClick={handleSaveDraft} 
                disabled={saving || !hasUnsavedChanges}
              >
                <Save size={16} />
                <span>{saving ? 'Saving...' : 'Save Draft'}</span>
              </button>
            )}
             <button 
              className="button button-icon" 
              onClick={handleCancel}
            >
              <ArrowLeft size={16} />
              <span>Back To Client Management</span>
            </button>
          </>
        }
        statusMessage={error || success}
        statusType={error ? 'error' : 'success'}
      />

      <div className="content-container">
        {lastSaved && !isEditMode && (
          <div className="last-saved">
            Last saved: {new Date(lastSaved).toLocaleString()}
          </div>
        )}

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="client-form">
            <div className="form-card">
              {/* Basic Details Section */}
              <div className="form-section">
                <h2>Basic Details</h2>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="companyName" className="form-label" data-required="*">
                      Company Name
                    </label>
                    <input
                      type="text"
                      id="companyName"
                      className="form-input"
                      placeholder="Enter company name"
                      {...methods.register('companyName')}
                    />
                    {methods.formState.errors.companyName && (
                      <p className="form-error">{methods.formState.errors.companyName.message}</p>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="billingName" className="form-label" data-required="*">
                      Billing Name
                    </label>
                    <input
                      type="text"
                      id="billingName"
                      className="form-input"
                      placeholder="Enter billing name"
                      {...methods.register('billingName')}
                    />
                    {methods.formState.errors.billingName && (
                      <p className="form-error">{methods.formState.errors.billingName.message}</p>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="shortCode" className="form-label">
                      Short Code (2-4 letters)
                    </label>
                    <input
                      type="text"
                      id="shortCode"
                      className="form-input"
                      placeholder="ABC"
                      maxLength={4}
                      {...methods.register('shortCode')}
                    />
                    {methods.formState.errors.shortCode && (
                      <p className="form-error">{methods.formState.errors.shortCode.message}</p>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="listName" className="form-label">
                      List Name
                    </label>
                    <select
                      id="listName"
                      className="form-input"
                      {...methods.register('listName')}
                    >
                      <option value="">Select a list name</option>
                      {LIST_NAMES.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    {methods.formState.errors.listName && (
                      <p className="form-error">{methods.formState.errors.listName.message}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="website" className="form-label">
                      Website
                    </label>
                    <input
                      type="text"
                      id="website"
                      className="form-input"
                      placeholder="https://example.com"
                      {...methods.register('website')}
                    />
                    {methods.formState.errors.website && (
                      <p className="form-error">{methods.formState.errors.website.message}</p>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="clientManager" className="form-label">
                      Client Manager
                    </label>
                    <select
                      id="clientManager"
                      className="form-input"
                      {...methods.register('clientManager')}
                    >
                      <option value="">Select a client manager</option>
                      <option value="Manager 1">Manager 1</option>
                      <option value="Manager 2">Manager 2</option>
                      <option value="Manager 3">Manager 3</option>
                    </select>
                    {methods.formState.errors.clientManager && (
                      <p className="form-error">{methods.formState.errors.clientManager.message}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="clientRep" className="form-label">
                      Client Representative
                    </label>
                    <select
                      id="clientRep"
                      className="form-input"
                      {...methods.register('clientRep')}
                    >
                      <option value="">Select a client representative</option>
                      <option value="Client Rep 1">Client Rep 1</option>
                      <option value="Client Rep 2">Client Rep 2</option>
                      <option value="Client Rep 3">Client Rep 3</option>
                    </select>
                    {methods.formState.errors.clientRep && (
                      <p className="form-error">{methods.formState.errors.clientRep.message}</p>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="salesPerson" className="form-label">
                      Sales Person
                    </label>
                    <select
                      id="salesPerson"
                      className="form-input"
                      {...methods.register('salesPerson')}
                    >
                      <option value="">Select a sales person</option>
                      <option value="Sales 1">Sales 1</option>
                      <option value="Sales 2">Sales 2</option>
                      <option value="Sales 3">Sales 3</option>
                    </select>
                    {methods.formState.errors.salesPerson && (
                      <p className="form-error">{methods.formState.errors.salesPerson.message}</p>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="accountingPerson" className="form-label">
                      Accounting Person
                    </label>
                    <select
                      id="accountingPerson"
                      className="form-input"
                      {...methods.register('accountingPerson')}
                    >
                      <option value="">Select an accounting person</option>
                      <option value="Accounting 1">Accounting 1</option>
                      <option value="Accounting 2">Accounting 2</option>
                      <option value="Accounting 3">Accounting 3</option>
                    </select>
                    {methods.formState.errors.accountingPerson && (
                      <p className="form-error">{methods.formState.errors.accountingPerson.message}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="accountingManager" className="form-label">
                      Accounting Manager
                    </label>
                    <select
                      id="accountingManager"
                      className="form-input"
                      {...methods.register('accountingManager')}
                    >
                      <option value="">Select an accounting manager</option>
                      <option value="Accounting Manager 1">Accounting Manager 1</option>
                      <option value="Accounting Manager 2">Accounting Manager 2</option>
                      <option value="Accounting Manager 3">Accounting Manager 3</option>
                    </select>
                    {methods.formState.errors.accountingManager && (
                      <p className="form-error">{methods.formState.errors.accountingManager.message}</p>
                    )}
                  </div>
                  
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <div className="checkbox-container">
                      <input
                        type="checkbox"
                        id="mergeInvoice"
                        className="form-checkbox"
                        {...methods.register('mergeInvoice')}
                      />
                      <label htmlFor="mergeInvoice" className="checkbox-label">
                        Merge Invoice
                      </label>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="currency" className="form-label">
                      Currency
                    </label>
                    <select
                      id="currency"
                      className="form-input"
                      {...methods.register('currency')}
                    >
                      <option value="CAD">CAD</option>
                      <option value="USD">USD</option>
                    </select>
                    {methods.formState.errors.currency && (
                      <p className="form-error">{methods.formState.errors.currency.message}</p>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="workProvince" className="form-label" data-required="*">
                      Work Province
                    </label>
                    <select
                      id="workProvince"
                      className="form-input"
                      {...methods.register('workProvince')}
                    >
                      <option value="">Select a province</option>
                      <option value="AB">Alberta (AB)</option>
                      <option value="BC">British Columbia (BC)</option>
                      <option value="MB">Manitoba (MB)</option>
                      <option value="NB">New Brunswick (NB)</option>
                      <option value="NL">Newfoundland and Labrador (NL)</option>
                      <option value="NT">Northwest Territories (NT)</option>
                      <option value="NS">Nova Scotia (NS)</option>
                      <option value="NU">Nunavut (NU)</option>
                      <option value="ON">Ontario (ON)</option>
                      <option value="PE">Prince Edward Island (PE)</option>
                      <option value="QC">Quebec (QC)</option>
                      <option value="SK">Saskatchewan (SK)</option>
                      <option value="YK">Yukon (YK)</option>
                    </select>
                    {methods.formState.errors.workProvince && (
                      <p className="form-error">{methods.formState.errors.workProvince.message}</p>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="wsibCode" className="form-label">
                      WSIB Code
                    </label>
                    <input
                      type="text"
                      id="wsibCode"
                      className="form-input"
                      placeholder="A1"
                      maxLength={2}
                      style={{ textTransform: 'uppercase' }}
                      {...methods.register('wsibCode')}
                    />
                    {methods.formState.errors.wsibCode && (
                      <p className="form-error">{methods.formState.errors.wsibCode.message}</p>
                    )}
                    <p className="form-hint">Format: 1 letter followed by 1 number (e.g., A1, B2)</p>
                  </div>
                </div>
              </div>

              {/* Contact Details Section */}
              <div className="form-section">
                <h2>Contact Details</h2>
                
                {/* Contact Person 1 */}
                <div className="form-subsection">
                  <h3>Primary Contact</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="contactPersonName1" className="form-label" data-required="*">
                        Contact Person Name 1
                      </label>
                      <input
                        type="text"
                        id="contactPersonName1"
                        className="form-input"
                        placeholder="Enter contact name"
                        {...methods.register('contactPersonName1')}
                      />
                      {methods.formState.errors.contactPersonName1 && (
                        <p className="form-error">{methods.formState.errors.contactPersonName1.message}</p>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="emailAddress1" className="form-label" data-required="*">
                        Email Address 1
                      </label>
                      <input
                        type="email"
                        id="emailAddress1"
                        className="form-input"
                        placeholder="Enter email address"
                        {...methods.register('emailAddress1')}
                      />
                      {methods.formState.errors.emailAddress1 && (
                        <p className="form-error">{methods.formState.errors.emailAddress1.message}</p>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="mobile1" className="form-label" data-required="*">
                        Mobile 1
                      </label>
                      <input
                        type="tel"
                        id="mobile1"
                        className="form-input"
                        placeholder="Enter mobile number"
                        {...methods.register('mobile1')}
                      />
                      {methods.formState.errors.mobile1 && (
                        <p className="form-error">{methods.formState.errors.mobile1.message}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Contact Person 2 */}
                <div className="form-subsection">
                  <h3>Secondary Contact</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="contactPersonName2" className="form-label">
                        Contact Person Name 2
                      </label>
                      <input
                        type="text"
                        id="contactPersonName2"
                        className="form-input"
                        placeholder="Enter contact name"
                        {...methods.register('contactPersonName2')}
                      />
                      {methods.formState.errors.contactPersonName2 && (
                        <p className="form-error">{methods.formState.errors.contactPersonName2.message}</p>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="emailAddress2" className="form-label">
                        Email Address 2
                      </label>
                      <input
                        type="email"
                        id="emailAddress2"
                        className="form-input"
                        placeholder="Enter email address"
                        {...methods.register('emailAddress2')}
                      />
                      {methods.formState.errors.emailAddress2 && (
                        <p className="form-error">{methods.formState.errors.emailAddress2.message}</p>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="mobile2" className="form-label">
                        Mobile 2
                      </label>
                      <input
                        type="tel"
                        id="mobile2"
                        className="form-input"
                        placeholder="Enter mobile number"
                        {...methods.register('mobile2')}
                      />
                      {methods.formState.errors.mobile2 && (
                        <p className="form-error">{methods.formState.errors.mobile2.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <div className="checkbox-container">
                        <input
                          type="checkbox"
                          id="invoiceCC2"
                          className="form-checkbox"
                          {...methods.register('invoiceCC2')}
                        />
                        <label htmlFor="invoiceCC2" className="checkbox-label">
                          Invoice CC
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Contact Person 3 */}
                <div className="form-subsection">
                  <h3>Additional Contact</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="contactPersonName3" className="form-label">
                        Contact Person Name 3
                      </label>
                      <input
                        type="text"
                        id="contactPersonName3"
                        className="form-input"
                        placeholder="Enter contact name"
                        {...methods.register('contactPersonName3')}
                      />
                      {methods.formState.errors.contactPersonName3 && (
                        <p className="form-error">{methods.formState.errors.contactPersonName3.message}</p>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="emailAddress3" className="form-label">
                        Email Address 3
                      </label>
                      <input
                        type="email"
                        id="emailAddress3"
                        className="form-input"
                        placeholder="Enter email address"
                        {...methods.register('emailAddress3')}
                      />
                      {methods.formState.errors.emailAddress3 && (
                        <p className="form-error">{methods.formState.errors.emailAddress3.message}</p>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="mobile3" className="form-label">
                        Mobile 3
                      </label>
                      <input
                        type="tel"
                        id="mobile3"
                        className="form-input"
                        placeholder="Enter mobile number"
                        {...methods.register('mobile3')}
                      />
                      {methods.formState.errors.mobile3 && (
                        <p className="form-error">{methods.formState.errors.mobile3.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <div className="checkbox-container">
                        <input
                          type="checkbox"
                          id="invoiceCC3"
                          className="form-checkbox"
                          {...methods.register('invoiceCC3')}
                        />
                        <label htmlFor="invoiceCC3" className="checkbox-label">
                          Invoice CC
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Department Emails */}
                <div className="form-subsection">
                  <h3>Department Emails</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="dispatchDeptEmail" className="form-label">
                        Dispatch Dept. Email
                      </label>
                      <input
                        type="email"
                        id="dispatchDeptEmail"
                        className="form-input"
                        placeholder="Enter dispatch email"
                        {...methods.register('dispatchDeptEmail')}
                      />
                      {methods.formState.errors.dispatchDeptEmail && (
                        <p className="form-error">{methods.formState.errors.dispatchDeptEmail.message}</p>
                      )}
                      <div className="checkbox-container">
                        <input
                          type="checkbox"
                          id="invoiceCCDispatch"
                          className="form-checkbox"
                          {...methods.register('invoiceCCDispatch')}
                        />
                        <label htmlFor="invoiceCCDispatch" className="checkbox-label">
                          Invoice CC
                        </label>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="accountsDeptEmail" className="form-label">
                        Accounts Dept. Email
                      </label>
                      <input
                        type="email"
                        id="accountsDeptEmail"
                        className="form-input"
                        placeholder="Enter accounts email"
                        {...methods.register('accountsDeptEmail')}
                      />
                      {methods.formState.errors.accountsDeptEmail && (
                        <p className="form-error">{methods.formState.errors.accountsDeptEmail.message}</p>
                      )}
                      <div className="checkbox-container">
                        <input
                          type="checkbox"
                          id="invoiceCCAccounts"
                          className="form-checkbox"
                          {...methods.register('invoiceCCAccounts')}
                        />
                        <label htmlFor="invoiceCCAccounts" className="checkbox-label">
                          Invoice CC
                        </label>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="invoiceLanguage" className="form-label">
                        Invoice Language
                      </label>
                      <select
                        id="invoiceLanguage"
                        className="form-input"
                        {...methods.register('invoiceLanguage')}
                      >
                        <option value="English">English</option>
                        <option value="French">French</option>
                      </select>
                      {methods.formState.errors.invoiceLanguage && (
                        <p className="form-error">{methods.formState.errors.invoiceLanguage.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Address Details Section */}
              <div className="form-section">
                <h2>Address Details</h2>
                
                {/* Address 1 */}
                <div className="form-subsection">
                  <h3>Primary Address</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="streetAddress1" className="form-label" data-required="*">
                        Street Address 1
                      </label>
                      <input
                        type="text"
                        id="streetAddress1"
                        className="form-input"
                        placeholder="Enter street address"
                        {...methods.register('streetAddress1')}
                      />
                      {methods.formState.errors.streetAddress1 && (
                        <p className="form-error">{methods.formState.errors.streetAddress1.message}</p>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="city1" className="form-label" data-required="*">
                        City 1
                      </label>
                      <input
                        type="text"
                        id="city1"
                        className="form-input"
                        placeholder="Enter city"
                        {...methods.register('city1')}
                      />
                      {methods.formState.errors.city1 && (
                        <p className="form-error">{methods.formState.errors.city1.message}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="province1" className="form-label" data-required="*">
                        Province 1
                      </label>
                      <select
                        id="province1"
                        className="form-input"
                        {...methods.register('province1')}
                      >
                        <option value="">Select a province</option>
                        <option value="AB">Alberta (AB)</option>
                        <option value="BC">British Columbia (BC)</option>
                        <option value="MB">Manitoba (MB)</option>
                        <option value="NB">New Brunswick (NB)</option>
                        <option value="NL">Newfoundland and Labrador (NL)</option>
                        <option value="NT">Northwest Territories (NT)</option>
                        <option value="NS">Nova Scotia (NS)</option>
                        <option value="NU">Nunavut (NU)</option>
                        <option value="ON">Ontario (ON)</option>
                        <option value="PE">Prince Edward Island (PE)</option>
                        <option value="QC">Quebec (QC)</option>
                        <option value="SK">Saskatchewan (SK)</option>
                        <option value="YK">Yukon (YK)</option>
                      </select>
                      {methods.formState.errors.province1 && (
                        <p className="form-error">{methods.formState.errors.province1.message}</p>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="postalCode1" className="form-label" data-required="*">
                        Postal Code 1
                      </label>
                      <input
                        type="text"
                        id="postalCode1"
                        className="form-input"
                        placeholder="Enter postal code"
                        {...methods.register('postalCode1')}
                      />
                      {methods.formState.errors.postalCode1 && (
                        <p className="form-error">{methods.formState.errors.postalCode1.message}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Address 2 */}
                <div className="form-subsection">
                  <h3>Secondary Address</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="streetAddress2" className="form-label">
                        Street Address 2
                      </label>
                      <input
                        type="text"
                        id="streetAddress2"
                        className="form-input"
                        placeholder="Enter street address"
                        {...methods.register('streetAddress2')}
                      />
                      {methods.formState.errors.streetAddress2 && (
                        <p className="form-error">{methods.formState.errors.streetAddress2.message}</p>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="city2" className="form-label">
                        City 2
                      </label>
                      <input
                        type="text"
                        id="city2"
                        className="form-input"
                        placeholder="Enter city"
                        {...methods.register('city2')}
                      />
                      {methods.formState.errors.city2 && (
                        <p className="form-error">{methods.formState.errors.city2.message}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="province2" className="form-label">
                        Province 2
                      </label>
                      <select
                        id="province2"
                        className="form-input"
                        {...methods.register('province2')}
                      >
                        <option value="">Select a province</option>
                        <option value="AB">Alberta (AB)</option>
                        <option value="BC">British Columbia (BC)</option>
                        <option value="MB">Manitoba (MB)</option>
                        <option value="NB">New Brunswick (NB)</option>
                        <option value="NL">Newfoundland and Labrador (NL)</option>
                        <option value="NT">Northwest Territories (NT)</option>
                        <option value="NS">Nova Scotia (NS)</option>
                        <option value="NU">Nunavut (NU)</option>
                        <option value="ON">Ontario (ON)</option>
                        <option value="PE">Prince Edward Island (PE)</option>
                        <option value="QC">Quebec (QC)</option>
                        <option value="SK">Saskatchewan (SK)</option>
                        <option value="YK">Yukon (YK)</option>
                      </select>
                      {methods.formState.errors.province2 && (
                        <p className="form-error">{methods.formState.errors.province2.message}</p>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="postalCode2" className="form-label">
                        Postal Code 2
                      </label>
                      <input
                        type="text"
                        id="postalCode2"
                        className="form-input"
                        placeholder="Enter postal code"
                        {...methods.register('postalCode2')}
                      />
                      {methods.formState.errors.postalCode2 && (
                        <p className="form-error">{methods.formState.errors.postalCode2.message}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Address 3 */}
                <div className="form-subsection">
                  <h3>Additional Address</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="streetAddress3" className="form-label">
                        Street Address 3
                      </label>
                      <input
                        type="text"
                        id="streetAddress3"
                        className="form-input"
                        placeholder="Enter street address"
                        {...methods.register('streetAddress3')}
                      />
                      {methods.formState.errors.streetAddress3 && (
                        <p className="form-error">{methods.formState.errors.streetAddress3.message}</p>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="city3" className="form-label">
                        City 3
                      </label>
                      <input
                        type="text"
                        id="city3"
                        className="form-input"
                        placeholder="Enter city"
                        {...methods.register('city3')}
                      />
                      {methods.formState.errors.city3 && (
                        <p className="form-error">{methods.formState.errors.city3.message}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="province3" className="form-label">
                        Province 3
                      </label>
                      <select
                        id="province3"
                        className="form-input"
                        {...methods.register('province3')}
                      >
                        <option value="">Select a province</option>
                        <option value="AB">Alberta (AB)</option>
                        <option value="BC">British Columbia (BC)</option>
                        <option value="MB">Manitoba (MB)</option>
                        <option value="NB">New Brunswick (NB)</option>
                        <option value="NL">Newfoundland and Labrador (NL)</option>
                        <option value="NT">Northwest Territories (NT)</option>
                        <option value="NS">Nova Scotia (NS)</option>
                        <option value="NU">Nunavut (NU)</option>
                        <option value="ON">Ontario (ON)</option>
                        <option value="PE">Prince Edward Island (PE)</option>
                        <option value="QC">Quebec (QC)</option>
                        <option value="SK">Saskatchewan (SK)</option>
                        <option value="YK">Yukon (YK)</option>
                      </select>
                      {methods.formState.errors.province3 && (
                        <p className="form-error">{methods.formState.errors.province3.message}</p>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="postalCode3" className="form-label">
                        Postal Code 3
                      </label>
                      <input
                        type="text"
                        id="postalCode3"
                        className="form-input"
                        placeholder="Enter postal code"
                        {...methods.register('postalCode3')}
                      />
                      {methods.formState.errors.postalCode3 && (
                        <p className="form-error">{methods.formState.errors.postalCode3.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment & Billings Section */}
              <div className="form-section">
                <h2>Payment & Billings</h2>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="preferredPaymentMethod" className="form-label" data-required="*">
                      Preferred Payment Method
                    </label>
                    <select
                      id="preferredPaymentMethod"
                      className="form-input"
                      {...methods.register('preferredPaymentMethod')}
                    >
                      <option value="">Select payment method</option>
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                    {methods.formState.errors.preferredPaymentMethod && (
                      <p className="form-error">{methods.formState.errors.preferredPaymentMethod.message}</p>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="terms" className="form-label" data-required="*">
                      Terms
                    </label>
                    <select
                      id="terms"
                      className="form-input"
                      {...methods.register('terms')}
                    >
                      <option value="">Select terms</option>
                      {PAYMENT_TERMS.map((term) => (
                        <option key={term} value={term}>
                          {term}
                        </option>
                      ))}
                    </select>
                    {methods.formState.errors.terms && (
                      <p className="form-error">{methods.formState.errors.terms.message}</p>
                    )}
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="payCycle" className="form-label" data-required="*">
                      Pay Cycle
                    </label>
                    <select
                      id="payCycle"
                      className="form-input"
                      {...methods.register('payCycle')}
                    >
                      <option value="">Select pay cycle</option>
                      {PAY_CYCLES.map((cycle) => (
                        <option key={cycle} value={cycle}>
                          {cycle}
                        </option>
                      ))}
                    </select>
                    {methods.formState.errors.payCycle && (
                      <p className="form-error">{methods.formState.errors.payCycle.message}</p>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="creditLimit" className="form-label" data-required="*">
                      Credit Limit
                    </label>
                    <select
                      id="creditLimit"
                      className="form-input"
                      {...methods.register('creditLimit')}
                    >
                      <option value="">Select credit limit</option>
                      {CREDIT_LIMITS.map((limit) => (
                        <option key={limit.value} value={limit.value}>
                          {limit.label}
                        </option>
                      ))}
                    </select>
                    {methods.formState.errors.creditLimit && (
                      <p className="form-error">{methods.formState.errors.creditLimit.message}</p>
                    )}
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="notes" className="form-label">
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      className="form-textarea"
                      placeholder="Enter any additional notes about this client"
                      rows={4}
                      {...methods.register('notes')}
                    />
                    {methods.formState.errors.notes && (
                      <p className="form-error">{methods.formState.errors.notes.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="form-navigation">
              <button 
                type="button" 
                className="button secondary" 
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="button primary" 
                disabled={loading}
              >
                {loading 
                  ? (isEditMode ? 'Updating...' : 'Creating...') 
                  : (isEditMode ? 'Update Client' : 'Create Client')}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>

      {showExitConfirmation && (
        <ConfirmationModal
          isOpen={showExitConfirmation}
          title="Unsaved Changes"
          message="You have unsaved changes. Do you want to save your draft before leaving?"
          confirmText="Save Draft"
          cancelText="Discard"
          onConfirm={async () => {
            await handleSaveDraft();
            setShowExitConfirmation(false);
            navigateBack();
          }}
          onCancel={() => {
            setShowExitConfirmation(false);
            navigateBack();
          }}
        />
      )}
    </div>
  );
} 