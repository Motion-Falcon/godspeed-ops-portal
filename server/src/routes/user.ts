import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { authenticateToken, isAdminOrRecruiter, authorizeRoles } from '../middleware/auth.js';
import activityLogger from '../middleware/activityLogger.js';
import sgMail from '@sendgrid/mail';
import { onboardingReminderHtmlTemplate } from '../email-templates/onboarding-reminder-html.js';
import { onboardingReminderTextTemplate } from '../email-templates/onboarding-reminder-txt.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const router = express.Router();

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

/**
 * @route GET /api/users
 * @desc Get all auth users with filters and pagination
 * @access Private (Admin, Recruiter)
 */
router.get('/', authenticateToken, isAdminOrRecruiter, async (req, res) => {
  try {
    // Extract pagination and filter parameters from query
    const {
      page = '1',
      limit = '10',
      search = '',
      nameFilter = '',
      emailFilter = '',
      mobileFilter = '',
      userTypeFilter = '',
      emailVerifiedFilter = '',
      userRoleFilter = '',
      managerIdFilter = ''
    } = req.query as {
      page?: string;
      limit?: string;
      search?: string;
      nameFilter?: string;
      emailFilter?: string;
      mobileFilter?: string;
      userTypeFilter?: string;
      emailVerifiedFilter?: string;
      userRoleFilter?: string;
      managerIdFilter?: string;
    };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Fetch all users (no filters, no pagination)
    const { data: allUsers, error } = await supabase.rpc('list_auth_users', {
      search: null,
      name_filter: null,
      email_filter: null,
      mobile_filter: null,
      user_type_filter: null,
      email_verified_filter: null,
      limit_count: 10000, // fetch a large number
      offset_count: 0
    });

    if (error) {
      console.error('Error calling list_auth_users function:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    // Format for frontend (raw user JSON, plus some display fields)
    type ListAuthUser = {
      id: string;
      email: string;
      user_metadata: {
        name?: string;
        user_type?: string;
        phoneNumber?: string;
        [key: string]: any;
      } | null;
      created_at: string;
      last_sign_in_at: string | null;
      email_confirmed_at: string | null;
      [key: string]: any;
    };
    let formattedUsers = (allUsers || []).map((user: ListAuthUser) => {
      const meta = user.user_metadata || {};
      const rolesSource = meta?.user_role;
      const roles = Array.isArray(rolesSource)
        ? rolesSource.filter((r: unknown): r is string => typeof r === 'string')
        : [];
      return {
        id: user.id,
        email: user.email,
        name: meta.name || '',
        userType: meta.user_type || '',
        phoneNumber: meta.phoneNumber || '',
        emailVerified: !!user.email_confirmed_at,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        roles,
        raw: user // full raw user JSON
      };
    });

    // Apply filtering in Node.js
    type FormattedUser = {
      id: string;
      email: string;
      name: string;
      userType: string;
      phoneNumber: string;
      emailVerified: boolean;
      createdAt: string;
      lastSignInAt: string | null;
      roles: string[];
      raw: ListAuthUser;
    };
    if (search && search.trim().length > 0) {
      const s = search.trim().toLowerCase();
      formattedUsers = formattedUsers.filter((u: FormattedUser) =>
        u.email.toLowerCase().includes(s) ||
        u.name.toLowerCase().includes(s) ||
        u.phoneNumber.toLowerCase().includes(s) ||
        u.userType.toLowerCase().includes(s)
      );
    }
    if (nameFilter) {
      formattedUsers = formattedUsers.filter((u: FormattedUser) => u.name.toLowerCase().includes(nameFilter.toLowerCase()));
    }
    if (emailFilter) {
      formattedUsers = formattedUsers.filter((u: FormattedUser) => u.email.toLowerCase().includes(emailFilter.toLowerCase()));
    }
    if (mobileFilter) {
      formattedUsers = formattedUsers.filter((u: FormattedUser) => u.phoneNumber.toLowerCase().includes(mobileFilter.toLowerCase()));
    }
    if (userTypeFilter) {
      formattedUsers = formattedUsers.filter((u: FormattedUser) => u.userType === userTypeFilter);
    }
    if (emailVerifiedFilter) {
      if (emailVerifiedFilter === 'true') {
        formattedUsers = formattedUsers.filter((u: FormattedUser) => u.emailVerified);
      } else if (emailVerifiedFilter === 'false') {
        formattedUsers = formattedUsers.filter((u: FormattedUser) => !u.emailVerified);
      }
    }
    if (userRoleFilter) {
      formattedUsers = formattedUsers.filter((u: FormattedUser) => 
        u.roles.some(role => role === userRoleFilter)
      );
    }
    // Filter by manager id present in metadata.hierarchy.manager_id
    if (managerIdFilter) {
      const mid = String(managerIdFilter);
      formattedUsers = formattedUsers.filter((u: FormattedUser) => {
        const rawAny: any = u.raw as any;
        const mgr = rawAny?.user_metadata?.hierarchy?.manager_id ?? rawAny?.raw_user_meta_data?.hierarchy?.manager_id;
        return typeof mgr === 'string' && mgr === mid;
      });
    }

    const total = allUsers ? allUsers.length : 0;
    const totalFiltered = formattedUsers.length;
    const totalPages = Math.ceil(totalFiltered / limitNum);
    const paginatedUsers = formattedUsers.slice(offset, offset + limitNum);

    res.json({
      users: paginatedUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalFiltered,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Unexpected error fetching auth users:', error);
    res.status(500).json({ error: 'An unexpected error occurred while fetching auth users' });
  }
});

/**
 * @route GET /api/users/:id
 * @desc Get a single auth user by ID
 * @access Private (Admin, Recruiter)
 */
router.get('/:id', authenticateToken, isAdminOrRecruiter, async (req, res) => {
  try {
    const { id } = req.params as { id: string };

    const { data: allUsers, error } = await supabase.rpc('list_auth_users', {
      search: null,
      name_filter: null,
      email_filter: null,
      mobile_filter: null,
      user_type_filter: null,
      email_verified_filter: null,
      limit_count: 10000,
      offset_count: 0
    });

    if (error) {
      console.error('Error calling list_auth_users function:', error);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }

    type ListAuthUser = {
      id: string;
      email: string;
      user_metadata: {
        name?: string;
        user_type?: string;
        phoneNumber?: string;
        [key: string]: any;
      } | null;
      created_at: string;
      last_sign_in_at: string | null;
      email_confirmed_at: string | null;
      [key: string]: any;
    };

    const match = (allUsers as ListAuthUser[]).find((u) => u.id === id);
    if (!match) {
      return res.status(404).json({ error: 'User not found' });
    }

    const meta = match.user_metadata || {};
    const rolesSource = meta?.user_role;
    const roles = Array.isArray(rolesSource)
      ? rolesSource.filter((r: unknown): r is string => typeof r === 'string')
      : [];

    const formatted = {
      id: match.id,
      email: match.email,
      name: meta.name || '',
      userType: meta.user_type || '',
      phoneNumber: meta.phoneNumber || '',
      emailVerified: !!match.email_confirmed_at,
      createdAt: match.created_at,
      lastSignInAt: match.last_sign_in_at,
      roles,
      raw: match
    };

    res.json(formatted);
  } catch (error) {
    console.error('Unexpected error fetching auth user by id:', error);
    res.status(500).json({ error: 'An unexpected error occurred while fetching auth user' });
  }
});

/**
 * @route PATCH /api/users/:id/manager
 * @desc Set or update a user's manager_id in user_metadata.hierarchy
 * @access Private (Admin, Recruiter)
 */
router.patch(
  '/:id/manager',
  authenticateToken,
  isAdminOrRecruiter,
  activityLogger({
    onSuccess: (req, res) => {
      const targetUser: any = res.locals.userForActivity;
      const managerUser: any = res.locals.managerForActivity || null;
      const targetName = targetUser?.user_metadata?.name || targetUser?.email || 'Unknown';
      const managerName = managerUser?.user_metadata?.name || managerUser?.email || null;
      const managerId = res.locals.managerId as string | null | undefined;
      return {
        actionType: 'update_user_manager',
        actionVerb: 'updated',
        primaryEntityType: 'user',
        primaryEntityId: targetUser?.id,
        primaryEntityName: targetName,
        secondaryEntityType: 'manager',
        secondaryEntityId: managerId || null || undefined,
        secondaryEntityName: managerName || (managerId ? managerId : 'None'),
        displayMessage: managerId
          ? `Updated manager for ${targetName} to ${managerName || managerId}`
          : `Removed manager for ${targetName}`,
        category: 'user_management',
        priority: 'normal',
        status: 'completed',
        metadata: {
          newManagerId: managerId || null,
          newManagerEmail: managerUser?.email || null,
        },
      };
    },
  }),
  async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { managerId } = req.body as { managerId?: string | null };

    // Basic validations
    if (managerId && managerId === id) {
      return res.status(400).json({ error: 'A user cannot be their own manager' });
    }

    // Fetch current user to merge metadata safely
    const { data: userData, error: getErr } = await supabase.auth.admin.getUserById(id);
    if (getErr || !userData?.user) {
      console.error('Error fetching user for manager update:', getErr);
      return res.status(404).json({ error: 'User not found' });
    }

    // If assigning a manager, validate that it doesn't create a cycle and the manager is eligible
    if (managerId) {
      // Fetch manager user data
      const { data: managerData, error: managerErr } = await supabase.auth.admin.getUserById(managerId);
      if (managerErr || !managerData?.user) {
        console.error('Error fetching manager user:', managerErr);
        return res.status(400).json({ error: 'Invalid manager selected' });
      }

      const managerMeta = (managerData.user as any).user_metadata || {};
      const managerType = managerMeta.user_type;
      if (managerType === 'jobseeker') {
        return res.status(400).json({ error: 'Jobseekers cannot be assigned as managers' });
      }

      // Detect cycle: walk up the manager chain starting from managerId
      const visited = new Set<string>();
      let currentId: string | null = managerId;
      let hops = 0;
      const MAX_HOPS = 100; // safety guard
      while (currentId && hops < MAX_HOPS) {
        if (currentId === id) {
          return res.status(400).json({ error: 'Selecting this manager would create a circular hierarchy' });
        }
        if (visited.has(currentId)) break;
        visited.add(currentId);

        const { data: currData, error: currErr } = await supabase.auth.admin.getUserById(currentId);
        if (currErr || !currData?.user) break;
        const meta = (currData.user as any).user_metadata || {};
        const nextMgr = meta?.hierarchy?.manager_id as string | undefined;
        currentId = nextMgr ?? null;
        hops += 1;
      }
      // Expose manager user for activity logging
      res.locals.managerForActivity = managerData.user;
    }

    const currentMeta = (userData.user as any).user_metadata || {};
    const currentHierarchy = (currentMeta.hierarchy || {}) as Record<string, unknown>;

    const updatedMeta = {
      ...currentMeta,
      hierarchy: {
        ...currentHierarchy,
        manager_id: managerId || null,
      },
    };

    const { data: updated, error: updErr } = await supabase.auth.admin.updateUserById(id, {
      user_metadata: updatedMeta,
    });

    if (updErr) {
      console.error('Error updating manager_id:', updErr);
      return res.status(500).json({ error: 'Failed to update manager' });
    }

    // Set locals for activity logger
    res.locals.userForActivity = updated?.user || userData.user;
    res.locals.managerId = managerId || null;

    return res.json({
      success: true,
      user: updated?.user,
    });
  } catch (error) {
    console.error('Unexpected error updating manager:', error);
    res.status(500).json({ error: 'An unexpected error occurred while updating manager' });
  }
});

/**
 * @route PATCH /api/users/:id/roles
 * @desc Set or update a user's user_metadata.user_role (string[])
 * @access Private (Admin, Recruiter)
 */
router.patch(
  '/:id/roles',
  authenticateToken,
  isAdminOrRecruiter,
  activityLogger({
    onSuccess: (req, res) => {
      const targetUser: any = res.locals.userForActivity;
      const targetName = targetUser?.user_metadata?.name || targetUser?.email || 'Unknown';
      const roles: string[] = Array.isArray(res.locals.updatedRoles)
        ? res.locals.updatedRoles
        : [];
      return {
        actionType: 'update_user_roles',
        actionVerb: 'updated',
        primaryEntityType: 'user',
        primaryEntityId: targetUser?.id,
        primaryEntityName: targetName,
        displayMessage: `Updated roles for ${targetName}`,
        category: 'user_management',
        priority: 'normal',
        status: 'completed',
        metadata: { roles },
      };
    },
  }),
  async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { roles } = req.body as { roles?: unknown };

    // Do not allow assigning 'admin' role via this endpoint
    const ALLOWED_ROLES = ['recruiter', 'manager', 'accountant'];

    // Validate roles input
    if (!Array.isArray(roles)) {
      return res.status(400).json({ error: 'Invalid roles payload. Expected an array of strings.' });
    }
    const sanitizedRoles = roles
      .filter((r): r is string => typeof r === 'string')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    // Validate allowed values
    for (const r of sanitizedRoles) {
      if (!ALLOWED_ROLES.includes(r)) {
        return res.status(400).json({ error: `Invalid role: ${r}` });
      }
    }

    // Fetch current user to merge metadata safely
    const { data: userData, error: getErr } = await supabase.auth.admin.getUserById(id);
    if (getErr || !userData?.user) {
      console.error('Error fetching user for roles update:', getErr);
      return res.status(404).json({ error: 'User not found' });
    }

    const currentMeta = (userData.user as any).user_metadata || {};
    // Disallow modifying roles for admin users
    if (currentMeta?.user_type === 'admin') {
      return res.status(403).json({ error: 'Cannot modify roles for admin users' });
    }
    const updatedMeta = {
      ...currentMeta,
      user_role: sanitizedRoles,
    };

    const { data: updated, error: updErr } = await supabase.auth.admin.updateUserById(id, {
      user_metadata: updatedMeta,
    });

    if (updErr) {
      console.error('Error updating user roles:', updErr);
      return res.status(500).json({ error: 'Failed to update roles' });
    }

    // Set locals for activity logger
    res.locals.userForActivity = updated?.user || userData.user;
    res.locals.updatedRoles = sanitizedRoles;

    return res.json({ success: true, user: updated?.user });
  } catch (error) {
    console.error('Unexpected error updating roles:', error);
    res.status(500).json({ error: 'An unexpected error occurred while updating roles' });
  }
});

