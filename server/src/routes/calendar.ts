import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { sanitizeInputs, apiRateLimiter } from '../middleware/security.js';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// Initialize Supabase client with service key for backend operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  jobseekerId: string;
  jobseekerName: string;
  positionId: string;
  positionTitle: string;
  clientId: string;
  clientName: string;
  totalPositions: number;
  assignedCount: number;
  availablePositions: number;
  allDay?: boolean;
}

interface CalendarResponse {
  events: CalendarEvent[];
  summary: {
    totalPositions: number;
    totalJobseekers: number;
    activeAssignments: number;
  };
}

/**
 * GET /api/calendar
 * Fetch calendar events for positions and jobseeker assignments
 * Query parameters:
 * - startDate: string (YYYY-MM-DD) - required
 * - endDate: string (YYYY-MM-DD) - required
 * - clientId: string (UUID) - optional filter
 * - jobseekerId: string (UUID) - optional filter
 */
router.get('/',
  // apiRateLimiter,
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, clientId, jobseekerId } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'startDate and endDate are required parameters'
        });
      }

      // Validate date format (basic check)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate as string) || !dateRegex.test(endDate as string)) {
        return res.status(400).json({
          success: false,
          message: 'Dates must be in YYYY-MM-DD format'
        });
      }

      // Build the query to get positions with their assignments
      let positionsQuery = supabase
        .from('positions')
        .select(`
          id,
          title,
          start_date,
          end_date,
          number_of_positions,
          client:clients!positions_client_fkey (
            id,
            company_name
          )
        `)
        .eq('is_draft', false)
        .gte('end_date', startDate)
        .lte('start_date', endDate);

      // Apply client filter if provided
      if (clientId) {
        positionsQuery = positionsQuery.eq('client', clientId);
      }

      const { data: positions, error: positionsError } = await positionsQuery;

      if (positionsError) {
        console.error('Error fetching positions:', positionsError);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch calendar data'
        });
      }

      if (!positions || positions.length === 0) {
        return res.json({
          success: true,
          data: {
            events: [],
            summary: {
              totalPositions: 0,
              totalJobseekers: 0,
              activeAssignments: 0
            }
          }
        });
      }

      // Get position IDs for fetching assignments
      const positionIds = positions.map(p => p.id);

      // Fetch assignments from position_candidate_assignments table
      let assignmentsQuery = supabase
        .from('position_candidate_assignments')
        .select(`
          id,
          position_id,
          candidate_id,
          start_date,
          end_date,
          status
        `)
        .in('position_id', positionIds)
        .gte('end_date', startDate)
        .lte('start_date', endDate);

      // Apply jobseeker filter if provided
      if (jobseekerId) {
        assignmentsQuery = assignmentsQuery.eq('candidate_id', jobseekerId);
      }

      const { data: assignments, error: assignmentsError } = await assignmentsQuery;

      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch assignment data'
        });
      }

      // Get unique candidate IDs (user_ids) from assignments
      const candidateIds = assignments ? [...new Set(assignments.map(a => a.candidate_id))] : [];
      
      // Fetch jobseeker profiles using user_id
      let jobseekers: any[] = [];
      if (candidateIds.length > 0) {
        const { data: jobseekerData, error: jobseekersError } = await supabase
          .from('jobseeker_profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', candidateIds);

        if (jobseekersError) {
          console.error('Error fetching jobseekers:', jobseekersError);
          return res.status(500).json({
            success: false,
            message: 'Failed to fetch jobseeker data'
          });
        }

        jobseekers = jobseekerData || [];
      }

      // Create lookup maps
      const positionMap = new Map();
      positions.forEach(pos => {
        positionMap.set(pos.id, pos);
      });

      const jobseekerMap = new Map();
      jobseekers.forEach(js => {
        jobseekerMap.set(js.user_id, `${js.first_name} ${js.last_name}`);
      });

      // Create a map to track assignments per position
      const positionAssignments = new Map();
      if (assignments && assignments.length > 0) {
        assignments.forEach(assignment => {
          if (!positionAssignments.has(assignment.position_id)) {
            positionAssignments.set(assignment.position_id, []);
          }
          positionAssignments.get(assignment.position_id).push(assignment);
        });
      }

      // Transform data into calendar events
      const events: CalendarEvent[] = [];
      let activeAssignments = 0;

      // Process positions and their assignments
      positions.forEach(position => {
        const client = position.client as any;
        const clientName = client?.company_name || 'Unknown Client';
        const clientId = client?.id || '';
        const totalPositions = position.number_of_positions || 1;
        
        const positionAssignmentsList = positionAssignments.get(position.id) || [];
        const assignedCount = positionAssignmentsList.length;
        const availablePositions = Math.max(0, totalPositions - assignedCount);

        // Add assigned position events
        if (positionAssignmentsList.length > 0) {
          positionAssignmentsList.forEach((assignment: any) => {
            const jobseekerName = jobseekerMap.get(assignment.candidate_id) || 'Unknown Jobseeker';

            events.push({
              id: `assignment_${assignment.id}`, // Use unique assignment ID
              title: `${jobseekerName} - ${position.title}`,
              start: assignment.start_date,
              end: assignment.end_date || assignment.start_date,
              jobseekerId: assignment.candidate_id,
              jobseekerName,
              positionId: position.id,
              positionTitle: position.title,
              clientId,
              clientName,
              totalPositions,
              assignedCount,
              availablePositions,
              allDay: true
            });
            
            activeAssignments++;
          });
        }

        // Add open position event if there are available spots and no jobseeker filter
        if (!jobseekerId && availablePositions > 0) {
          events.push({
            id: `position_open_${position.id}`, // Use unique position-based ID for open positions
            title: `${position.title} (${availablePositions} available)`,
            start: position.start_date,
            end: position.end_date || position.start_date,
            jobseekerId: '',
            jobseekerName: '',
            positionId: position.id,
            positionTitle: position.title,
            clientId,
            clientName,
            totalPositions,
            assignedCount,
            availablePositions,
            allDay: true
          });
        }
      });

      // Calculate summary statistics based on position capacity
      const totalPositionCapacity = positions.reduce((total, position) => {
        return total + (position.number_of_positions || 1);
      }, 0);

      const summary = {
        totalPositions: totalPositionCapacity, // Total capacity across all positions
        totalJobseekers: new Set(events.filter(e => e.jobseekerId).map(e => e.jobseekerId)).size,
        activeAssignments
      };

      res.json({
        success: true,
        data: {
          events,
          summary
        }
      });

    } catch (error) {
      console.error('Calendar endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * GET /api/calendar/summary
 * Fetch calendar summary statistics for a date range
 * Query parameters:
 * - startDate: string (YYYY-MM-DD) - required
 * - endDate: string (YYYY-MM-DD) - required
 * - clientId: string (UUID) - optional filter
 * - jobseekerId: string (UUID) - optional filter
 */
router.get('/summary',
  // apiRateLimiter,
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, clientId, jobseekerId } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'startDate and endDate are required parameters'
        });
      }

      // Validate date format (basic check)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate as string) || !dateRegex.test(endDate as string)) {
        return res.status(400).json({
          success: false,
          message: 'Dates must be in YYYY-MM-DD format'
        });
      }

      // Build the query to get positions with their assignments
      let positionsQuery = supabase
        .from('positions')
        .select(`
          id,
          title,
          start_date,
          end_date,
          number_of_positions,
          client:clients!positions_client_fkey (
            id,
            company_name
          )
        `)
        .eq('is_draft', false)
        .gte('end_date', startDate)
        .lte('start_date', endDate);

      // Apply client filter if provided
      if (clientId) {
        positionsQuery = positionsQuery.eq('client', clientId);
      }

      const { data: positions, error: positionsError } = await positionsQuery;

      if (positionsError) {
        console.error('Error fetching positions:', positionsError);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch calendar summary data'
        });
      }

      if (!positions || positions.length === 0) {
        return res.json({
          success: true,
          data: {
            totalPositions: 0,
            totalJobseekers: 0,
            activeAssignments: 0,
            availablePositions: 0,
            fillRate: 0,
            statusBreakdown: {
              active: 0,
              upcoming: 0,
              completed: 0,
              cancelled: 0
            },
            dateRange: {
              startDate: startDate as string,
              endDate: endDate as string
            }
          }
        });
      }

      // Get position IDs for fetching assignments
      const positionIds = positions.map(p => p.id);

      // Fetch assignments from position_candidate_assignments table
      let assignmentsQuery = supabase
        .from('position_candidate_assignments')
        .select(`
          id,
          position_id,
          candidate_id,
          start_date,
          end_date,
          status
        `)
        .in('position_id', positionIds)
        .gte('end_date', startDate)
        .lte('start_date', endDate);

      // Apply jobseeker filter if provided
      if (jobseekerId) {
        assignmentsQuery = assignmentsQuery.eq('candidate_id', jobseekerId);
      }

      const { data: assignments, error: assignmentsError } = await assignmentsQuery;

      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch assignment summary data'
        });
      }

      // Calculate summary statistics
      const totalPositionCapacity = positions.reduce((total, position) => {
        return total + (position.number_of_positions || 1);
      }, 0);

      const totalAssignments = assignments ? assignments.length : 0;
      const uniqueJobseekers = assignments ? new Set(assignments.map(a => a.candidate_id)).size : 0;
      const availablePositions = Math.max(0, totalPositionCapacity - totalAssignments);
      const fillRate = totalPositionCapacity > 0 ? Math.round((totalAssignments / totalPositionCapacity) * 100) : 0;

      // Calculate status breakdown
      const statusBreakdown = {
        active: 0,
        upcoming: 0,
        completed: 0,
        cancelled: 0
      };

      if (assignments) {
        assignments.forEach(assignment => {
          const status = assignment.status as keyof typeof statusBreakdown;
          if (statusBreakdown.hasOwnProperty(status)) {
            statusBreakdown[status]++;
          }
        });
      }

      const summary = {
        totalPositions: totalPositionCapacity,
        totalJobseekers: uniqueJobseekers,
        activeAssignments: totalAssignments,
        availablePositions,
        fillRate,
        statusBreakdown,
        dateRange: {
          startDate: startDate as string,
          endDate: endDate as string
        }
      };

      res.json({
        success: true,
        data: summary
      });

    } catch (error) {
      console.error('Calendar summary endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

export default router;
