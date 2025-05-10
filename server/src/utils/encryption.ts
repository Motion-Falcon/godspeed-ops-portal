'use strict';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Make sure environment variables are loaded
dotenv.config();

// Ensure these are set in your .env file and are sufficiently long and random
// e.g., ENCRYPTION_KEY=... (32 bytes hex)
//       ENCRYPTION_IV=... (16 bytes hex)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 256 bits (32 characters hex)
const IV_LENGTH = 16; // For AES, this is always 16
const ENCRYPTION_IV = process.env.ENCRYPTION_IV; // Must be 16 characters hex

if (!ENCRYPTION_KEY || !ENCRYPTION_IV) {
  throw new Error('ENCRYPTION_KEY and ENCRYPTION_IV environment variables must be set.');
}

if (Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters).');
}

if (Buffer.from(ENCRYPTION_IV, 'hex').length !== IV_LENGTH) {
    throw new Error('ENCRYPTION_IV must be 16 bytes (32 hex characters).');
}

const algorithm = 'aes-256-cbc';
const key = Buffer.from(ENCRYPTION_KEY, 'hex');
const iv = Buffer.from(ENCRYPTION_IV, 'hex');

/**
 * Encrypts a string or other primitive value using AES-256-CBC
 * @param text - The value to encrypt
 * @returns The encrypted value as a hex string, or the original value if null/undefined
 */
export function encrypt(text: string | number | null | undefined): string | null | undefined {
  if (text == null) { // Check for null or undefined
      return text;
  }
  const textString = String(text); // Ensure text is a string
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(textString, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted; // Return hex string
}

/**
 * Decrypts a previously encrypted hex string
 * @param encryptedHex - The encrypted hex string to decrypt
 * @returns The decrypted value as a string, or the original value if null/undefined
 */
export function decrypt(encryptedHex: string | null | undefined): string | null | undefined {
   if (encryptedHex == null) { // Check for null or undefined
      return encryptedHex;
  }
  try {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
      console.error("Decryption failed:", error);
      // Handle error appropriately, e.g., return null or throw a custom error
      // Returning the original encrypted hex might be misleading
      return null; // Or consider throwing
  }
} 