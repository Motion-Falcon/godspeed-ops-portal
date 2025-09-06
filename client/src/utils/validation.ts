/**
 * Shared validation utilities for form validation
 */

/**
 * Log validation messages only in development
 */
export const logValidation = (message: string) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(message);
  }
};

/**
 * Validate a Canadian Social Insurance Number (SIN)
 * Uses the modified Luhn algorithm
 * @param {string|number} sin - A 9-digit Canadian SIN
 * @returns {Object} Result with isValid flag and optional error message
 */
export function validateSIN(sin: string | number): {isValid: boolean, errorMessage?: string} {
  if (!sin) return { isValid: true }; // Allow empty value as it's optional
  
  const originalInput = sin.toString();
  
  // Check if the original input contains ONLY digits - no spaces, dashes or other characters
  const validInputRegex = /^\d+$/;
  if (!validInputRegex.test(originalInput)) {
    return { 
      isValid: false, 
      errorMessage: "SIN must contain only numbers (no spaces or dashes)" 
    };
  }
  
  // Must be exactly 9 digits
  if (originalInput.length !== 9) {
    return { 
      isValid: false, 
      errorMessage: "SIN must be exactly 9 digits" 
    };
  }
  
  // Additional check: SINs starting with 0 or 8 are typically invalid
  if (originalInput[0] === '0' || originalInput[0] === '8') {
    return { 
      isValid: false, 
      errorMessage: "SIN cannot start with 0 or 8" 
    };
  }
  
  // Convert to array of digits
  const digits = originalInput.split('').map(Number);
  
  // Extract check digit (last digit)
  const checkDigit = digits[8];
  
  // Process first 8 digits using modified Luhn algorithm
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    let digit = digits[i];
    
    // Multiply every 2nd digit by 2 (positions 1, 3, 5, 7 in 0-based indexing)
    if (i % 2 === 1) {
      digit *= 2;
      // If result is > 9, add the digits together
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10);
      }
    }
    
    sum += digit;
  }
  
  // Calculate what the check digit should be
  const expectedCheckDigit = (10 - (sum % 10)) % 10;
  
  if (checkDigit !== expectedCheckDigit) {
    return { 
      isValid: false, 
      errorMessage: "Invalid SIN (check digit validation failed)" 
    };
  }
  
  return { isValid: true };
}

/**
 * Validate a date of birth to ensure the person is at least 18 years old
 * and the date is not in the future
 * @param {string} dob - Date of birth string in ISO format (YYYY-MM-DD)
 * @returns {Object} Result with isValid flag and optional error message
 */
export function validateDOB(dob: string): {isValid: boolean, errorMessage?: string} {
  if (!dob) return { isValid: true }; // Allow empty value for required validation
  
  logValidation(`DOB validation - value: ${dob}`);
  
  // Create date at noon to avoid timezone issues
  const selectedDate = new Date(dob);
  selectedDate.setHours(12, 0, 0, 0);
  
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  
  logValidation(`DOB validation - Selected: ${selectedDate.toISOString()}, Today: ${today.toISOString()}`);
  
  // Check if date is in the future
  if (selectedDate > today) {
    logValidation('DOB ERROR: Date is in the future');
    return { 
      isValid: false, 
      errorMessage: "Date of birth cannot be in the future" 
    };
  }
  
  // Calculate the minimum DOB date (18 years ago)
  const minAge = 18;
  const minDobDate = new Date();
  minDobDate.setFullYear(today.getFullYear() - minAge);
  minDobDate.setHours(12, 0, 0, 0);
  
  // Check if person is at least 18 years old
  if (selectedDate > minDobDate) {
    logValidation('DOB ERROR: Person is not at least 18 years old');
    return { 
      isValid: false, 
      errorMessage: "Must be at least 18 years old" 
    };
  }
  
  logValidation('DOB validation passed');
  return { isValid: true };
}

/**
 * Validate UCI (Unique Client Identifier) for work/study permits
 * UCI must be exactly 8 or 10 digits only
 * @param {string|number} uci - UCI number
 * @returns {Object} Result with isValid flag and optional error message
 */
export function validateUCI(uci: string | number): {isValid: boolean, errorMessage?: string} {
  if (!uci) return { isValid: true }; // Allow empty value as it's optional
  
  const originalInput = uci.toString();
  
  // Check if the original input contains ONLY digits - no spaces, dashes or other characters
  const validInputRegex = /^\d+$/;
  if (!validInputRegex.test(originalInput)) {
    return { 
      isValid: false, 
      errorMessage: "UCI must contain only numbers (no spaces or dashes)" 
    };
  }
  
  // Must be exactly 8 or 10 digits
  if (originalInput.length !== 8 && originalInput.length !== 10) {
    return { 
      isValid: false, 
      errorMessage: "UCI must be exactly 8 or 10 digits" 
    };
  }
  
  return { isValid: true };
}

/**
 * Get the maximum valid DOB date (18 years ago from today)
 * @returns {string} Date string in ISO format (YYYY-MM-DD)
 */
export function getMaxDobDate(): string {
  const today = new Date();
  today.setFullYear(today.getFullYear() - 18);
  return today.toISOString().split('T')[0];
}

/**
 * Validate a Canadian phone number
 * @param {string} phone - Phone number string
 * @returns {boolean} True if valid Canadian phone number
 */
export function isValidCanadianPhone(phone: string): boolean {

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // Remove country code and check remaining 10 digits
    const withoutCountryCode = cleaned.substring(1);
    return /^[2-9][0-9][0-9][2-9][0-9][0-9][0-9][0-9][0-9][0-9]$/.test(withoutCountryCode);
  }
  
  return false;
}

/**
 * Validate an Indian phone number
 * @param {string} phone - Phone number string
 * @returns {boolean} True if valid Indian phone number
 */
export function isValidIndianPhone(phone: string): boolean {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
if (cleaned.length === 12 && cleaned.startsWith('91')) {
    // Remove country code and check remaining 10 digits
    const withoutCountryCode = cleaned.substring(2);
    return /^[6-9]\d{9}$/.test(withoutCountryCode);
  }
  
  return false;
}

/**
 * Validate a phone number for Canadian or Indian formats
 * @param {string} phone - Phone number string
 * @param {string} country - Country code ('CA' for Canada, 'IN' for India)
 * @returns {boolean} True if valid phone number for the specified country
 */
export function isValidPhoneNumber(phone: string, country: string): boolean {
  if (!phone) return false;
  
  // Validate based on specific country
  switch (country.toUpperCase()) {
    case 'CA':
    case 'CANADA':
      return isValidCanadianPhone(phone);
    case 'IN':
    case 'INDIA':
      return isValidIndianPhone(phone);
    default:
      // For unsupported countries, fall back to checking both formats
      return isValidCanadianPhone(phone) || isValidIndianPhone(phone);
  }
}