/**
 * @route POST /api/users/invite-recruiter
 * @desc Invite a recruiter by email using Supabase Admin API. Sends an invitation email with redirect to complete-signup.
 * @access Private (Admin only)
 */
router.post(
  '/invite-recruiter',
  authenticateToken,
  authorizeRoles(['admin']),
  activityLogger({
    onSuccess: (req, res) => {
      const inviterName = req.user?.user_metadata?.name || req.user?.email || 'Unknown';
      const invitedEmail = req.body.email;
      const invitedName = req.body.name;
      const newUser = res.locals.invitedUser;
      
      return {
        actionType: 'invite_recruiter',
        actionVerb: 'invited',
        primaryEntityType: 'user',
        primaryEntityId: newUser?.id || null,
        primaryEntityName: invitedEmail,
        secondaryEntityType: 'recruiter',
        secondaryEntityId: req.user?.id,
        secondaryEntityName: inviterName,
        displayMessage: `${inviterName} invited ${invitedName} (${invitedEmail}) as a recruiter`,
        category: 'user_management',
        priority: 'normal',
        metadata: {
          invitedName,
          invitedEmail,
          inviterEmail: req.user?.email,
          userType: 'recruiter'
        }
      };
    }
  }),
  async (req, res) => {
    try {
      const { email, name } = req.body as { email?: string; name?: string };

      if (!email || !name) {
        return res.status(400).json({ error: 'Email and name are required' });
      }

      // Check if user already exists with this email
      const { data: existingUser, error: checkError } = await supabase.auth.admin.listUsers();
      
      if (checkError) {
        console.error('Error checking existing users:', checkError);
        return res.status(500).json({ error: 'Failed to check user existence' });
      }

      // Check if email already exists
      const userExists = existingUser.users.some(user => user.email === email);
      if (userExists) {
        return res.status(409).json({ 
          error: 'A user with this email already exists',
          details: 'Please use a different email address or ask the user to reset their password if they forgot it.'
        });
      }

      const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';
      const redirectURL = clientURL.endsWith('/')
        ? `${clientURL}complete-signup`
        : `${clientURL}/complete-signup`;

      // Default recruiter metadata
      const userMetadata: Record<string, unknown> = {
        name,
        user_type: 'recruiter',
        user_role: ['recruiter'],
        onboarding_complete: false,
        phone_verified: false,
        hierarchy: {
          org_id: null,
          team_id: null,
          manager_id: null,
          level: 0,
        },
      };

      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: userMetadata,
        redirectTo: redirectURL,
      } as any);

      if (error) {
        console.error('Supabase invite error:', error);
        return res.status(400).json({ 
          error: 'Failed to send invitation',
          details: error.message || 'Unknown error occurred'
        });
      }

      // Store user data for activity logging
      res.locals.invitedUser = data?.user;

      return res.status(200).json({
        success: true,
        message: 'Invitation sent successfully',
        user: data?.user ?? null,
      });
    } catch (err) {
      console.error('Invite recruiter error:', err);
      return res.status(500).json({ error: 'Failed to invite recruiter' });
    }
  }
);

