-- Seed list_name dropdown options from the previously hardcoded LIST_NAMES constant.
-- Run this to migrate list names into the client_dropdown_options table.

INSERT INTO public.client_dropdown_options (list_type, name, display_order) VALUES
  ('list_name', 'AA', 1),
  ('list_name', 'AB', 2),
  ('list_name', 'CANHIRE BRAMPTON', 3),
  ('list_name', 'CANHIRE LONDON', 4),
  ('list_name', 'KITCHENER', 5),
  ('list_name', 'PRONTO PRO', 6),
  ('list_name', 'SA', 7),
  ('list_name', 'SB', 8),
  ('list_name', 'SCARBOROUGH', 9)
ON CONFLICT (list_type, name) DO NOTHING;
