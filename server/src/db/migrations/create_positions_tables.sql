-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic Details
  client UUID REFERENCES clients(id),
  title VARCHAR(255) NOT NULL,
  position_code VARCHAR(100),
  start_date DATE NOT NULL,
  end_date DATE,
  show_on_job_portal BOOLEAN DEFAULT FALSE,
  client_manager VARCHAR(255),
  sales_manager VARCHAR(255),
  position_number VARCHAR(100),
  description TEXT NOT NULL,
  
  -- Address Details
  street_address VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  province VARCHAR(2) NOT NULL,
  postal_code VARCHAR(10) NOT NULL,
  
  -- Employment Categorization
  employment_term VARCHAR(50) NOT NULL,
  employment_type VARCHAR(50) NOT NULL,
  position_category VARCHAR(50) NOT NULL,
  experience VARCHAR(50) NOT NULL,
  
  -- Documents Required
  documents_required JSONB NOT NULL DEFAULT '{
    "license": false,
    "driverAbstract": false,
    "tdgCertificate": false, 
    "sin": false,
    "immigrationStatus": false,
    "passport": false,
    "cvor": false,
    "resume": false,
    "articlesOfIncorporation": false,
    "directDeposit": false
  }',
  
  -- Position Details
  payrate_type VARCHAR(50) NOT NULL,
  number_of_positions INTEGER NOT NULL,
  regular_pay_rate VARCHAR(50) NOT NULL,
  markup VARCHAR(50),
  bill_rate VARCHAR(50) NOT NULL,
  
  -- Overtime
  overtime_enabled BOOLEAN DEFAULT FALSE,
  overtime_hours VARCHAR(50),
  overtime_bill_rate VARCHAR(50),
  overtime_pay_rate VARCHAR(50),
  
  -- Payment & Billings
  preferred_payment_method VARCHAR(50) NOT NULL,
  terms VARCHAR(50) NOT NULL,
  
  -- Notes
  notes TEXT NOT NULL,
  
  -- Task
  assigned_to VARCHAR(255),
  proj_comp_date DATE,
  task_time VARCHAR(50),
  
  -- Meta fields
  is_draft BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by_user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Create draft table with the same structure
CREATE TABLE IF NOT EXISTS position_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic Details
  client UUID REFERENCES clients(id),
  title VARCHAR(255),
  position_code VARCHAR(100),
  start_date DATE,
  end_date DATE,
  show_on_job_portal BOOLEAN DEFAULT FALSE,
  client_manager VARCHAR(255),
  sales_manager VARCHAR(255),
  position_number VARCHAR(100),
  description TEXT,
  
  -- Address Details
  street_address VARCHAR(255),
  city VARCHAR(255),
  province VARCHAR(2),
  postal_code VARCHAR(10),
  
  -- Employment Categorization
  employment_term VARCHAR(50),
  employment_type VARCHAR(50),
  position_category VARCHAR(50),
  experience VARCHAR(50),
  
  -- Documents Required
  documents_required JSONB DEFAULT '{
    "license": false,
    "driverAbstract": false,
    "tdgCertificate": false, 
    "sin": false,
    "immigrationStatus": false,
    "passport": false,
    "cvor": false,
    "resume": false,
    "articlesOfIncorporation": false,
    "directDeposit": false
  }',
  
  -- Position Details
  payrate_type VARCHAR(50),
  number_of_positions INTEGER,
  regular_pay_rate VARCHAR(50),
  markup VARCHAR(50),
  bill_rate VARCHAR(50),
  
  -- Overtime
  overtime_enabled BOOLEAN DEFAULT FALSE,
  overtime_hours VARCHAR(50),
  overtime_bill_rate VARCHAR(50),
  overtime_pay_rate VARCHAR(50),
  
  -- Payment & Billings
  preferred_payment_method VARCHAR(50),
  terms VARCHAR(50),
  
  -- Notes
  notes TEXT,
  
  -- Task
  assigned_to VARCHAR(255),
  proj_comp_date DATE,
  task_time VARCHAR(50),
  
  -- Meta fields
  is_draft BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by_user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_positions_client ON positions(client);
CREATE INDEX IF NOT EXISTS idx_positions_title ON positions(title);
CREATE INDEX IF NOT EXISTS idx_positions_created_by ON positions(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_position_drafts_created_by ON position_drafts(created_by_user_id);

-- Add RLS policies for positions table
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- Admin and recruiter can see all positions
CREATE POLICY "Admins and recruiters can view all positions" 
  ON positions FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

-- Only admins and recruiters can insert positions
CREATE POLICY "Admins and recruiters can insert positions" 
  ON positions FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

-- Only admins and recruiters can update positions
CREATE POLICY "Admins and recruiters can update positions" 
  ON positions FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

-- Only admins can delete positions
CREATE POLICY "Only admins can delete positions" 
  ON positions FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' = 'admin'
    )
  );

-- Add RLS policies for position_drafts table
ALTER TABLE position_drafts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own drafts
CREATE POLICY "Users can view their own position drafts" 
  ON position_drafts FOR SELECT
  USING (auth.uid() = created_by_user_id);

-- Users can only insert their own drafts
CREATE POLICY "Users can insert their own position drafts" 
  ON position_drafts FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

-- Users can only update their own drafts
CREATE POLICY "Users can update their own position drafts" 
  ON position_drafts FOR UPDATE
  USING (auth.uid() = created_by_user_id);

-- Users can only delete their own drafts
CREATE POLICY "Users can delete their own position drafts" 
  ON position_drafts FOR DELETE
  USING (auth.uid() = created_by_user_id); 