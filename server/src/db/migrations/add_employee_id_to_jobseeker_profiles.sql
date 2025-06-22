-- Migration: Add employee_id column to jobseeker_profiles table
-- Description: Adds an employee_id field to track employee identification numbers
-- Date: 2024-06-07

-- Add employee_id column to jobseeker_profiles table
ALTER TABLE jobseeker_profiles 
ADD COLUMN employee_id VARCHAR(50) DEFAULT NULL;

-- Add index for employee_id for better query performance
CREATE INDEX idx_jobseeker_profiles_employee_id ON jobseeker_profiles(employee_id);

-- Add comment to document the column purpose
COMMENT ON COLUMN jobseeker_profiles.employee_id IS 'Employee identification number assigned to the jobseeker';

-- Optional: Add unique constraint if employee_id should be unique across all profiles
-- Uncomment the line below if employee_id needs to be unique
ALTER TABLE jobseeker_profiles ADD CONSTRAINT unique_employee_id UNIQUE (employee_id); 