import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

export const DROPDOWN_LIST_TYPES = [
  'client_manager',
  'client_representative',
  'salesperson',
  'accounting_person',
  'accounting_manager',
  'position_title',
  'list_name',
] as const;

export type DropdownListType = (typeof DROPDOWN_LIST_TYPES)[number];

/**
 * Get all dropdown options, optionally filtered by list_type
 * GET /api/dropdown-options?listType=client_manager
 * @access Private (Admin, Recruiter) - for dropdown population
 */
router.get(
  '/',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  async (req: Request, res: Response) => {
    try {
      const { listType } = req.query as { listType?: string };

      let query = supabase
        .from('client_dropdown_options')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (listType && DROPDOWN_LIST_TYPES.includes(listType as DropdownListType)) {
        query = query.eq('list_type', listType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching dropdown options:', error);
        return res.status(500).json({ error: 'Failed to fetch dropdown options' });
      }

      res.json(data);
    } catch (err) {
      console.error('Error in dropdown options GET:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Get dropdown options by list type (convenience endpoint returning names array)
 * GET /api/dropdown-options/client_manager
 * @access Private (Admin, Recruiter)
 */
router.get(
  '/:listType',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  async (req: Request, res: Response) => {
    try {
      const { listType } = req.params;

      if (!DROPDOWN_LIST_TYPES.includes(listType as DropdownListType)) {
        return res.status(400).json({
          error: 'Invalid list type',
          validTypes: DROPDOWN_LIST_TYPES,
        });
      }

      const { data, error } = await supabase
        .from('client_dropdown_options')
        .select('*')
        .eq('list_type', listType)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching dropdown options:', error);
        return res.status(500).json({ error: 'Failed to fetch dropdown options' });
      }

      res.json(data);
    } catch (err) {
      console.error('Error in dropdown options GET by type:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Create a new dropdown option
 * POST /api/dropdown-options
 * @access Private (Admin only)
 */
router.post(
  '/',
  authenticateToken,
  authorizeRoles(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { listType, name, displayOrder } = req.body as {
        listType?: string;
        name?: string;
        displayOrder?: number;
      };

      if (!listType || !name || !name.trim()) {
        return res.status(400).json({
          error: 'listType and name are required',
        });
      }

      if (!DROPDOWN_LIST_TYPES.includes(listType as DropdownListType)) {
        return res.status(400).json({
          error: 'Invalid list type',
          validTypes: DROPDOWN_LIST_TYPES,
        });
      }

      const trimmedName = name.trim();
      const order = typeof displayOrder === 'number' ? displayOrder : 0;

      const { data, error } = await supabase
        .from('client_dropdown_options')
        .insert({
          list_type: listType,
          name: trimmedName,
          display_order: order,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({
            error: `"${trimmedName}" already exists in ${listType}`,
          });
        }
        console.error('Error creating dropdown option:', error);
        return res.status(500).json({ error: 'Failed to create dropdown option' });
      }

      res.status(201).json(data);
    } catch (err) {
      console.error('Error in dropdown options POST:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Update a dropdown option
 * PUT /api/dropdown-options/:id
 * @access Private (Admin only)
 */
router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, displayOrder } = req.body as {
        name?: string;
        displayOrder?: number;
      };

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) {
        if (!name || !name.trim()) {
          return res.status(400).json({ error: 'name cannot be empty' });
        }
        updates.name = name.trim();
      }

      if (typeof displayOrder === 'number') {
        updates.display_order = displayOrder;
      }

      const { data, error } = await supabase
        .from('client_dropdown_options')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({
            error: `A duplicate entry already exists`,
          });
        }
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Dropdown option not found' });
        }
        console.error('Error updating dropdown option:', error);
        return res.status(500).json({ error: 'Failed to update dropdown option' });
      }

      res.json(data);
    } catch (err) {
      console.error('Error in dropdown options PUT:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Delete a dropdown option
 * DELETE /api/dropdown-options/:id
 * @access Private (Admin only)
 */
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const { error } = await supabase
        .from('client_dropdown_options')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Dropdown option not found' });
        }
        console.error('Error deleting dropdown option:', error);
        return res.status(500).json({ error: 'Failed to delete dropdown option' });
      }

      res.json({ success: true, deletedId: id });
    } catch (err) {
      console.error('Error in dropdown options DELETE:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
