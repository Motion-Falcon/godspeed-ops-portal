-- Migration: Create Complete Timesheets Table
-- Description: Creates a comprehensive timesheets table with document storage and auto-incrementing invoice numbers
-- Combines: create_timesheets_single_table.sql, add_document_field_to_timesheets.sql, add_invoice_number_to_timesheets.sql
-- Author: System Generated
-- Date: 2024

-- Create the complete timesheets table
CREATE TABLE IF NOT EXISTS public.timesheets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Jobseeker identification
    jobseeker_profile_id UUID NOT NULL REFERENCES public.jobseeker_profiles(id) ON DELETE CASCADE,
    jobseeker_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Assignment identification
    assignment_id UUID NOT NULL REFERENCES public.position_candidate_assignments(id) ON DELETE CASCADE,
    position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
    
    -- Week identification
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    
    -- Daily hours stored as JSONB for flexibility
    -- Format: [{"date": "2024-01-01", "hours": 8.0}, {"date": "2024-01-02", "hours": 7.5}]
    daily_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Weekly calculations
    total_regular_hours DECIMAL(5,2) DEFAULT 0 NOT NULL,
    total_overtime_hours DECIMAL(5,2) DEFAULT 0 NOT NULL,
    regular_pay_rate DECIMAL(10,2) DEFAULT 0 NOT NULL,
    overtime_pay_rate DECIMAL(10,2) DEFAULT 0 NOT NULL,
    regular_bill_rate DECIMAL(10,2) DEFAULT 0 NOT NULL,
    overtime_bill_rate DECIMAL(10,2) DEFAULT 0 NOT NULL,
    total_jobseeker_pay DECIMAL(10,2) DEFAULT 0 NOT NULL,
    total_client_bill DECIMAL(10,2) DEFAULT 0 NOT NULL,
    overtime_enabled BOOLEAN DEFAULT FALSE,
    markup DECIMAL(5,2),
    
    -- Document storage for PDF files
    document TEXT,
    
    -- Auto-incrementing invoice number
    invoice_number VARCHAR(6) UNIQUE NOT NULL,
    
    -- Status and metadata
    email_sent BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by_user_id UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_by_user_id UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT timesheets_week_dates_check CHECK (week_end_date > week_start_date),
    CONSTRAINT timesheets_week_span_check CHECK (week_end_date - week_start_date = 6), -- Exactly 7 days
    CONSTRAINT timesheets_hours_positive CHECK (
        total_regular_hours >= 0 AND total_overtime_hours >= 0
    ),
    CONSTRAINT timesheets_rates_positive CHECK (
        regular_pay_rate >= 0 AND overtime_pay_rate >= 0 AND 
        regular_bill_rate >= 0 AND overtime_bill_rate >= 0
    ),
    CONSTRAINT timesheets_pay_positive CHECK (
        total_jobseeker_pay >= 0 AND total_client_bill >= 0
    ),
    
    -- Unique constraint: one timesheet per assignment per week
    CONSTRAINT timesheets_unique UNIQUE (assignment_id, week_start_date)
);

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS timesheet_invoice_seq 
START WITH 1 
INCREMENT BY 1 
MINVALUE 1 
MAXVALUE 999999 
CACHE 1;

-- Create function to generate formatted invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR(6) AS $$
DECLARE
    next_val INTEGER;
