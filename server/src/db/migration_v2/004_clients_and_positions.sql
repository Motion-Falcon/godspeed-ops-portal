-- Consolidated migration_v2: clients and positions

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255) NOT NULL,
  billing_name VARCHAR(255) NOT NULL,
  short_code VARCHAR(3),
  list_name VARCHAR(255),
  website VARCHAR(255),
  client_manager VARCHAR(255),
  sales_person VARCHAR(255),
  accounting_person VARCHAR(255),
  accounting_manager VARCHAR(255),
  client_rep VARCHAR(255),
  merge_invoice BOOLEAN DEFAULT FALSE,
  currency VARCHAR(3) NOT NULL,
  work_province VARCHAR(2) NOT NULL,
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
  preferred_payment_method VARCHAR(50) NOT NULL,
  terms VARCHAR(50) NOT NULL,
  pay_cycle VARCHAR(50) NOT NULL,
  credit_limit VARCHAR(50) NOT NULL,
  notes TEXT,
  is_draft BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  wsib_code VARCHAR(2),
  CONSTRAINT clients_wsib_code_format_check CHECK (wsib_code IS NULL OR wsib_code ~ '^[A-Z][0-9]$')
);

CREATE TABLE IF NOT EXISTS public.client_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255),
  billing_name VARCHAR(255),
  short_code VARCHAR(3),
  list_name VARCHAR(255),
  website VARCHAR(255),
  client_manager VARCHAR(255),
  sales_person VARCHAR(255),
  accounting_person VARCHAR(255),
  accounting_manager VARCHAR(255),
  client_rep VARCHAR(255),
  merge_invoice BOOLEAN DEFAULT FALSE,
  currency VARCHAR(3),
  work_province VARCHAR(2),
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
  preferred_payment_method VARCHAR(50),
  terms VARCHAR(50),
  pay_cycle VARCHAR(50),
  credit_limit VARCHAR(50),
  notes TEXT,
  is_draft BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_user_id UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_clients_company_name ON public.clients(company_name);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email_address1);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_client_drafts_created_by ON public.client_drafts(created_by_user_id);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and recruiters can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and recruiters can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and recruiters can update clients" ON public.clients;
DROP POLICY IF EXISTS "Only admins can delete clients" ON public.clients;

DROP POLICY IF EXISTS "Users can view their own drafts" ON public.client_drafts;
DROP POLICY IF EXISTS "Users can insert their own drafts" ON public.client_drafts;
DROP POLICY IF EXISTS "Users can update their own drafts" ON public.client_drafts;
DROP POLICY IF EXISTS "Users can delete their own drafts" ON public.client_drafts;

CREATE POLICY "Admins and recruiters can view all clients"
  ON public.clients FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Admins and recruiters can insert clients"
  ON public.clients FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Admins and recruiters can update clients"
  ON public.clients FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Only admins can delete clients"
  ON public.clients FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' = 'admin'
    )
  );

CREATE POLICY "Users can view their own drafts"
  ON public.client_drafts FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can insert their own drafts"
  ON public.client_drafts FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own drafts"
  ON public.client_drafts FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own drafts"
  ON public.client_drafts FOR DELETE
  USING (auth.uid() = created_by_user_id);

CREATE TABLE IF NOT EXISTS public.positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client UUID REFERENCES public.clients(id),
  title VARCHAR(255) NOT NULL,
  position_code VARCHAR(10),
  start_date DATE NOT NULL,
  end_date DATE,
  show_on_job_portal BOOLEAN DEFAULT FALSE,
  stat BOOLEAN DEFAULT FALSE,
  client_manager VARCHAR(255),
  sales_manager VARCHAR(255),
  position_number VARCHAR(100),
  description TEXT NOT NULL,
  street_address VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  province VARCHAR(2) NOT NULL,
  postal_code VARCHAR(10) NOT NULL,
  employment_term VARCHAR(50) NOT NULL,
  employment_type VARCHAR(50) NOT NULL,
  position_category VARCHAR(50) NOT NULL,
  experience VARCHAR(50) NOT NULL,
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
  }'::jsonb,
  payrate_type VARCHAR(50) NOT NULL,
  number_of_positions INTEGER NOT NULL,
  regular_pay_rate VARCHAR(50) NOT NULL,
  markup VARCHAR(50),
  bill_rate VARCHAR(50) NOT NULL,
  overtime_enabled BOOLEAN DEFAULT FALSE,
  overtime_hours VARCHAR(50),
  overtime_bill_rate VARCHAR(50),
  overtime_pay_rate VARCHAR(50),
  preferred_payment_method VARCHAR(50) NOT NULL,
  terms VARCHAR(50) NOT NULL,
  notes TEXT NOT NULL,
  assigned_to VARCHAR(255),
  proj_comp_date DATE,
  task_time VARCHAR(50),
  assigned_jobseekers UUID[] DEFAULT '{}' NOT NULL,
  client_name VARCHAR(255),
  is_draft BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  CONSTRAINT unique_position_code UNIQUE (position_code)
);

