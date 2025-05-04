-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic Details
  company_name VARCHAR(255) NOT NULL,
  billing_name VARCHAR(255) NOT NULL,
  short_code VARCHAR(3),
  list_name VARCHAR(255),
  website VARCHAR(255),
  client_manager VARCHAR(255),
  sales_person VARCHAR(255),
  accounting_person VARCHAR(255),
  merge_invoice BOOLEAN DEFAULT FALSE,
  currency VARCHAR(3) NOT NULL,
  work_province VARCHAR(2) NOT NULL,
  
  -- Contact Details
  contact_person_name1 VARCHAR(255) NOT NULL,
  email_address1 VARCHAR(255) NOT NULL,
  mobile1 VARCHAR(50) NOT NULL,
  contact_person_name2 VARCHAR(255),
  email_address2 VARCHAR(255),
  invoice_cc2 BOOLEAN DEFAULT FALSE,
  mobile2 VARCHAR(50),
  contact_person_name3 VARCHAR(255),
  email_address3 VARCHAR(255),
  invoice_cc3 BOOLEAN DEFAULT FALSE,
  mobile3 VARCHAR(50),
  dispatch_dept_email VARCHAR(255),
  invoice_cc_dispatch BOOLEAN DEFAULT FALSE,
  accounts_dept_email VARCHAR(255),
  invoice_cc_accounts BOOLEAN DEFAULT FALSE,
  invoice_language VARCHAR(10) NOT NULL DEFAULT 'English',
  
  -- Address Details
  street_address1 VARCHAR(255) NOT NULL,
  city1 VARCHAR(255) NOT NULL,
  province1 VARCHAR(2) NOT NULL,
  postal_code1 VARCHAR(10) NOT NULL,
  street_address2 VARCHAR(255),
  city2 VARCHAR(255),
  province2 VARCHAR(2),
  postal_code2 VARCHAR(10),
  street_address3 VARCHAR(255),
  city3 VARCHAR(255),
  province3 VARCHAR(2),
  postal_code3 VARCHAR(10),
  
  -- Payment & Billings
  preferred_payment_method VARCHAR(50) NOT NULL,
  terms VARCHAR(50) NOT NULL,
  pay_cycle VARCHAR(50) NOT NULL,
  credit_limit VARCHAR(50) NOT NULL,
  notes TEXT,
  
  -- Meta fields
  is_draft BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by_user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Create draft table with the same structure
CREATE TABLE IF NOT EXISTS client_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic Details
  company_name VARCHAR(255),
  billing_name VARCHAR(255),
  short_code VARCHAR(3),
  list_name VARCHAR(255),
  website VARCHAR(255),
  client_manager VARCHAR(255),
  sales_person VARCHAR(255),
  accounting_person VARCHAR(255),
  merge_invoice BOOLEAN DEFAULT FALSE,
  currency VARCHAR(3),
  work_province VARCHAR(2),
  
  -- Contact Details
  contact_person_name1 VARCHAR(255),
  email_address1 VARCHAR(255),
  mobile1 VARCHAR(50),
  contact_person_name2 VARCHAR(255),
  email_address2 VARCHAR(255),
  invoice_cc2 BOOLEAN DEFAULT FALSE,
  mobile2 VARCHAR(50),
  contact_person_name3 VARCHAR(255),
  email_address3 VARCHAR(255),
  invoice_cc3 BOOLEAN DEFAULT FALSE,
  mobile3 VARCHAR(50),
  dispatch_dept_email VARCHAR(255),
  invoice_cc_dispatch BOOLEAN DEFAULT FALSE,
  accounts_dept_email VARCHAR(255),
  invoice_cc_accounts BOOLEAN DEFAULT FALSE,
  invoice_language VARCHAR(10) DEFAULT 'English',
  
  -- Address Details
  street_address1 VARCHAR(255),
  city1 VARCHAR(255),
  province1 VARCHAR(2),
  postal_code1 VARCHAR(10),
  street_address2 VARCHAR(255),
  city2 VARCHAR(255),
  province2 VARCHAR(2),
  postal_code2 VARCHAR(10),
  street_address3 VARCHAR(255),
  city3 VARCHAR(255),
  province3 VARCHAR(2),
  postal_code3 VARCHAR(10),
  
  -- Payment & Billings
  preferred_payment_method VARCHAR(50),
  terms VARCHAR(50),
  pay_cycle VARCHAR(50),
  credit_limit VARCHAR(50),
  notes TEXT,
  
  -- Meta fields
  is_draft BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by_user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON clients(company_name);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email_address1);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_client_drafts_created_by ON client_drafts(created_by_user_id);

-- Add RLS policies for clients table
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Admin and recruiter can see all clients
CREATE POLICY "Admins and recruiters can view all clients" 
  ON clients FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

-- Only admins and recruiters can insert clients
CREATE POLICY "Admins and recruiters can insert clients" 
  ON clients FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

-- Only admins and recruiters can update clients
CREATE POLICY "Admins and recruiters can update clients" 
  ON clients FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

-- Only admins can delete clients
CREATE POLICY "Only admins can delete clients" 
  ON clients FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' = 'admin'
    )
  );

-- Add RLS policies for client_drafts table
ALTER TABLE client_drafts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own drafts
CREATE POLICY "Users can view their own drafts" 
  ON client_drafts FOR SELECT
  USING (auth.uid() = created_by_user_id);

-- Users can only insert their own drafts
CREATE POLICY "Users can insert their own drafts" 
  ON client_drafts FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

-- Users can only update their own drafts
CREATE POLICY "Users can update their own drafts" 
  ON client_drafts FOR UPDATE
  USING (auth.uid() = created_by_user_id);

-- Users can only delete their own drafts
CREATE POLICY "Users can delete their own drafts" 
  ON client_drafts FOR DELETE
  USING (auth.uid() = created_by_user_id); 