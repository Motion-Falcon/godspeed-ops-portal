import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';

// Rate limiting configuration
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests, please try again later.'
  }
});

// Function to apply more strict limits for sensitive operations
export const sensitiveRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 sensitive operations per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many sensitive operations attempted. Please try again later.'
  }
});

// Security headers configuration
export const configureSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", process.env.SUPABASE_URL || ''],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'same-origin' }
});

// Force TLS for all connections in production
export const forceTLS = (req: Request, res: Response, next: NextFunction) => {
  // Implement HSTS (HTTP Strict Transport Security)
  if (process.env.NODE_ENV === 'production') {
    if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
      // Redirect to HTTPS if accessed via HTTP
      return res.status(301).redirect(`https://${req.headers.host}${req.url}`);
    }

    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
};

// Request unique identifier for tracking
export const requestTracker = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  // Use a single string value for the request ID
  req.headers['x-request-id'] = typeof requestId === 'string' ? requestId : Array.isArray(requestId) ? requestId[0] : uuidv4();
  // Use a known string for the response header
  res.setHeader('X-Request-ID', req.headers['x-request-id'] as string);
  next();
};

// Input sanitization middleware
export const sanitizeInputs = (req: Request, res: Response, next: NextFunction) => {
  // Basic sanitization - should be expanded for specific needs
  const sanitize = (obj: any): any => {
    if (!obj) return obj;
    
    if (typeof obj !== 'object') {
      // For strings, perform basic sanitization
      if (typeof obj === 'string') {
        // Replace potentially harmful characters
        return obj
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;');
      }
      return obj;
    }

    // For arrays
    if (Array.isArray(obj)) {
      return obj.map(item => sanitize(item));
    }

    // For objects
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = sanitize(obj[key]);
      }
    }
    return result;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);

  next();
}; 