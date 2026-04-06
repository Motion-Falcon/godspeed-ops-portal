import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

type UserType = 'jobseeker' | 'recruiter' | 'admin';
export type AccessRole = UserType | 'manager' | 'accountant';

const ROLE_DISPLAY_ORDER: AccessRole[] = [
  'admin',
  'manager',
  'accountant',
  'recruiter',
  'jobseeker',
];

const RECRUITER_ACCESS_ROLES: AccessRole[] = ['recruiter', 'manager', 'accountant'];

function normalizeUserType(userType: unknown): UserType {
  if (userType === 'admin' || userType === 'recruiter') {
    return userType;
  }

  return 'jobseeker';
}

function normalizeAccessRole(role: unknown): AccessRole | null {
  if (
    role === 'jobseeker' ||
    role === 'recruiter' ||
    role === 'admin' ||
    role === 'manager' ||
    role === 'accountant'
  ) {
    return role;
  }

  return null;
}

function sortRoles(roles: Iterable<AccessRole>): AccessRole[] {
  const roleSet = new Set(roles);
  return ROLE_DISPLAY_ORDER.filter((role) => roleSet.has(role));
}

// Define user type within Express namespace
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        user_metadata?: {
          name?: string;
          user_type?: UserType;
          user_role?: unknown;
          [key: string]: unknown;
        }
        [key: string]: unknown;
      };
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  // Get the token from the authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    // Verify the token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Set the user in the request object with proper type casting
    req.user = data.user as any;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

function getRawUserRoles(user: Express.Request['user'] | undefined): string[] {
  const rawRoles = user?.user_metadata?.user_role;
  if (!Array.isArray(rawRoles)) {
    return [];
  }

  return rawRoles.filter((role): role is string => typeof role === 'string');
}

export function getResolvedUserRoles(user: Express.Request['user'] | undefined): AccessRole[] {
  const userType = normalizeUserType(user?.user_metadata?.user_type);

  if (userType === 'jobseeker') {
    return ['jobseeker'];
  }

  if (userType === 'admin') {
    return ['admin'];
  }

  const resolvedRoles = getRawUserRoles(user)
    .map((role) => normalizeAccessRole(role))
    .filter((role): role is AccessRole => role !== null);

  if (resolvedRoles.length === 0) {
    return ['recruiter'];
  }

  return sortRoles(resolvedRoles);
}

export function hasAccessRole(
  user: Express.Request['user'] | undefined,
  role: AccessRole | string
): boolean {
  const normalizedRole = normalizeAccessRole(role);
  if (!normalizedRole) {
    return false;
  }

  const resolvedRoles = getResolvedUserRoles(user);
  if (normalizedRole === 'recruiter') {
    return resolvedRoles.some((resolvedRole) =>
      RECRUITER_ACCESS_ROLES.includes(resolvedRole)
    );
  }

  return resolvedRoles.includes(normalizedRole);
}

/**
 * Middleware to check if the user is an admin or recruiter
 */
export const isAdminOrRecruiter = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (hasAccessRole(req.user, 'admin') || hasAccessRole(req.user, 'recruiter')) {
    next();
  } else {
    return res.status(403).json({ 
      error: 'Access denied', 
      message: 'Only admins and recruiters can access this resource' 
    });
  }
};

/**
 * Middleware to authorize users based on their roles
 * @param allowedRoles Array of role names that are allowed to access the route
 */
export const authorizeRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (allowedRoles.some((role) => hasAccessRole(req.user, role))) {
      next();
    } else {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: `This resource is only accessible to: ${allowedRoles.join(', ')}` 
      });
    }
  };
}; 
