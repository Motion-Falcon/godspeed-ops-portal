import type { User } from '@supabase/supabase-js';
import type { UserRole } from '../lib/auth';

// Re-export UserRole type for backward compatibility
export type { UserRole };

// Import functions from lib/auth for backward compatibility
export { getUserType, isAdmin, isRecruiter, isJobSeeker } from '../lib/auth';

// This file is maintained for backward compatibility and type definitions
// Core auth functionality has been moved to lib/auth.ts

// Extended user with our custom fields
export interface AppUser extends User {
  user_metadata: {
    name: string;
    user_type: UserRole;
    hasProfile?: boolean;
    [key: string]: unknown;
  };
}
