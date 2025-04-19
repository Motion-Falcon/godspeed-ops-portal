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