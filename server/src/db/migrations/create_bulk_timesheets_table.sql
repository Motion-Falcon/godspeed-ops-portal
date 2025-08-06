-- Create bulk_timesheets table
-- This table stores bulk timesheet records for multiple jobseekers

CREATE TABLE IF NOT EXISTS bulk_timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign key references
    client_id UUID NOT NULL,
    position_id UUID NOT NULL,
    
    -- Timesheet Information
    invoice_number VARCHAR(255) NOT NULL,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    week_period VARCHAR(255) NOT NULL,
    email_sent BOOLEAN DEFAULT FALSE,
    
    -- Grand Totals
    total_hours DECIMAL(10,2) DEFAULT 0,
    total_regular_hours DECIMAL(10,2) DEFAULT 0,
    total_overtime_hours DECIMAL(10,2) DEFAULT 0,
    total_overtime_pay DECIMAL(10,2) DEFAULT 0,
    total_jobseeker_pay DECIMAL(10,2) DEFAULT 0,
    total_client_bill DECIMAL(10,2) DEFAULT 0,
    total_bonus DECIMAL(10,2) DEFAULT 0,
    total_deductions DECIMAL(10,2) DEFAULT 0,
    net_pay DECIMAL(10,2) DEFAULT 0,
    
    -- Summary Counts
    number_of_jobseekers INTEGER DEFAULT 0,
    average_hours_per_jobseeker DECIMAL(10,2) DEFAULT 0,
    average_pay_per_jobseeker DECIMAL(10,2) DEFAULT 0,
    
    -- Jobseeker Timesheets Data (JSONB)
    jobseeker_timesheets JSONB NOT NULL,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_user_id UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by_user_id UUID,
    version INTEGER DEFAULT 1,
    
    -- Basic constraints
    CONSTRAINT bulk_timesheets_invoice_number_check CHECK (LENGTH(invoice_number) > 0),
    CONSTRAINT bulk_timesheets_week_start_date_check CHECK (week_start_date IS NOT NULL),
    CONSTRAINT bulk_timesheets_week_end_date_check CHECK (week_end_date IS NOT NULL),
    CONSTRAINT bulk_timesheets_week_dates_check CHECK (week_end_date >= week_start_date),
    CONSTRAINT bulk_timesheets_total_hours_check CHECK (total_hours >= 0),
    CONSTRAINT bulk_timesheets_number_of_jobseekers_check CHECK (number_of_jobseekers >= 0),
    CONSTRAINT bulk_timesheets_jobseeker_timesheets_check CHECK (jsonb_typeof(jobseeker_timesheets) = 'array')
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bulk_timesheets_client_id ON bulk_timesheets(client_id);
CREATE INDEX IF NOT EXISTS idx_bulk_timesheets_position_id ON bulk_timesheets(position_id);
CREATE INDEX IF NOT EXISTS idx_bulk_timesheets_invoice_number ON bulk_timesheets(invoice_number);
CREATE INDEX IF NOT EXISTS idx_bulk_timesheets_week_start_date ON bulk_timesheets(week_start_date);
CREATE INDEX IF NOT EXISTS idx_bulk_timesheets_week_end_date ON bulk_timesheets(week_end_date);
CREATE INDEX IF NOT EXISTS idx_bulk_timesheets_created_at ON bulk_timesheets(created_at);
CREATE INDEX IF NOT EXISTS idx_bulk_timesheets_created_by_user_id ON bulk_timesheets(created_by_user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bulk_timesheets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bulk_timesheets_updated_at_trigger
    BEFORE UPDATE ON bulk_timesheets
    FOR EACH ROW
    EXECUTE FUNCTION update_bulk_timesheets_updated_at();

-- Add comments for documentation
COMMENT ON TABLE bulk_timesheets IS 'Stores bulk timesheet records for multiple jobseekers';
COMMENT ON COLUMN bulk_timesheets.client_id IS 'Reference to the client';
COMMENT ON COLUMN bulk_timesheets.position_id IS 'Reference to the position';
COMMENT ON COLUMN bulk_timesheets.invoice_number IS 'Unique invoice number for this bulk timesheet';
COMMENT ON COLUMN bulk_timesheets.week_start_date IS 'Start date of the week period';
COMMENT ON COLUMN bulk_timesheets.week_end_date IS 'End date of the week period';
COMMENT ON COLUMN bulk_timesheets.week_period IS 'Human readable week period string';
COMMENT ON COLUMN bulk_timesheets.email_sent IS 'Whether email notifications were sent';
COMMENT ON COLUMN bulk_timesheets.jobseeker_timesheets IS 'JSON array containing individual jobseeker timesheet data'; 