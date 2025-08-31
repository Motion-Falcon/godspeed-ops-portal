/**
 * Activity Logger Middleware for Express.js
 * 
 * This middleware provides flexible activity logging capabilities for Express routes.
 * It supports various logging patterns and can be configured to log activities at different
 * points in the request lifecycle.
 * 
 * USAGE EXAMPLES:
 * 
 * 1. Direct Activity Data (simplest approach):
 * ```typescript
 * router.post('/clients',
 *   activityLogger({
 *     activityData: {
 *       actionType: 'create_client',
 *       actionVerb: 'created',
 *       primaryEntityType: 'client',
 *       primaryEntityId: 'client-123',
 *       primaryEntityName: 'ACME Corp',
 *       displayMessage: 'Created client "ACME Corp"',
 *       category: 'client_management',
 *       priority: 'normal'
 *     }
 *   }),
 *   handlerFunction
 * );
 * ```
 * 
 * 2. Dynamic Activity Data (access to req/res):
 * ```typescript
 * router.post('/clients',
 *   activityLogger({
 *     activityData: (req, res) => ({
 *       actionType: 'create_client',
 *       actionVerb: 'created',
 *       primaryEntityType: 'client',
 *       primaryEntityName: req.body.companyName,
 *       displayMessage: `Created client "${req.body.companyName}"`,
 *       category: 'client_management',
 *       priority: 'normal',
 *       metadata: {
 *         shortCode: req.body.shortCode,
 *         clientManager: req.body.clientManager
 *       }
 *     })
 *   }),
 *   handlerFunction
 * );
 * ```
 * 
 * 3. Success-based Logging (log only on successful operations):
 * ```typescript
 * router.post('/clients',
 *   activityLogger({
 *     onSuccess: (req, res) => ({
 *       actionType: 'create_client',
 *       actionVerb: 'created',
 *       primaryEntityType: 'client',
 *       primaryEntityId: res.locals.newClient?.id, // Set in handler
 *       primaryEntityName: req.body.companyName,
 *       displayMessage: `Created client "${req.body.companyName}"`,
 *       category: 'client_management',
 *       priority: 'normal'
 *     })
 *   }),
 *   async (req, res) => {
 *     // ... handler logic ...
 *     res.locals.newClient = createdClient; // Store for activity logging
 *     res.json({ success: true, client: createdClient });
 *   }
 * );
 * ```
 * 
 * 4. Error Logging:
 * ```typescript
 * router.delete('/clients/:id',
 *   activityLogger({
 *     onSuccess: (req, res) => ({
 *       actionType: 'delete_client',
 *       actionVerb: 'deleted',
 *       primaryEntityType: 'client',
 *       primaryEntityId: req.params.id,
 *       displayMessage: `Deleted client`,
 *       category: 'client_management',
 *       priority: 'high'
 *     }),
 *     onError: (req, res, error) => ({
 *       actionType: 'delete_client_failed',
 *       actionVerb: 'failed to delete',
 *       primaryEntityType: 'client',
 *       primaryEntityId: req.params.id,
 *       displayMessage: `Failed to delete client: ${error.message}`,
 *       category: 'client_management',
 *       priority: 'high',
 *       status: 'error'
 *     })
 *   }),
 *   handlerFunction
 * );
 * ```
 * 
 * 5. Before/After Operation Logging:
 * ```typescript
 * router.put('/clients/:id',
 *   activityLogger({
 *     beforeOperation: (req, res) => ({
 *       actionType: 'update_client_started',
 *       actionVerb: 'started updating',
 *       primaryEntityType: 'client',
 *       primaryEntityId: req.params.id,
 *       displayMessage: `Started updating client`,
 *       category: 'client_management',
 *       priority: 'low'
 *     }),
 *     afterOperation: (req, res) => ({
 *       actionType: 'update_client_completed',
 *       actionVerb: 'completed updating',
 *       primaryEntityType: 'client',
 *       primaryEntityId: req.params.id,
 *       displayMessage: `Completed updating client`,
 *       category: 'client_management',
 *       priority: 'normal'
 *     })
 *   }),
 *   handlerFunction
 * );
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client with service key for admin operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials for activity logger');
}

const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);

// Interface for activity data to be logged
export interface ActivityData {
  actionType:
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
  | "complete_onboarding"
  | "invite_recruiter"
  | "resend_invitation"
  | "create_consent_request"
  | "resend_consent_request"
  | "user_consent_given";
  actionVerb: string;
  primaryEntityType: string;
  primaryEntityId?: string;
  primaryEntityName?: string;
  secondaryEntityType?: string;
  secondaryEntityId?: string;
  secondaryEntityName?: string;
  tertiaryEntityType?: string;
  tertiaryEntityId?: string;
  tertiaryEntityName?: string;
  status?: string;
  metadata?: Record<string, any>;
  displayMessage: string;
  category: "position_management" | "client_management" | "financial" | "system" | "candidate_management" | "user_management" | "consent_management";
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

// Interface for middleware options
interface ActivityLoggerOptions {
  skipOnError?: boolean; // Whether to skip logging if the main operation fails
  onSuccess?: (req: Request, res: Response) => ActivityData | Promise<ActivityData>;
  onError?: (req: Request, res: Response, error: any) => ActivityData | Promise<ActivityData>;
  beforeOperation?: (req: Request, res: Response) => ActivityData | Promise<ActivityData>;
  afterOperation?: (req: Request, res: Response, result?: any) => ActivityData | Promise<ActivityData>;
  // Add direct activity data option
  activityData?: ActivityData | ((req: Request, res: Response) => ActivityData | Promise<ActivityData>);
}

/**
 * Activity Logger Middleware
 * 
 * This middleware captures activities and logs them to the recent_activities table.
 * It can be configured to log activities at different points in the request lifecycle.
 * 
 * @param options Configuration options for when and how to log activities
 * @returns Express middleware function
 * 
 * @example
 * // Log after successful operation
 * router.post('/clients', 
 *   authenticateToken,
 *   activityLogger({
 *     onSuccess: (req, res) => ({
 *       actionType: 'create_client',
 *       actionVerb: 'created',
 *       primaryEntityType: 'client',
 *       primaryEntityName: req.body.companyName,
 *       displayMessage: `Created client "${req.body.companyName}"`,
 *       category: 'client_management'
 *     })
 *   }),
 *   createClientHandler
 * );
 */
