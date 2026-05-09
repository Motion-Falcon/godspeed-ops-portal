-- Migration 022: Refactor subcategory positions (group_id and primary flags)

-- 1. Add schema columns
ALTER TABLE public.positions 
  ADD COLUMN IF NOT EXISTS subcategory_group_id UUID DEFAULT NULL;

COMMENT ON COLUMN public.positions.subcategory_group_id IS 
  'UUID linking multiple position rows that belong to the same subcategory group (e.g. Bonus, Miles)';

ALTER TABLE public.position_drafts
  ADD COLUMN IF NOT EXISTS subcategory_group_id UUID DEFAULT NULL;

COMMENT ON COLUMN public.position_drafts.subcategory_group_id IS
  'UUID for draft subcategory group if needed.';

ALTER TABLE public.positions 
  ADD COLUMN IF NOT EXISTS is_primary_subcategory BOOLEAN DEFAULT false;

-- 2. Drop the old unique constraints on position_code
ALTER TABLE public.positions DROP CONSTRAINT IF EXISTS unique_position_code;
ALTER TABLE public.positions DROP CONSTRAINT IF EXISTS positions_position_code_key;

-- 2.5 Change subcategory_position from text[] back to VARCHAR since rows are now split per type
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='positions' AND column_name='subcategory_position' AND data_type='ARRAY'
  ) THEN
    ALTER TABLE public.positions ALTER COLUMN subcategory_position TYPE VARCHAR(100) USING array_to_string(subcategory_position::text[], ',');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='position_drafts' AND column_name='subcategory_position' AND data_type='ARRAY'
  ) THEN
    ALTER TABLE public.position_drafts ALTER COLUMN subcategory_position TYPE VARCHAR(100) USING array_to_string(subcategory_position::text[], ',');
  END IF;
END $$;

-- 3. Create a new unique index that considers the subcategory_position
CREATE UNIQUE INDEX IF NOT EXISTS unique_position_code_subcategory_idx 
  ON public.positions (position_code, COALESCE(subcategory_position, ''));

-- 4. Data migration
DO $$
DECLARE
  pos RECORD;
  det RECORD;
  new_group_id UUID;
  new_pos_id UUID;
  is_first BOOLEAN;
BEGIN
  FOR pos IN
    SELECT * FROM public.positions WHERE is_subcategory = true AND subcategory_group_id IS NULL
  LOOP
    new_group_id := uuid_generate_v4();
    is_first := true;

    FOR det IN
      SELECT * FROM public.position_subcategory_position_details WHERE position_id = pos.id
    LOOP
      -- Check if this specific sibling row was already created in a previous failed run
      SELECT id INTO new_pos_id 
      FROM public.positions 
      WHERE position_code = pos.position_code 
        AND COALESCE(subcategory_position, '') = COALESCE(det.subcategory_position, '');

      IF new_pos_id IS NULL THEN
        new_pos_id := uuid_generate_v4();

        INSERT INTO public.positions (
          id, client, title, position_code, start_date, end_date, show_on_job_portal, stat, client_manager, sales_manager,
          position_number, description, street_address, city, province, postal_code, employment_term, employment_type,
          position_category, experience, documents_required, payrate_type, number_of_positions, regular_pay_rate, markup,
          bill_rate, overtime_enabled, overtime_hours, overtime_bill_rate, overtime_pay_rate, preferred_payment_method,
          terms, notes, assigned_to, proj_comp_date, task_time, assigned_jobseekers, client_name, is_draft, created_at,
          created_by_user_id, updated_at, updated_by_user_id, is_subcategory, subcategory_position, subcategory_group_id, premium_pay_rate,
          is_primary_subcategory
        ) VALUES (
          new_pos_id, pos.client, pos.title || ' - ' || det.subcategory_position, pos.position_code, pos.start_date, pos.end_date, pos.show_on_job_portal, pos.stat, pos.client_manager, pos.sales_manager,
          pos.position_number, pos.description, pos.street_address, pos.city, pos.province, pos.postal_code, pos.employment_term, pos.employment_type,
          pos.position_category, pos.experience, pos.documents_required, det.payrate_type, det.number_of_positions, det.regular_pay_rate, det.markup,
          det.bill_rate, pos.overtime_enabled, pos.overtime_hours, pos.overtime_bill_rate, pos.overtime_pay_rate, pos.preferred_payment_method,
          pos.terms, pos.notes, pos.assigned_to, pos.proj_comp_date, pos.task_time, pos.assigned_jobseekers, pos.client_name, pos.is_draft, pos.created_at,
          pos.created_by_user_id, pos.updated_at, pos.updated_by_user_id, true, det.subcategory_position, new_group_id, det.premium_pay_rate,
          is_first -- only the first iteration is marked as primary
        );
      END IF;

      -- Update existing timesheets/invoices that pointed to the parent position
      IF is_first THEN
        UPDATE public.timesheets SET position_id = new_pos_id WHERE position_id = pos.id;
        is_first := false;
      END IF;
    END LOOP;

    -- Delete the old parent position (this cascades and deletes from position_subcategory_position_details)
    DELETE FROM public.positions WHERE id = pos.id;

  END LOOP;
END $$;

-- 5. Drop the old table completely
DROP TABLE IF EXISTS public.position_subcategory_position_details CASCADE;
