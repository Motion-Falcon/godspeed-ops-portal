import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

// Type definitions for recent activities
export interface RecentActivity {
  id: string;
  created_at: string;
  actor_id: string;
  actor_name: string;
  actor_type: string;
  action_type:
    | "delete_jobseeker"
    | "create_client"
    | "create_timesheet"
    | "update_client"
    | "assign_jobseeker"
    | "reject_jobseeker"
    | "create_position"
    | "delete_position"
    | "pending_jobseeker"
    | "update_timesheet"
    | "delete_invoice"
    | "delete_timesheet"
    | "verify_jobseeker"
    | "update_invoice"
    | "update_jobseeker"
    | "delete_client"
    | "remove_jobseeker"
    | "create_invoice"
    | "update_position"
    | "create_jobseeker"
    | "user_registration"
    | "create_client_draft"
    | "update_client_draft"
    | "delete_client_draft"
    | "create_position_draft"
    | "update_position_draft"
    | "delete_position_draft"
    | "create_bulk_timesheet"
    | "update_bulk_timesheet"
    | "delete_bulk_timesheet"
    | "send_bulk_timesheet_email"
    | "send_invoice_email"
    // User management actions
    | "update_user_manager"
    | "update_user_roles"
    // Consent management actions
    | "create_consent_request"
    | "user_consent_given"
    | "resend_consent_request";
  action_verb: string;
  primary_entity_type: string;
  primary_entity_id?: string;
  primary_entity_name?: string;
  secondary_entity_type?: string;
  secondary_entity_id?: string;
  secondary_entity_name?: string;
  tertiary_entity_type?: string;
  tertiary_entity_id?: string;
  tertiary_entity_name?: string;
  status?: string;
  metadata: Record<string, unknown>;
  display_message: string;
  category: "position_management" | "client_management" | "financial" | "system" | "candidate_management" | "user_management";
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_deleted: boolean;
}

interface UseRecentActivitiesOptions {
  limit?: number;
  category?: string;
  actorId?: string;
  enabled?: boolean;
}

interface UseRecentActivitiesReturn {
  activities: RecentActivity[];
  isConnected: boolean;
  error: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  retry: () => void;
  loadMore: () => void;
}

export function useRecentActivities(options: UseRecentActivitiesOptions = {}): UseRecentActivitiesReturn {
  const {
    limit = 10,
    category,
    actorId,
    enabled = true
  } = options;

  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Function to fetch initial activities
  const fetchInitialActivities = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setCurrentOffset(0);
    
    try {
      console.log('Fetching initial activities...');
      
      let query = supabase
        .from('recent_activities')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      // Apply filters if provided
      if (category) {
        query = query.eq('category', category);
      }
      
      if (actorId) {
        query = query.eq('actor_id', actorId);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) {
        console.error('Error fetching initial activities:', fetchError);
        setError(`Failed to load activities: ${fetchError.message}`);
        setIsLoading(false);
        return;
      }
      
      console.log('Fetched initial activities:', data?.length || 0);
      setActivities(data || []);
      setCurrentOffset(data?.length || 0);
      setHasMore((data?.length || 0) === limit);
      setIsLoading(false);
      
    } catch (err) {
      console.error('Error in fetchInitialActivities:', err);
      setError('Failed to load activities');
      setIsLoading(false);
    }
  }, [enabled, limit, category, actorId]);

  // Function to load more activities
  const loadMore = useCallback(async () => {
    if (!enabled || isLoadingMore || !hasMore) {
      return;
    }
    
    setIsLoadingMore(true);
    setError(null);
    
    try {
      console.log('Loading more activities...', { currentOffset });
      
      let query = supabase
        .from('recent_activities')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + 19); // Load 20 more
      
      // Apply filters if provided
      if (category) {
        query = query.eq('category', category);
      }
      
      if (actorId) {
        query = query.eq('actor_id', actorId);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) {
        console.error('Error loading more activities:', fetchError);
        setError(`Failed to load more activities: ${fetchError.message}`);
        setIsLoadingMore(false);
        return;
      }
      
      console.log('Loaded more activities:', data?.length || 0);
      
      if (data && data.length > 0) {
        setActivities(prev => [...prev, ...data]);
        setCurrentOffset(prev => prev + data.length);
        setHasMore(data.length === 20); // If we got less than 20, there are no more
      } else {
        setHasMore(false);
      }
      
      // Add a small delay to ensure smooth transition from skeleton to content
      setTimeout(() => {
        setIsLoadingMore(false);
      }, 500);
      
    } catch (err) {
      console.error('Error in loadMore:', err);
      setError('Failed to load more activities');
      setIsLoadingMore(false);
    }
  }, [enabled, isLoadingMore, hasMore, currentOffset, category, actorId]);

  // Function to handle realtime updates from broadcast
  const handleRealtimeUpdate = useCallback((payload: { 
    eventType: string; 
    new?: RecentActivity; 
    old?: RecentActivity; 
  }) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
      case 'INSERT':
        if (newRecord && !newRecord.is_deleted) {
          // Apply client-side filtering
          if (category && newRecord.category !== category) return;
          if (actorId && newRecord.actor_id !== actorId) return;
          
          setActivities(prev => {
            // Add new activity at the beginning
            const updated = [newRecord, ...prev];
            // Don't slice here - let user see all activities they've loaded
            return updated;
          });
          setCurrentOffset(prev => prev + 1);
          
          // Clear loading state when real-time data arrives to ensure immediate visibility
          console.log('Real-time activity received, clearing isLoadingMore state');
          setIsLoadingMore(false);
        }
        break;
        
      case 'UPDATE':
        if (newRecord) {
          setActivities(prev => {
            return prev.map(activity => 
              activity.id === newRecord.id ? newRecord : activity
            ).filter(activity => {
              // Remove if deleted or doesn't match filters
              if (activity.is_deleted) return false;
              if (category && activity.category !== category) return false;
              if (actorId && activity.actor_id !== actorId) return false;
              return true;
            });
          });
        }
        break;
        
      case 'DELETE':
        if (oldRecord) {
          setActivities(prev => prev.filter(activity => activity.id !== oldRecord.id));
          setCurrentOffset(prev => Math.max(0, prev - 1));
        }
        break;
        
      default:
        console.log('Unknown event type:', eventType);
    }
  }, [category, actorId]);

  // Fetch initial data on mount
  useEffect(() => {
    fetchInitialActivities();
  }, [fetchInitialActivities]);

  // Setup realtime subscription using Postgres Changes
  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }

    console.log('Setting up real-time Postgres Changes subscription...');

    // Create channel for recent activities changes
    const channel = supabase
      .channel('recent-activities-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'recent_activities'
        },
        (payload) => {
          console.log('Received postgres change:', payload);
          
          // Transform the payload to match our expected format
          const transformedPayload = {
            eventType: payload.eventType,
            new: payload.new as RecentActivity,
            old: payload.old as RecentActivity
          };
          
          handleRealtimeUpdate(transformedPayload);
        }
      )
      .subscribe((status, err) => {
        console.log('Postgres Changes subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (err || status === 'CLOSED') {
          setError('Failed to connect to real-time updates');
          console.error('Subscription error:', err);
        } else if (status === 'SUBSCRIBED') {
          setError(null);
          console.log('Successfully connected to real-time Postgres Changes');
        }
      });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      console.log('Cleaning up Postgres Changes subscription...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled, handleRealtimeUpdate]);

  return {
    activities,
    isConnected,
    error,
    isLoading,
    isLoadingMore,
    hasMore,
    retry: fetchInitialActivities,
    loadMore
  };
} 