export const activityLogger = (options: ActivityLoggerOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original methods
    const originalSend = res.send;
    const originalJson = res.json;
    
    let operationError: any = null;
    let operationResult: any = null;

    try {
      // Log before operation if configured
      if (options.beforeOperation) {
        // console.log('🔄 ActivityLogger: Logging before operation...');
        const activityData = await options.beforeOperation(req, res);
        await logActivity(req, activityData);
      }

      // If direct activity data is provided, log it immediately
      if (options.activityData) {
        // console.log('📝 ActivityLogger: Logging direct activity data...');
        const activityData = typeof options.activityData === 'function' 
          ? await options.activityData(req, res)
          : options.activityData;
        await logActivity(req, activityData);
      }

      // Override response methods to capture results
      res.send = function(body: any) {
        operationResult = body;
        return originalSend.call(this, body);
      };

      res.json = function(body: any) {
        operationResult = body;
        return originalJson.call(this, body);
      };

      // Continue to next middleware
      next();

    } catch (error) {
      operationError = error;
      
      // Log error activity if configured
      if (options.onError) {
        try {
          // console.log('❌ ActivityLogger: Logging error activity...');
          const activityData = await options.onError(req, res, error);
          await logActivity(req, activityData);
        } catch (logError) {
          console.error('Failed to log error activity:', logError);
        }
      }

      // Continue with error if not skipping
      if (!options.skipOnError) {
        next(error);
        return;
      }
      
      next();
    }

    // Set up response finish handler for success/after operation logging
    res.on('finish', async () => {
      try {
        // Only log success if the response was successful
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (options.onSuccess) {
            // console.log(`✅ ActivityLogger: Logging success activity (status: ${res.statusCode})...`);
            const activityData = await options.onSuccess(req, res);
            await logActivity(req, activityData);
          }
        }

        // Log after operation regardless of success/failure
        if (options.afterOperation) {
          // console.log('🏁 ActivityLogger: Logging after operation...');
          const activityData = await options.afterOperation(req, res, operationResult);
          await logActivity(req, activityData);
        }
      } catch (logError) {
        console.error('Failed to log activity on response finish:', logError);
      }
    });
  };
};

