/**
 * Type definitions for the Godspeed Ops Portal
 */

/**
 * Document object structure
 */
export interface Document {
  documentType: string;
  documentTitle?: string;
  documentFile?: File;
  documentNotes?: string;
  documentPath?: string;
  documentFileName?: string;
  id?: string;
}

/**
 * Profile data structure used in the API
 */
export interface ProfileData {
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  mobile: string;
  licenseNumber?: string;
  passportNumber?: string;
  sinNumber?: string;
  sinExpiry?: string;
  businessNumber?: string;
  corporationName?: string;
  
  // Address fields
  street: string;
  city: string;
  province: string;
  postalCode: string;
  
  // Qualifications fields
  workPreference?: string;
  bio?: string; // Brief professional description (max 100 chars)
  licenseType: string;
  experience: string;
  manualDriving: 'Yes' | 'No' | 'NA';
  availability: 'Full-Time' | 'Part-Time';
  weekendAvailability: boolean;
  
  // Compensation fields
  payrateType: 'Hourly' | 'Daily' | 'Monthly';
  billRate: string;
  payRate: string;
  paymentMethod: string;
  hstGst?: string;
  cashDeduction?: string;
  overtimeEnabled: boolean;
  overtimeHours?: string;
  overtimeBillRate?: string;
  overtimePayRate?: string;
  
  // Document fields - now an array of documents
  documents: Document[];
  
  // Meta fields - used internally
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Database schema for jobseeker_profiles table
 */
export interface DbJobseekerProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  email: string;
  mobile: string;
  license_number?: string;
  passport_number?: string;
  sin_number?: string;
  sin_expiry?: string;
  business_number?: string;
  corporation_name?: string;
  
  // Address fields
  street: string;
  city: string;
  province: string;
  postal_code: string;
  
  // Qualifications fields
  work_preference?: string;
  bio?: string; // Brief professional description (max 100 chars)
  license_type: string;
  experience: string;
  manual_driving: string;
  availability: string;
  weekend_availability: boolean;
  
  // Compensation fields
  payrate_type: string;
  bill_rate: string;
  pay_rate: string;
  payment_method: string;
  hst_gst?: string;
  cash_deduction?: string;
  overtime_enabled: boolean;
  overtime_hours?: string;
  overtime_bill_rate?: string;
  overtime_pay_rate?: string;
  
  // Document fields - JSONB array in database
  documents: Document[];
  
  // Meta fields
  verification_status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Client data structure used in the API
 */
export interface ClientData {
  // Basic Details
  companyName: string;
  billingName: string;
  shortCode?: string;
  listName?: string;
  website?: string;
  clientManager?: string;
  salesPerson?: string;
  accountingPerson?: string;
  mergeInvoice: boolean;
  currency: 'CAD' | 'USD';
  workProvince: string;
  
  // Contact Details
  contactPersonName1: string;
  emailAddress1: string;
  mobile1: string;
  contactPersonName2?: string;
  emailAddress2?: string;
  invoiceCC2: boolean;
  mobile2?: string;
  contactPersonName3?: string;
  emailAddress3?: string;
  invoiceCC3: boolean;
  mobile3?: string;
  dispatchDeptEmail?: string;
  invoiceCCDispatch: boolean;
  accountsDeptEmail?: string;
  invoiceCCAccounts: boolean;
  invoiceLanguage: 'English' | 'French';
  
  // Address Details
  streetAddress1: string;
  city1: string;
  province1: string;
  postalCode1: string;
  streetAddress2?: string;
  city2?: string;
  province2?: string;
  postalCode2?: string;
  streetAddress3?: string;
  city3?: string;
  province3?: string;
  postalCode3?: string;
  
  // Payment & Billings
  preferredPaymentMethod: string;
  terms: string;
  payCycle: string;
  creditLimit: string;
  notes?: string;
  
  // Status and meta fields
  isDraft?: boolean;
  lastUpdated?: string;
}

/**
 * Database schema for clients table
 */
export interface DbClientData {
  id: string;
  
  // Basic Details
  company_name: string;
  billing_name: string;
  short_code?: string;
  list_name?: string;
  website?: string;
  client_manager?: string;
  sales_person?: string;
  accounting_person?: string;
  merge_invoice: boolean;
  currency: string;
  work_province: string;
  
  // Contact Details
  contact_person_name1: string;
  email_address1: string;
  mobile1: string;
  contact_person_name2?: string;
  email_address2?: string;
  invoice_cc2: boolean;
  mobile2?: string;
  contact_person_name3?: string;
  email_address3?: string;
  invoice_cc3: boolean;
  mobile3?: string;
  dispatch_dept_email?: string;
  invoice_cc_dispatch: boolean;
  accounts_dept_email?: string;
  invoice_cc_accounts: boolean;
  invoice_language: string;
  
  // Address Details
  street_address1: string;
  city1: string;
  province1: string;
  postal_code1: string;
  street_address2?: string;
  city2?: string;
  province2?: string;
  postal_code2?: string;
  street_address3?: string;
  city3?: string;
  province3?: string;
  postal_code3?: string;
  
  // Payment & Billings
  preferred_payment_method: string;
  terms: string;
  pay_cycle: string;
  credit_limit: string;
  notes?: string;
  
  // Meta fields
  is_draft: boolean;
  created_at: string;
  created_by_user_id: string;
  updated_at: string;
  updated_by_user_id: string;
} 