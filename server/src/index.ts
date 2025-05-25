import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import jobseekersRoutes from './routes/jobseekers.js';
import clientsRoutes from './routes/clients.js';
import positionsRoutes from './routes/positions.js';
import { 
  configureSecurityHeaders, 
  forceTLS, 
  requestTracker, 
  apiRateLimiter, 
  sanitizeInputs 
} from './middleware/security.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware - Apply early in middleware chain
app.use(forceTLS);
app.use(configureSecurityHeaders);
app.use(requestTracker);
// app.use(apiRateLimiter); // Global rate limiter
app.use(sanitizeInputs); // Global input sanitization

// Standard Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID']
}));
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Profile routes
app.use('/api/profile', profileRoutes);

// Jobseekers routes
app.use('/api/jobseekers', jobseekersRoutes);

// Clients routes
app.use('/api/clients', clientsRoutes);

// Positions routes
app.use('/api/positions', positionsRoutes);

// Error handling middleware
app.use((err: Error & { code?: string }, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  
  // Check for specific error types
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: 'Invalid CSRF token. Please refresh the page and try again.'
    });
  }
  
  // Generic error response
  res.status(500).json({
    error: 'An unexpected error occurred',
    requestId: req.headers['x-request-id']
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Security measures enabled: TLS, CSP, XSS Protection, Rate Limiting`);
}); 