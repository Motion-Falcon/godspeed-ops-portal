-- Migration: Add premium_pay_rate column to positions, position_drafts, and timesheets tables

-- Add premium_pay_rate to positions table (VARCHAR(50), nullable, consistent with regular_pay_rate)
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS premium_pay_rate VARCHAR(50);

-- Add premium_pay_rate to position_drafts table (same structure)
ALTER TABLE public.position_drafts ADD COLUMN IF NOT EXISTS premium_pay_rate VARCHAR(50);

-- Add premium_pay_rate to timesheets table (DECIMAL(10,2), snapshot at creation time)
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS premium_pay_rate DECIMAL(10,2) DEFAULT 0 NOT NULL;
