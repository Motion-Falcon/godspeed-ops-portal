import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { authenticateToken } from '../middleware/auth.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // First, check if user already exists by trying to sign in with their email
    // This is a common approach since Supabase doesn't expose direct user lookup by email
    try {
      // Use a simple query to check if the email exists in the auth schema
      const { data: existingUsers, error: queryError } = await supabase
        .from('users') // Make sure this is the correct table name
        .select('id')
        .eq('email', email)
        .limit(1);

      if (!queryError && existingUsers?.length > 0) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
    } catch (searchError) {
      console.error('Error searching for existing user:', searchError);
      // Continue with registration attempt if the search fails
    }

    // Additional check: try to sign in with a random password
    // If we get back an "Invalid login credentials" error, the user exists
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: `random-password-${Date.now()}`, // Use a random password that won't match
    });

    if (signInError) {
      // If error is "Invalid login credentials", the user exists
      // If error is "Email not confirmed", the user exists
      if (signInError.message.includes('Invalid login credentials') || 
          signInError.message.includes('Email not confirmed')) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
    } else {
      // If sign in succeeded with a random password (very unlikely), the user exists
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Determine user type based on email
    let userType = 'jobseeker'; // Default type
    
    // Check for recruiter email pattern
    if (email.includes('@motionfalcon')) {
      userType = 'recruiter';
    }
    
    // Admin users are handled separately via direct database assignments

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          user_type: userType,
        },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Check if user is null, which indicates the email already exists
    if (!data.user) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    return res.status(201).json({
      message: 'Registration successful. Please check your email for verification.',
      user: data.user,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(200).json({
      message: 'Login successful',
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Logout user
router.post('/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Make sure we have the right clientURL with http/https
    const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';
    
    // Send password reset email with redirect
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${clientURL}/reset-password`,
    });

    if (error) {
      console.error('Password reset email error:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: 'Password reset email sent. Please check your inbox.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({ error: 'Failed to send reset password email' });
  }
});

// Update password
router.post('/update-password', async (req, res) => {
  try {
    const { password } = req.body;
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!password) {
      return res.status(400).json({ error: 'New password is required' });
    }

    // Check if we have a token
    if (!token) {
      return res.status(401).json({ error: 'Authentication token is required for password reset' });
    }
    
    // Get user ID from the token
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError) {
      console.error('User validation error:', userError);
      return res.status(401).json({ error: 'Invalid or expired reset token' });
    }
    
    if (!userData.user) {
      console.error('No user found with token');
      return res.status(401).json({ error: 'User not found' });
    }

    // Try with service role first (most reliable)
    try {
      const { error } = await supabase.auth.admin.updateUserById(
        userData.user.id,
        { password }
      );

      if (!error) {
        return res.status(200).json({
          message: 'Password updated successfully',
        });
      }
      
      // If service role update failed, log the error and try fallback
      console.error('Admin update failed:', error);
    } catch (adminError) {
      console.error('Admin client error:', adminError);
    }

    // Fallback to user context update
    try {
      const { error: userUpdateError } = await supabase.auth.updateUser({ 
        password 
      });
      
      if (userUpdateError) {
        console.error('User update error:', userUpdateError);
        return res.status(400).json({ error: userUpdateError.message });
      }
      
      return res.status(200).json({
        message: 'Password updated successfully',
      });
    } catch (userClientError) {
      console.error('User client error:', userClientError);
      return res.status(500).json({ error: 'Password update failed with user token' });
    }
  } catch (error) {
    console.error('Update password error:', error);
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${process.env.CLIENT_URL}/login`,
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: 'Verification email has been resent. Please check your inbox.',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// Get current user (protected route)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // User is already set in req by the authenticateToken middleware
    return res.status(200).json({ user: req.user });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router; 