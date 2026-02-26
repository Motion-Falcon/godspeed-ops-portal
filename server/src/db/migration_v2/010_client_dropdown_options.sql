-- Consolidated migration_v2: client dropdown options + seed data

CREATE TABLE IF NOT EXISTS public.client_dropdown_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_type, name)
);

CREATE INDEX IF NOT EXISTS idx_client_dropdown_options_list_type
ON public.client_dropdown_options(list_type);

ALTER TABLE public.client_dropdown_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and recruiters can view dropdown options" ON public.client_dropdown_options;
DROP POLICY IF EXISTS "Only admins can insert dropdown options" ON public.client_dropdown_options;
DROP POLICY IF EXISTS "Only admins can update dropdown options" ON public.client_dropdown_options;
DROP POLICY IF EXISTS "Only admins can delete dropdown options" ON public.client_dropdown_options;

CREATE POLICY "Admins and recruiters can view dropdown options"
ON public.client_dropdown_options FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM auth.users
    WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
  )
);

CREATE POLICY "Only admins can insert dropdown options"
ON public.client_dropdown_options FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM auth.users
    WHERE raw_user_meta_data->>'user_type' = 'admin'
  )
);

CREATE POLICY "Only admins can update dropdown options"
ON public.client_dropdown_options FOR UPDATE
USING (
  auth.uid() IN (
    SELECT id FROM auth.users
    WHERE raw_user_meta_data->>'user_type' = 'admin'
  )
);

CREATE POLICY "Only admins can delete dropdown options"
ON public.client_dropdown_options FOR DELETE
USING (
  auth.uid() IN (
    SELECT id FROM auth.users
    WHERE raw_user_meta_data->>'user_type' = 'admin'
  )
);

INSERT INTO public.client_dropdown_options (list_type, name, display_order) VALUES
  ('client_manager', 'Mansha Malik', 1),
  ('client_manager', 'Amandeep Kaur', 2),
  ('client_manager', 'Sumandeep Kaur', 3),
  ('client_manager', 'Mandeep Kaur', 4),
  ('client_manager', 'Rishi Dhaliwal', 5),
  ('client_manager', 'Yashpal Kaur', 6),
  ('client_manager', 'Morgan Drouin', 7),
  ('client_manager', 'Ajay', 8),
  ('client_manager', 'Rahul Singh Rawat', 9),
  ('client_manager', 'Vinayak', 10),
  ('client_manager', 'Kirandeep Kaur', 11),
  ('client_manager', 'Komal', 12),
  ('client_manager', 'Vani Sreeram', 13),
  ('client_manager', 'Hiral', 14),
  ('client_manager', 'Rahul Sharma', 15),
  ('client_manager', 'Samuel Jacob', 16),
  ('client_manager', 'Sharmili', 17),
  ('client_manager', 'Rajneet Kaur', 18)
ON CONFLICT (list_type, name) DO NOTHING;

INSERT INTO public.client_dropdown_options (list_type, name, display_order) VALUES
  ('client_representative', 'Mansha Malik', 1),
  ('client_representative', 'Amandeep Kaur', 2),
  ('client_representative', 'Sumandeep Kaur', 3),
  ('client_representative', 'Mandeep Kaur', 4),
  ('client_representative', 'Rishi Dhaliwal', 5),
  ('client_representative', 'Yashpal Kaur', 6),
  ('client_representative', 'Morgan Drouin', 7),
  ('client_representative', 'Ajay', 8),
  ('client_representative', 'Rahul Singh Rawat', 9),
  ('client_representative', 'Vinayak', 10),
  ('client_representative', 'Kirandeep Kaur', 11),
  ('client_representative', 'Komal', 12),
  ('client_representative', 'Vani Sreeram', 13),
  ('client_representative', 'Hiral', 14),
  ('client_representative', 'Rahul Sharma', 15),
  ('client_representative', 'Samuel Jacob', 16),
  ('client_representative', 'Sharmili', 17),
  ('client_representative', 'Rajneet Kaur', 18)
ON CONFLICT (list_type, name) DO NOTHING;

INSERT INTO public.client_dropdown_options (list_type, name, display_order) VALUES
  ('salesperson', 'Ashish Tandon', 1),
  ('salesperson', 'Bill Henderson', 2),
  ('salesperson', 'John Mageau', 3),
  ('salesperson', 'Karen Elsdon', 4),
  ('salesperson', 'Iman Thanvi', 5),
  ('salesperson', 'In-House', 6),
  ('salesperson', 'Jules LeRiche', 7),
  ('salesperson', 'Abrar Syed', 8),
  ('salesperson', 'Nick Pereira', 9),
  ('salesperson', 'Josh Poulin', 10)
ON CONFLICT (list_type, name) DO NOTHING;

INSERT INTO public.client_dropdown_options (list_type, name, display_order) VALUES
  ('accounting_person', 'Ankit', 1),
  ('accounting_person', 'Rajita', 2),
  ('accounting_person', 'Shruti', 3)
ON CONFLICT (list_type, name) DO NOTHING;

INSERT INTO public.client_dropdown_options (list_type, name, display_order) VALUES
  ('accounting_manager', 'Hiral Patel', 1)
ON CONFLICT (list_type, name) DO NOTHING;

COMMENT ON TABLE public.client_dropdown_options IS 'Stores dropdown options for client forms: client_manager, client_representative, salesperson, accounting_person, accounting_manager';
