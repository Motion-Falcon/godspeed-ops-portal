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

// Define user type within Express namespace
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        user_metadata?: {
          name?: string;
          user_type?: 'jobseeker' | 'recruiter' | 'admin';
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

/**
 * Middleware to check if the user is an admin or recruiter
 */
export const isAdminOrRecruiter = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userType = req.user.user_metadata?.user_type;
  
  if (userType === 'admin' || userType === 'recruiter') {
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

    const userType = req.user.user_metadata?.user_type;
    
    if (userType && allowedRoles.includes(userType)) {
      next();
    } else {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: `This resource is only accessible to: ${allowedRoles.join(', ')}` 
      });
    }
  };
}; 