BEGIN
    next_val := nextval('timesheet_invoice_seq');
    RETURN LPAD(next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Set default value for invoice_number column
ALTER TABLE public.timesheets 
ALTER COLUMN invoice_number SET DEFAULT generate_invoice_number();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_timesheets_jobseeker_profile_id ON public.timesheets(jobseeker_profile_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_jobseeker_user_id ON public.timesheets(jobseeker_user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_assignment_id ON public.timesheets(assignment_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_position_id ON public.timesheets(position_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_week_start_date ON public.timesheets(week_start_date);
CREATE INDEX IF NOT EXISTS idx_timesheets_week_end_date ON public.timesheets(week_end_date);
CREATE INDEX IF NOT EXISTS idx_timesheets_created_by ON public.timesheets(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_email_sent ON public.timesheets(email_sent);
CREATE INDEX IF NOT EXISTS idx_timesheets_document ON public.timesheets(document) WHERE document IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_invoice_number ON public.timesheets(invoice_number);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_timesheets_updated_at 
    BEFORE UPDATE ON public.timesheets 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to ensure invoice_number is always generated for new records
CREATE OR REPLACE FUNCTION ensure_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL THEN
        NEW.invoice_number := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_invoice_number
    BEFORE INSERT ON public.timesheets
    FOR EACH ROW
    EXECUTE FUNCTION ensure_invoice_number();

-- Enable Row Level Security (RLS)
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Jobseekers can view their own timesheets
CREATE POLICY "Jobseekers can view own timesheets" ON public.timesheets
    FOR SELECT USING (
        auth.uid() = jobseeker_user_id OR
        auth.uid() IN (
            SELECT user_id FROM public.jobseeker_profiles 
            WHERE id = jobseeker_profile_id
        )
    );

-- Policy: Jobseekers can insert their own timesheets
CREATE POLICY "Jobseekers can insert own timesheets" ON public.timesheets
    FOR INSERT WITH CHECK (
        auth.uid() = jobseeker_user_id OR
        auth.uid() IN (
            SELECT user_id FROM public.jobseeker_profiles 
            WHERE id = jobseeker_profile_id
        )
    );

-- Policy: Jobseekers can update their own timesheets
CREATE POLICY "Jobseekers can update own timesheets" ON public.timesheets
    FOR UPDATE USING (
        auth.uid() = jobseeker_user_id OR
        auth.uid() IN (
            SELECT user_id FROM public.jobseeker_profiles 
            WHERE id = jobseeker_profile_id
        )
    );

-- Policy: Recruiters and admins can view all timesheets
CREATE POLICY "Recruiters and admins can view all timesheets" ON public.timesheets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND (
                (raw_user_meta_data->>'user_type')::text = 'recruiter' OR
                (raw_user_meta_data->>'user_type')::text = 'admin'
            )
        )
    );

-- Policy: Recruiters and admins can update all timesheets
CREATE POLICY "Recruiters and admins can update all timesheets" ON public.timesheets
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND (
                (raw_user_meta_data->>'user_type')::text = 'recruiter' OR
                (raw_user_meta_data->>'user_type')::text = 'admin'
            )
        )
    );

-- Add helpful comments
COMMENT ON TABLE public.timesheets IS 'Stores weekly timesheet submissions - one record per assignment per week (single table design). Includes document storage for PDF files and auto-generated invoice numbers.';

COMMENT ON COLUMN public.timesheets.jobseeker_profile_id IS 'Reference to jobseeker_profiles table';
COMMENT ON COLUMN public.timesheets.jobseeker_user_id IS 'Reference to auth.users table for the jobseeker';
COMMENT ON COLUMN public.timesheets.assignment_id IS 'Reference to position_candidate_assignments table';
COMMENT ON COLUMN public.timesheets.position_id IS 'Reference to positions table';
COMMENT ON COLUMN public.timesheets.week_start_date IS 'Start date of the work week (typically Sunday)';
COMMENT ON COLUMN public.timesheets.week_end_date IS 'End date of the work week (typically Saturday)';
COMMENT ON COLUMN public.timesheets.daily_hours IS 'JSON array of daily hour entries: [{"date": "2024-01-01", "hours": 8.0}]';
COMMENT ON COLUMN public.timesheets.total_regular_hours IS 'Total regular hours worked for the week';
COMMENT ON COLUMN public.timesheets.total_overtime_hours IS 'Total overtime hours worked for the week';
COMMENT ON COLUMN public.timesheets.markup IS 'Markup percentage applied to billing rates';
COMMENT ON COLUMN public.timesheets.document IS 'File path or URL to the generated timesheet PDF document';
COMMENT ON COLUMN public.timesheets.invoice_number IS 'Auto-generated invoice number in format 000001, 000002, etc.';
COMMENT ON COLUMN public.timesheets.email_sent IS 'Whether notification email has been sent';

-- Verification queries (uncomment to test after running migration)
-- SELECT invoice_number, id, created_at FROM public.timesheets ORDER BY created_at LIMIT 10;
-- SELECT MAX(invoice_number) as latest_invoice FROM public.timesheets;
-- SELECT COUNT(*) as total_timesheets, COUNT(DISTINCT invoice_number) as unique_invoices FROM public.timesheets;
-- SELECT document, invoice_number FROM public.timesheets WHERE document IS NOT NULL LIMIT 5; 