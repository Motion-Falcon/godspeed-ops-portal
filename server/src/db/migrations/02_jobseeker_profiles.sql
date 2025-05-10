-- Migration for jobseeker profile tables
-- Creates tables for profile management, drafts, and audit logging

-- Create jobseeker_profile_drafts table for saving in-progress forms
CREATE TABLE IF NOT EXISTS public.jobseeker_profile_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_data JSONB NOT NULL DEFAULT '{}',
  current_step INTEGER NOT NULL DEFAULT 1,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create jobseeker_profiles table for completed profile submissions
CREATE TABLE IF NOT EXISTS public.jobseeker_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT NOT NULL,
  license_number TEXT,
  passport_number TEXT,
  sin_number TEXT,
  sin_expiry TEXT,
  business_number TEXT,
  corporation_name TEXT,
  -- Address fields
  street TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  -- Qualifications fields
  work_preference TEXT,
  license_type TEXT,
  experience TEXT,
  manual_driving TEXT,
  availability TEXT,
  weekend_availability BOOLEAN,
  -- Compensation fields
  payrate_type TEXT,
  bill_rate TEXT,
  pay_rate TEXT,
  payment_method TEXT,
  hst_gst TEXT,
  cash_deduction TEXT,
  overtime_enabled BOOLEAN,
  overtime_hours TEXT,
  overtime_bill_rate TEXT,
  overtime_pay_rate TEXT,
  -- Document fields
  document_type TEXT,
  document_title TEXT,
  document_path TEXT,
  document_notes TEXT,
  -- Status and timestamps
  verification_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create audit_logs table for security and compliance tracking
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable Row Level Security on all tables
ALTER TABLE public.jobseeker_profile_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobseeker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own drafts" ON public.jobseeker_profile_drafts;
DROP POLICY IF EXISTS "Users can insert their own drafts" ON public.jobseeker_profile_drafts;
DROP POLICY IF EXISTS "Users can update their own drafts" ON public.jobseeker_profile_drafts;
DROP POLICY IF EXISTS "Users can delete their own drafts" ON public.jobseeker_profile_drafts;
DROP POLICY IF EXISTS "Users can view their own profiles" ON public.jobseeker_profiles;
DROP POLICY IF EXISTS "Users can insert their own profiles" ON public.jobseeker_profiles;
DROP POLICY IF EXISTS "Users can update their own profiles" ON public.jobseeker_profiles;
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.jobseeker_profiles;
DROP POLICY IF EXISTS "Only admins and recruiters can update verification status" ON public.jobseeker_profiles;
DROP POLICY IF EXISTS "Service role can do anything with drafts" ON public.jobseeker_profile_drafts;
DROP POLICY IF EXISTS "Service role can do anything with profiles" ON public.jobseeker_profiles;
DROP POLICY IF EXISTS "Service role can do anything with audit logs" ON public.audit_logs;

-- Drafts policies
CREATE POLICY "Users can view their own drafts" 
  ON public.jobseeker_profile_drafts FOR SELECT 
  USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert their own drafts" 
  ON public.jobseeker_profile_drafts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update their own drafts" 
  ON public.jobseeker_profile_drafts FOR UPDATE 
  USING (auth.uid() = user_id);
  
CREATE POLICY "Users can delete their own drafts" 
  ON public.jobseeker_profile_drafts FOR DELETE 
  USING (auth.uid() = user_id);

-- Profiles policies
CREATE POLICY "Users can view their own profiles" 
  ON public.jobseeker_profiles FOR SELECT 
  USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert their own profiles" 
  ON public.jobseeker_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update their own profiles" 
  ON public.jobseeker_profiles FOR UPDATE 
  USING (auth.uid() = user_id);

-- Recruiters and admins can view all profiles
CREATE POLICY "Staff can view all profiles" 
  ON public.jobseeker_profiles FOR SELECT 
  USING (public.is_admin() OR public.is_recruiter());

-- Only admins can modify verification status
CREATE POLICY "Only admins and recruiters can update verification status" 
  ON public.jobseeker_profiles FOR UPDATE 
  USING (public.is_admin() OR public.is_recruiter());

-- Service role policies for server-side operations
CREATE POLICY "Service role can do anything with drafts" 
  ON public.jobseeker_profile_drafts FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');
  
CREATE POLICY "Service role can do anything with profiles" 
  ON public.jobseeker_profiles FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');
  
CREATE POLICY "Service role can do anything with audit logs" 
  ON public.audit_logs FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role'); 