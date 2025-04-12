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