-- Seed client_dropdown_options with existing hardcoded values
-- Run this after create_client_dropdown_options_table.sql

-- Client Managers
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

-- Client Representatives (same as client managers)
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

-- Sales Persons
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

-- Accounting Persons
INSERT INTO public.client_dropdown_options (list_type, name, display_order) VALUES
  ('accounting_person', 'Ankit', 1),
  ('accounting_person', 'Rajita', 2),
  ('accounting_person', 'Shruti', 3)
ON CONFLICT (list_type, name) DO NOTHING;

-- Accounting Managers
INSERT INTO public.client_dropdown_options (list_type, name, display_order) VALUES
  ('accounting_manager', 'Hiral Patel', 1)
ON CONFLICT (list_type, name) DO NOTHING;
