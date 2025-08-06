-- Create enum lookup tables for dynamic validation
CREATE TABLE activity_action_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE activity_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial action types
INSERT INTO activity_action_types (code, name, description) VALUES
    ('assign_jobseeker', 'Assign Jobseeker', 'Assign a jobseeker to a position'),
    ('verify_jobseeker', 'Verify Jobseeker', 'Verify jobseeker credentials and documents'),
    ('reject_jobseeker', 'Reject Jobseeker', 'Reject a jobseeker application'),
    ('pending_jobseeker', 'Pending Jobseeker', 'Mark jobseeker as pending review'),
    ('create_client', 'Create Client', 'Create a new client record'),
    ('update_client', 'Update Client', 'Update client information'),
    ('delete_client', 'Delete Client', 'Delete a client record'),
    ('create_position', 'Create Position', 'Create a new job position'),
    ('update_position', 'Update Position', 'Update position details'),
    ('delete_position', 'Delete Position', 'Delete a job position'),
    ('remove_jobseeker', 'Remove Jobseeker', 'Remove a jobseeker from a position'),
    ('create_timesheet', 'Create Timesheet', 'Create a new employee timesheet'),
    ('update_timesheet', 'Update Timesheet', 'Update employee timesheet'),
    ('delete_timesheet', 'Delete Timesheet', 'Delete an employee timesheet'),
    ('update_invoice', 'Update Invoice', 'Update client invoice'),
    ('create_jobseeker', 'Create Jobseeker', 'Create new jobseeker profile'),
    ('update_jobseeker', 'Update Jobseeker', 'Update jobseeker information'),
    ('delete_jobseeker', 'Delete Jobseeker', 'Delete a jobseeker profile');

-- Insert initial categories
INSERT INTO activity_categories (code, name, description) VALUES
    ('candidate_management', 'Candidate Management', 'Activities related to managing jobseekers and candidates'),
    ('client_management', 'Client Management', 'Activities related to managing clients'),
    ('position_management', 'Position Management', 'Activities related to managing job positions'),
    ('financial', 'Financial', 'Activities related to invoices, timesheets, and financial operations'),
    ('system', 'System', 'System-generated activities and administrative tasks');

CREATE TABLE recent_activities (
    -- Primary identification
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Actor information (who performed the action)
    actor_id UUID NOT NULL,
    actor_name TEXT NOT NULL,
    actor_type TEXT NOT NULL DEFAULT 'recruiter', -- recruiter, admin, system
    
    -- Action details (now references lookup tables)
    action_type TEXT NOT NULL REFERENCES activity_action_types(code),
    action_verb TEXT NOT NULL, -- assigned, verified, rejected, created, updated
    
    -- Primary entity (main subject of the action)
    primary_entity_type TEXT NOT NULL, -- jobseeker, client, position, timesheet, invoice
    primary_entity_id UUID,
    primary_entity_name TEXT,
    
    -- Secondary entity (related entity if applicable)
    secondary_entity_type TEXT, -- position, client, jobseeker
    secondary_entity_id UUID,
    secondary_entity_name TEXT,
    
    -- Tertiary entity (for complex relationships like "assigned jobseeker to position for client")
    tertiary_entity_type TEXT, -- client
    tertiary_entity_id UUID,
    tertiary_entity_name TEXT,
    
    -- Status/outcome of the action
    status TEXT, -- pending, verified, rejected, completed, etc.
    
    -- Flexible metadata for action-specific details
    metadata JSONB DEFAULT '{}',
    
    -- Pre-computed display message for performance
    display_message TEXT NOT NULL,
    
    -- Categorization and filtering (now references lookup table)
    category TEXT NOT NULL REFERENCES activity_categories(code),
    priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
    
    -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Indexes for optimal query performance
CREATE INDEX idx_recent_activities_actor_id ON recent_activities(actor_id);
CREATE INDEX idx_recent_activities_created_at ON recent_activities(created_at DESC);
CREATE INDEX idx_recent_activities_category ON recent_activities(category);
CREATE INDEX idx_recent_activities_action_type ON recent_activities(action_type);
CREATE INDEX idx_recent_activities_primary_entity ON recent_activities(primary_entity_type, primary_entity_id);
CREATE INDEX idx_recent_activities_display ON recent_activities(is_deleted, created_at DESC) WHERE is_deleted = FALSE;

-- Composite index for common queries
CREATE INDEX idx_recent_activities_actor_category_date ON recent_activities(actor_id, category, created_at DESC);

-- Indexes for lookup tables
CREATE INDEX idx_activity_action_types_active ON activity_action_types(is_active, code);
CREATE INDEX idx_activity_categories_active ON activity_categories(is_active, code);