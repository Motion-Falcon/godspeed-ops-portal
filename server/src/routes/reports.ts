import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
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

// POST /api/reports/timesheet
router.post(
  '/timesheet',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  async (req: Request, res: Response) => {
    try {
      const { jobseekerId, clientIds, weekPeriods, payCycle, listName } = req.body || {};
      if (!jobseekerId || !Array.isArray(weekPeriods) || weekPeriods.length === 0) {
        return res.status(400).json({ error: 'jobseekerId and at least one week period are required.' });
      }

      // Build week period filter (OR for each period)
      const weekClauses: string[] = [];
      const params: any[] = [jobseekerId];
      let paramIdx = 2;
      weekPeriods.forEach((wp: any) => {
        if (wp && wp.start && wp.end) {
          weekClauses.push(`(t.week_start_date >= $${paramIdx} AND t.week_end_date <= $${paramIdx + 1})`);
          params.push(wp.start, wp.end);
          paramIdx += 2;
        }
      });
      if (weekClauses.length === 0) {
        return res.status(400).json({ error: 'At least one valid week period is required.' });
      }

      // Additional filters
      let filterSql = '';
      if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
        filterSql += ` AND c.id = ANY($${paramIdx}::uuid[])`;
        params.push(clientIds);
        paramIdx++;
      }
      if (payCycle) {
        filterSql += ` AND c.pay_cycle = $${paramIdx}`;
        params.push(payCycle);
        paramIdx++;
      }
      if (listName) {
        filterSql += ` AND c.list_name = $${paramIdx}`;
        params.push(listName);
        paramIdx++;
      }

      const sql = `
        SELECT
          jp.employee_id,
          jp.license_number,
          jp.passport_number,
          (jp.first_name || ' ' || jp.last_name) AS name,
          jp.mobile,
          jp.email,
          c.company_name,
          c.list_name,
          p.title,
          p.position_code,
          p.position_category,
          p.client_manager,
          t.week_start_date,
          t.week_end_date,
          t.total_regular_hours,
          t.total_overtime_hours,
          t.regular_pay_rate,
          t.overtime_pay_rate,
          t.total_jobseeker_pay,
          t.bonus_amount,
          t.deduction_amount,
          jp.hst_gst,
          c.currency,
          jp.payment_method,
          c.pay_cycle,
          p.notes,
          t.created_at AS timesheet_created_at,
          t.invoice_number
        FROM timesheets t
        JOIN jobseeker_profiles jp ON t.jobseeker_profile_id = jp.id
        JOIN positions p ON t.position_id = p.id
        JOIN clients c ON p.client = c.id
        WHERE jp.id = $1
          AND (${weekClauses.join(' OR ')})
          ${filterSql}
        ORDER BY t.week_start_date, jp.employee_id
      `;

      // Use Supabase RPC to run raw SQL (if enabled), otherwise use supabase-js query builder (less flexible for OR logic)
      // For now, use supabase-js query builder for compatibility
      // Fallback: Use supabase-js for most filters, then filter week periods in JS
      const { data, error } = await supabase
        .from('timesheets')
        .select(`
          jobseeker_profiles:jobseeker_profile_id (
            employee_id, license_number, passport_number, first_name, last_name, mobile, email, hst_gst, payment_method
          ),
          positions:position_id (
            title, position_code, position_category, client_manager, notes, client
          ),
          week_start_date, week_end_date, total_regular_hours, total_overtime_hours, regular_pay_rate, overtime_pay_rate, total_jobseeker_pay, bonus_amount, deduction_amount, created_at, invoice_number, position_id
        `)
        .in('jobseeker_profile_id', [jobseekerId])
        .order('week_start_date', { ascending: true });

      if (error) {
        console.error('Error fetching timesheet report:', error);
        return res.status(500).json({ error: 'Failed to fetch timesheet report.' });
      }

      // Filter in JS for week periods and other filters
      let filtered = (data || []).filter((row: any) => {
        // Week period match
        const ws = row.week_start_date;
        const we = row.week_end_date;
        const weekMatch = weekPeriods.some((wp: any) => ws >= wp.start && we <= wp.end);
        if (!weekMatch) return false;
        // Client filter
        if (clientIds && clientIds.length > 0) {
          if (!row.positions || !clientIds.includes(row.positions.client)) return false;
        }
        // Pay cycle
        if (payCycle && row.positions && row.positions.client_manager) {
          // pay_cycle is on client, not position, so skip here
        }
        // List name
        // (list_name is on client, not available in this join, so skip here)
        return true;
      });

      // Map to response format
      const result = filtered.map((row: any) => {
        const jp = row.jobseeker_profiles || {};
        const p = row.positions || {};
        return {
          employee_id: jp.employee_id,
          license_number: jp.license_number,
          passport_number: jp.passport_number,
          name: (jp.first_name || '') + ' ' + (jp.last_name || ''),
          mobile: jp.mobile,
          email: jp.email,
          company_name: undefined, // will fill below
          list_name: undefined, // will fill below
          title: p.title,
          position_code: p.position_code,
          position_category: p.position_category,
          client_manager: p.client_manager,
          week_start_date: row.week_start_date,
          week_end_date: row.week_end_date,
          total_regular_hours: row.total_regular_hours,
          total_overtime_hours: row.total_overtime_hours,
          regular_pay_rate: row.regular_pay_rate,
          overtime_pay_rate: row.overtime_pay_rate,
          total_jobseeker_pay: row.total_jobseeker_pay,
          bonus_amount: row.bonus_amount,
          deduction_amount: row.deduction_amount,
          hst_gst: jp.hst_gst,
          currency: undefined, // will fill below
          payment_method: jp.payment_method,
          pay_cycle: undefined, // will fill below
          notes: p.notes,
          timesheet_created_at: row.created_at,
          invoice_number: row.invoice_number,
          client_id: p.client // <-- add client_id for later lookup
        };
      });

      // To fill company_name, list_name, currency, pay_cycle, need to fetch client info for all unique client ids
      const clientIdsSet = new Set(result.map((row: any) => row.client_id).filter(Boolean));
      let clientInfoMap: Record<string, any> = {};
      if (clientIdsSet.size > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, company_name, list_name, currency, pay_cycle')
          .in('id', Array.from(clientIdsSet));
        if (!clientsError && clientsData) {
          clientsData.forEach((c: any) => {
            clientInfoMap[c.id] = c;
          });
        }
      }
      // Fill in the missing fields
      result.forEach((row: any) => {
        const client = clientInfoMap[row.client_id];
        if (client) {
          row.company_name = client.company_name;
          row.list_name = client.list_name;
          row.currency = client.currency;
          row.pay_cycle = client.pay_cycle;
        }
        delete row.client_id; // remove from final output
      });

      // Apply payCycle and listName filters after merging client info
      const finalFiltered = result.filter((row: any) => {
        if (payCycle && row.pay_cycle !== payCycle) return false;
        if (listName && row.list_name !== listName) return false;
        return true;
      });

      res.json(finalFiltered);
    } catch (error) {
      console.error('Unexpected error in timesheet report:', error);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
);

// POST /api/reports/margin
router.post(
  '/margin',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.body || {};
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required.' });
      }

      // Query invoices between the date range
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          client_id,
          subtotal,
          grand_total,
          invoice_data
        `)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('invoice_date', { ascending: false });

      if (error) {
        console.error('Error fetching margin report:', error);
        return res.status(500).json({ error: 'Failed to fetch margin report.' });
      }

      // Transform the data for the frontend
      const marginData = (invoices || []).map((invoice: any) => {
        const invoiceData = invoice.invoice_data || {};
        const client = invoiceData.client || {};
        const timesheets = invoiceData.timesheets || [];
        
        // Calculate total jobseeker pay from timesheets
        const totalJobseekerPay = timesheets.reduce((sum: number, ts: any) => {
          return sum + (Number(ts.totalJobseekerPay) || 0);
        }, 0);

        // Calculate margin
        const totalBilledAmount = Number(invoice.subtotal) || 0;
        const paidAmount = totalJobseekerPay;
        const marginAmount = totalBilledAmount - paidAmount;
        const marginPercentage = totalBilledAmount > 0 ? ((marginAmount / totalBilledAmount) * 100).toFixed(2) : '0.00';

        return {
          invoice_number: invoice.invoice_number,
          client_name: client.companyName || 'N/A',
          accounting_person: client.accountingPerson || 'N/A',
          total_billed_amount: totalBilledAmount.toFixed(2),
          paid_amount: paidAmount.toFixed(2),
          margin_amount: marginAmount.toFixed(2),
          margin_percentage: marginPercentage + '%',
          invoice_date: invoice.invoice_date
        };
      });

      res.json(marginData);
    } catch (error) {
      console.error('Unexpected error in margin report:', error);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
);

export default router; 