/**
 * @route POST /api/users/resend-invitation
 * @desc Resend invitation to a user who hasn't completed onboarding
 * @access Private (Admin only)
 */
router.post(
  '/resend-invitation',
  authenticateToken,
  authorizeRoles(['admin']),
  activityLogger({
    onSuccess: (req, res) => {
      const senderName = req.user?.user_metadata?.name || req.user?.email || 'Unknown';
      const targetUser = res.locals.targetUser;
      const targetName = targetUser?.user_metadata?.name || targetUser?.email || 'Unknown';
      const isEmailVerified = !!targetUser?.email_confirmed_at;
      
      return {
        actionType: 'resend_invitation',
        actionVerb: 'resent invitation to',
        primaryEntityType: 'user',
        primaryEntityId: targetUser?.id,
        primaryEntityName: targetName,
        secondaryEntityType: 'admin',
        secondaryEntityId: req.user?.id,
        secondaryEntityName: senderName,
        displayMessage: `${senderName} resent ${isEmailVerified ? 'onboarding reminder' : 'invitation'} to ${targetName}`,
        category: 'user_management',
        priority: 'normal',
        metadata: {
          targetEmail: targetUser?.email,
          senderEmail: req.user?.email,
          isEmailVerified,
          invitationType: isEmailVerified ? 'onboarding_reminder' : 'email_invitation'
        }
      };
    }
  }),
  async (req, res) => {
    try {
      const { userId } = req.body as { userId?: string };

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Get user details from Supabase
      const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(userId);
      
      if (getUserError || !userData.user) {
        console.error('Error fetching user:', getUserError);
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userData.user;
      const userMetadata = user.user_metadata || {};

      // Store user data for activity logging
      res.locals.targetUser = user;

      // Check if user has completed onboarding
      if (userMetadata.onboarding_complete === true) {
        return res.status(400).json({ 
          error: 'User has already completed onboarding. Cannot resend invitation.' 
        });
      }

      // Check if user has required metadata for resending
      if (!userMetadata.name || !user.email) {
        return res.status(400).json({ 
          error: 'User is missing required information for invitation' 
        });
      }

      const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';
      const onboardingURL = clientURL.endsWith('/')
        ? `${clientURL}complete-signup`
        : `${clientURL}/complete-signup`;

      // For users with verified emails but incomplete onboarding, 
      // send a custom onboarding reminder email instead of using inviteUserByEmail
      if (user.email_confirmed_at) {
        // User has verified email, send custom onboarding reminder
        const emailVars = {
          name: userMetadata.name || '',
          onboarding_url: onboardingURL,
        };

        const htmlContent = onboardingReminderHtmlTemplate(emailVars);
        const textContent = onboardingReminderTextTemplate(emailVars);

        try {
          await sgMail.send({
            to: user.email,
            from: process.env.DEFAULT_FROM_EMAIL as string,
            subject: 'Complete Your Account Setup - Action Required',
            text: textContent,
            html: htmlContent,
          });

          return res.status(200).json({
            success: true,
            message: `Onboarding reminder sent successfully to ${user.email}`,
            user: user,
          });
        } catch (emailError) {
          console.error('Error sending onboarding reminder email:', emailError);
          return res.status(500).json({ 
            error: 'Failed to send onboarding reminder',
            details: 'Email service error'
          });
        }
      } else {
        // User hasn't verified email yet, use Supabase invitation
        const { data, error } = await supabase.auth.admin.inviteUserByEmail(user.email, {
          data: userMetadata,
          redirectTo: onboardingURL,
        } as any);

        if (error) {
          console.error('Error resending invitation:', error);
          return res.status(400).json({ 
            error: 'Failed to resend invitation',
            details: error.message || 'Unknown error occurred'
          });
        }

        return res.status(200).json({
          success: true,
          message: `Invitation resent successfully to ${user.email}`,
          user: data?.user ?? null,
        });
      }
    } catch (err) {
      console.error('Resend invitation error:', err);
      return res.status(500).json({ error: 'Failed to resend invitation' });
    }
  }
);

export default router; 