/**
 * Simple activity logger for immediate logging
 * Use this when you want to log an activity immediately without middleware
 * 
 * @param req Express request object
 * @param activityData Activity data to log
 * @returns Promise<boolean> Success status
 * 
 * @example
 * await logActivityDirect(req, {
 *   actionType: 'assign_jobseeker',
 *   actionVerb: 'assigned',
 *   primaryEntityType: 'jobseeker',
 *   primaryEntityId: jobseekerId,
 *   primaryEntityName: jobseekerName,
 *   secondaryEntityType: 'position',
 *   secondaryEntityId: positionId,
 *   secondaryEntityName: positionTitle,
 *   displayMessage: `Assigned ${jobseekerName} to position ${positionTitle}`,
 *   category: 'candidate_management'
 * });
 */
export const logActivityDirect = async (req: Request, activityData: ActivityData): Promise<boolean> => {
  try {
    await logActivity(req, activityData);
    return true;
  } catch (error) {
    console.error('Error logging activity directly:', error);
    return false;
  }
};

/**
 * Core function to log activity to the database
 * 
 * @param req Express request object (for user context)
 * @param activityData Activity data to log
 */
async function logActivity(req: Request, activityData: ActivityData): Promise<void> {
  try {
    // console.log('📋 ActivityLogger: Processing activity data:', {
    //   actionType: activityData.actionType,
    //   actionVerb: activityData.actionVerb,
    //   primaryEntity: `${activityData.primaryEntityType}:${activityData.primaryEntityId}`,
    //   displayMessage: activityData.displayMessage,
    //   category: activityData.category
    // });

    // Extract actor information from request
    const user = req.user;
    if (!user || !user.id) {
      console.warn('⚠️ ActivityLogger: No user found in request, skipping activity log');
      return;
    }

    // Get actor name from user metadata or email
    const actorName = user.user_metadata?.name || 
                     user.user_metadata?.full_name || 
                     user.email?.split('@')[0] || 
                     'Unknown';

    // Get actor type from user metadata
    const actorType = user.user_metadata?.user_type || 'user';

    // console.log('👤 ActivityLogger: Actor info:', {
    //   actorId: user.id,
    //   actorName,
    //   actorType
    // });

    // Prepare activity record
    const activityRecord = {
      actor_id: user.id,
      actor_name: actorName,
      actor_type: actorType,
      action_type: activityData.actionType,
      action_verb: activityData.actionVerb,
      primary_entity_type: activityData.primaryEntityType,
      primary_entity_id: activityData.primaryEntityId || null,
      primary_entity_name: activityData.primaryEntityName || null,
      secondary_entity_type: activityData.secondaryEntityType || null,
      secondary_entity_id: activityData.secondaryEntityId || null,
      secondary_entity_name: activityData.secondaryEntityName || null,
      tertiary_entity_type: activityData.tertiaryEntityType || null,
      tertiary_entity_id: activityData.tertiaryEntityId || null,
      tertiary_entity_name: activityData.tertiaryEntityName || null,
      status: activityData.status || 'completed',
      metadata: activityData.metadata || {},
      display_message: activityData.displayMessage,
      category: activityData.category,
      priority: activityData.priority || 'normal'
    };

    // console.log('💾 ActivityLogger: Inserting activity record into database...');

    // Log the complete activity record for debugging
    // console.log('📋 ActivityLogger: Complete activity record object:', JSON.stringify(activityRecord, null, 2));

    // Insert activity into database
    const { error } = await supabaseAdmin
      .from('recent_activities')
      .insert([activityRecord]);

    if (error) {
      console.error('❌ ActivityLogger: Failed to insert activity into database:', error);
      throw error;
    }

    // console.log(`✅ ActivityLogger: Activity logged successfully: ${activityData.displayMessage}`);
  } catch (error) {
    console.error('💥 ActivityLogger: Error in logActivity function:', error);
    throw error;
  }
}

export default activityLogger; 