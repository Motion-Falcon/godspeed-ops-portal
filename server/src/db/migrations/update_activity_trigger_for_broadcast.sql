-- Migration: Update activity trigger for real-time notifications
-- This migration updates the trigger function to use pg_notify for real-time updates

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS notify_activity_change() CASCADE;

-- Create the updated trigger function
CREATE OR REPLACE FUNCTION notify_activity_change()
RETURNS TRIGGER AS $$
DECLARE
    event_type TEXT;
    payload JSONB;
BEGIN
    -- Determine the event type
    IF TG_OP = 'INSERT' THEN
        event_type := 'INSERT';
        payload := jsonb_build_object(
            'eventType', event_type,
            'table', TG_TABLE_NAME,
            'timestamp', NOW(),
            'new', row_to_json(NEW)
        );
        PERFORM pg_notify('recent_activities_changes', payload::text);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        event_type := 'UPDATE';
        payload := jsonb_build_object(
            'eventType', event_type,
            'table', TG_TABLE_NAME,
            'timestamp', NOW(),
            'old', row_to_json(OLD),
            'new', row_to_json(NEW)
        );
        PERFORM pg_notify('recent_activities_changes', payload::text);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        event_type := 'DELETE';
        payload := jsonb_build_object(
            'eventType', event_type,
            'table', TG_TABLE_NAME,
            'timestamp', NOW(),
            'old', row_to_json(OLD)
        );
        PERFORM pg_notify('recent_activities_changes', payload::text);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- The trigger itself should already exist, but create it if it doesn't
-- CREATE TRIGGER recent_activities_trigger
--     AFTER INSERT OR UPDATE OR DELETE ON recent_activities
--     FOR EACH ROW
--     EXECUTE FUNCTION notify_activity_change(); 