-- Create client_dropdown_options table for storing dynamic dropdown values
-- Used for: client_manager, client_representative, salesperson, accounting_person, accounting_manager

CREATE TABLE IF NOT EXISTS public.client_dropdown_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_type, name)
);

-- Create index for efficient lookups by list_type
CREATE INDEX IF NOT EXISTS idx_client_dropdown_options_list_type
  ON public.client_dropdown_options(list_type);

-- Add comment
COMMENT ON TABLE public.client_dropdown_options IS 'Stores dropdown options for client forms: client_manager, client_representative, salesperson, accounting_person, accounting_manager';

-- Enable RLS
ALTER TABLE public.client_dropdown_options ENABLE ROW LEVEL SECURITY;

-- Admins and recruiters can read (for dropdowns in client form)
CREATE POLICY "Admins and recruiters can view dropdown options"
  ON public.client_dropdown_options FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

-- Only admins can insert
CREATE POLICY "Only admins can insert dropdown options"
  ON public.client_dropdown_options FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' = 'admin'
    )
  );

-- Only admins can update
CREATE POLICY "Only admins can update dropdown options"
  ON public.client_dropdown_options FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' = 'admin'
    )
  );

-- Only admins can delete
CREATE POLICY "Only admins can delete dropdown options"
  ON public.client_dropdown_options FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' = 'admin'
    )
  );
