-- Enable realtime for recent_activities table
ALTER PUBLICATION supabase_realtime ADD TABLE recent_activities;

-- Enable Row Level Security on recent_activities
ALTER TABLE recent_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for recent_activities

-- Policy: Users can view activities they are involved in (as actor or related to their data)
CREATE POLICY "Users can view their own activities" ON recent_activities
    FOR SELECT USING (
        auth.uid()::text = actor_id::text OR
        auth.uid()::text = primary_entity_id::text OR
        auth.uid()::text = secondary_entity_id::text OR
        auth.uid()::text = tertiary_entity_id::text
    );

-- Policy: Authenticated users can insert activities (for logging their own actions)
CREATE POLICY "Authenticated users can insert activities" ON recent_activities
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND
        auth.uid()::text = actor_id::text
    );

-- Policy: Users can update activities where they are the actor (for status updates)
CREATE POLICY "Users can update their own activities" ON recent_activities
    FOR UPDATE USING (
        auth.uid()::text = actor_id::text
    ) WITH CHECK (
        auth.uid()::text = actor_id::text
    );

-- Policy: Service role can do everything (for server-side operations)
CREATE POLICY "Service role has full access" ON recent_activities
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Enable RLS on lookup tables as well
ALTER TABLE activity_action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_categories ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read lookup tables
CREATE POLICY "Anyone can read action types" ON activity_action_types
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can read categories" ON activity_categories
    FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can manage lookup tables
CREATE POLICY "Service role can manage action types" ON activity_action_types
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage categories" ON activity_categories
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create a function to notify about new activities (optional, for additional broadcast capability)
CREATE OR REPLACE FUNCTION notify_activity_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Send a notification with the activity data
    PERFORM pg_notify(
        'activity_change',
        json_build_object(
            'operation', TG_OP,
            'record', row_to_json(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END),
            'table', TG_TABLE_NAME,
            'timestamp', extract(epoch from now())
        )::text
    );
    
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for activity notifications (optional)
CREATE TRIGGER activity_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON recent_activities
    FOR EACH ROW EXECUTE FUNCTION notify_activity_change();

-- Grant necessary permissions
GRANT SELECT ON recent_activities TO authenticated;
GRANT INSERT ON recent_activities TO authenticated;
GRANT UPDATE ON recent_activities TO authenticated;

GRANT SELECT ON activity_action_types TO authenticated;
GRANT SELECT ON activity_categories TO authenticated;

-- Grant full access to service role
GRANT ALL ON recent_activities TO service_role;
GRANT ALL ON activity_action_types TO service_role;
GRANT ALL ON activity_categories TO service_role; 