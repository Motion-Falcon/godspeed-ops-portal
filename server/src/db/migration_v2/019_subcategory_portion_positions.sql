-- Subcategory position type (e.g. Miles, Bonus): stored on positions; options from client_dropdown_options (list_type = subcategory_portion).

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS subcategory_portion VARCHAR(100);

COMMENT ON COLUMN public.positions.subcategory_portion IS
  'For is_subcategory positions only: invoicing sub-portion label from configurable dropdown options; NULL for regular positions.';

ALTER TABLE public.position_drafts
  ADD COLUMN IF NOT EXISTS subcategory_portion VARCHAR(100);

COMMENT ON COLUMN public.position_drafts.subcategory_portion IS
  'Draft copy of subcategory_portion when applicable.';

INSERT INTO public.client_dropdown_options (list_type, name, display_order) VALUES
  ('subcategory_portion', 'Miles', 0),
  ('subcategory_portion', 'Bonus', 1)
ON CONFLICT (list_type, name) DO NOTHING;