CREATE TABLE IF NOT EXISTS public.position_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client UUID REFERENCES public.clients(id),
  title VARCHAR(255),
  position_code VARCHAR(10),
  start_date DATE,
  end_date DATE,
  show_on_job_portal BOOLEAN DEFAULT FALSE,
  stat BOOLEAN DEFAULT FALSE,
  client_manager VARCHAR(255),
  sales_manager VARCHAR(255),
  position_number VARCHAR(100),
  description TEXT,
  street_address VARCHAR(255),
  city VARCHAR(255),
  province VARCHAR(2),
  postal_code VARCHAR(10),
  employment_term VARCHAR(50),
  employment_type VARCHAR(50),
  position_category VARCHAR(50),
  experience VARCHAR(50),
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
  }'::jsonb,
  payrate_type VARCHAR(50),
  number_of_positions INTEGER,
  regular_pay_rate VARCHAR(50),
  markup VARCHAR(50),
  bill_rate VARCHAR(50),
  overtime_enabled BOOLEAN DEFAULT FALSE,
  overtime_hours VARCHAR(50),
  overtime_bill_rate VARCHAR(50),
  overtime_pay_rate VARCHAR(50),
  preferred_payment_method VARCHAR(50),
  terms VARCHAR(50),
  notes TEXT,
  assigned_to VARCHAR(255),
  proj_comp_date DATE,
  task_time VARCHAR(50),
  client_name VARCHAR(255),
  is_draft BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_user_id UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_positions_client ON public.positions(client);
CREATE INDEX IF NOT EXISTS idx_positions_title ON public.positions(title);
CREATE INDEX IF NOT EXISTS idx_positions_created_by ON public.positions(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_position_drafts_created_by ON public.position_drafts(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_positions_client_position_code ON public.positions(client, position_code);
CREATE INDEX IF NOT EXISTS idx_positions_position_code_pattern ON public.positions(position_code) WHERE position_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_position_drafts_client_position_code ON public.position_drafts(client, position_code);
CREATE INDEX IF NOT EXISTS idx_position_drafts_position_code_pattern ON public.position_drafts(position_code) WHERE position_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_positions_assigned_jobseekers ON public.positions USING GIN(assigned_jobseekers);
CREATE INDEX IF NOT EXISTS idx_positions_has_assigned_jobseekers ON public.positions ((array_length(assigned_jobseekers, 1) > 0));
CREATE INDEX IF NOT EXISTS idx_positions_client_name ON public.positions(client_name);
CREATE INDEX IF NOT EXISTS idx_position_drafts_client_name ON public.position_drafts(client_name);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and recruiters can view all positions" ON public.positions;
DROP POLICY IF EXISTS "Admins and recruiters can insert positions" ON public.positions;
DROP POLICY IF EXISTS "Admins and recruiters can update positions" ON public.positions;
DROP POLICY IF EXISTS "Only admins can delete positions" ON public.positions;

DROP POLICY IF EXISTS "Users can view their own position drafts" ON public.position_drafts;
DROP POLICY IF EXISTS "Users can insert their own position drafts" ON public.position_drafts;
DROP POLICY IF EXISTS "Users can update their own position drafts" ON public.position_drafts;
DROP POLICY IF EXISTS "Users can delete their own position drafts" ON public.position_drafts;

CREATE POLICY "Admins and recruiters can view all positions"
  ON public.positions FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Admins and recruiters can insert positions"
  ON public.positions FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Admins and recruiters can update positions"
  ON public.positions FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Only admins can delete positions"
  ON public.positions FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' = 'admin'
    )
  );

CREATE POLICY "Users can view their own position drafts"
  ON public.position_drafts FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can insert their own position drafts"
  ON public.position_drafts FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own position drafts"
  ON public.position_drafts FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own position drafts"
  ON public.position_drafts FOR DELETE
  USING (auth.uid() = created_by_user_id);

CREATE OR REPLACE FUNCTION public.generate_next_position_code(client_short_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_number INTEGER;
  new_position_code TEXT;
  max_existing_number INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(
      CASE
        WHEN position_code ~ ('^' || client_short_code || '[0-9]{3}$')
        THEN CAST(RIGHT(position_code, 3) AS INTEGER)
        ELSE 0
      END
    ),
    0
  ) INTO max_existing_number
  FROM (
    SELECT position_code FROM public.positions WHERE position_code LIKE client_short_code || '%'
    UNION ALL
    SELECT position_code FROM public.position_drafts WHERE position_code LIKE client_short_code || '%'
  ) AS all_codes;

  next_number := max_existing_number + 1;
  new_position_code := client_short_code || LPAD(next_number::TEXT, 3, '0');
  RETURN new_position_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_next_position_code(TEXT) TO authenticated;

UPDATE public.positions p
SET client_name = c.company_name
FROM public.clients c
WHERE p.client = c.id
  AND (p.client_name IS NULL OR p.client_name = '');

UPDATE public.position_drafts pd
SET client_name = c.company_name
FROM public.clients c
WHERE pd.client = c.id
  AND (pd.client_name IS NULL OR pd.client_name = '');

COMMENT ON COLUMN public.positions.position_code IS 'Format: [CLIENT_SHORT_CODE][3-digit-number], e.g., ABC001, XYZ002';
COMMENT ON COLUMN public.position_drafts.position_code IS 'Format: [CLIENT_SHORT_CODE][3-digit-number], e.g., ABC001, XYZ002';
COMMENT ON COLUMN public.positions.assigned_jobseekers IS 'Array of jobseeker profile IDs assigned to this position';
COMMENT ON COLUMN public.positions.client_name IS 'Denormalized client company name for easier querying';
COMMENT ON COLUMN public.position_drafts.client_name IS 'Denormalized client company name for easier querying';
COMMENT ON COLUMN public.clients.wsib_code IS 'WSIB code format: 1 uppercase letter followed by 1 digit (e.g., A1)';
