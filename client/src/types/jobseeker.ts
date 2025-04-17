// Define common jobseeker interfaces for reuse across the application

// Interface for document records within the documents array
export interface DocumentRecord {
  documentType: string;
  documentTitle?: string;
  documentPath?: string;
  documentFileName?: string;
  documentNotes?: string;
  id?: string;
}

export interface JobSeekerProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  skills?: string[];
  location?: string;
}

export interface JobSeekerDetailedProfile extends JobSeekerProfile {
  phone?: string;
  updatedAt: string;
  bio?: string;
  resume?: string; // This will hold the path to the resume document
  experience?: string; // The simplified experience string from the DB
  
  // Add fields from DbJobseekerProfile that are needed in the detailed view
  dob?: string;
  licenseNumber?: string;
  passportNumber?: string;
  sinNumber?: string; // Consider security implications before displaying
  sinExpiry?: string;
  businessNumber?: string;
  corporationName?: string;
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  workPreference?: string;
  licenseType?: string;
  manualDriving?: 'Yes' | 'No' | 'NA';
  availability?: 'Full-Time' | 'Part-Time';
  weekendAvailability?: boolean;
  payrateType?: 'Hourly' | 'Daily' | 'Monthly';
  billRate?: string;
  payRate?: string;
  paymentMethod?: string;
  hstGst?: string;
  cashDeduction?: string;
  overtimeEnabled?: boolean;
  overtimeHours?: string;
  overtimeBillRate?: string;
  overtimePayRate?: string;
  
  documents?: DocumentRecord[]; // Array of uploaded documents

  // Mocked/placeholder fields until related tables are implemented
  education?: unknown[];
  experienceList?: unknown[]; 
} 