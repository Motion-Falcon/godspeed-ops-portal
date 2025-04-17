import crypto from 'crypto';
import { encrypt } from './encryption.js';

interface LogParams {
  userId: string;
  action: string;
  details?: Record<string, any>;
  sensitiveFields?: Record<string, boolean>;
}

interface LogEntry {
  timestamp: string;
  userId: string;
  action: string;
  details: Record<string, any>;
}

interface LogResult {
  success: boolean;
  data?: any;
  error?: any;
}

/**
 * Mask sensitive PII data for audit logs
 * @param value - The sensitive value to mask
 * @param visibleChars - Number of characters to show (default: 4)
 * @param maskChar - Character to use for masking (default: *)
 * @returns Masked string
 */
function maskPII(value: string | undefined | null, visibleChars = 4, maskChar = '*'): string | undefined | null {
  if (!value) return value;
  
  const stringValue = String(value);
  if (stringValue.length <= visibleChars) {
    return stringValue;
  }
  
  const visiblePart = stringValue.slice(-visibleChars);
  const maskedPart = maskChar.repeat(stringValue.length - visibleChars);
  
  return maskedPart + visiblePart;
}

/**
 * Create a hash of sensitive data for correlation without exposing values
 * @param value - Value to hash 
 * @returns Hashed value
 */
function hashValue(value: string | undefined | null): string | undefined | null {
  if (!value) return value;
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/**
 * Format an audit log entry with proper PII handling
 * @param params - Log parameters
 * @returns Formatted log entry
 */
function formatLogEntry({ userId, action, details = {}, sensitiveFields = {} }: LogParams): LogEntry {
  const timestamp = new Date().toISOString();
  const maskedDetails = { ...details };
  
  // Mask any fields marked as sensitive
  Object.keys(maskedDetails).forEach(key => {
    if (sensitiveFields[key]) {
      if (typeof maskedDetails[key] === 'string') {
        maskedDetails[key] = maskPII(maskedDetails[key]);
      } else if (maskedDetails[key] !== null && typeof maskedDetails[key] === 'object') {
        // For nested objects, store the fact that sensitive data was present
        // but don't include the actual data
        maskedDetails[key] = '[REDACTED]';
      }
    }
  });

  return {
    timestamp,
    userId,
    action,
    details: maskedDetails
  };
}

/**
 * Create an audit log entry and persist it
 * @param logData - Log data parameters
 * @param db - Database client (Supabase)
 * @returns Result of log operation
 */
async function createLog(logData: LogParams, db: any): Promise<LogResult> {
  try {
    const formattedLog = formatLogEntry(logData);
    
    // Store the log in the audit_logs table
    const { data, error } = await db
      .from('audit_logs')
      .insert([formattedLog]);
      
    if (error) {
      console.error('Error creating audit log:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error('Unexpected error creating audit log:', error);
    return { success: false, error: error.message };
  }
}

export { maskPII, hashValue, formatLogEntry, createLog }; 