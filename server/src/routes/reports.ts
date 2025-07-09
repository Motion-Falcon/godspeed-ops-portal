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

// POST /api/reports/invoice
router.post(
  '/invoice',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, clientIds } = req.body || {};
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required.' });
      }

      // Build query with date range filter
      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          currency,
          client_id,
          grand_total,
          email_sent,
          email_sent_date,
          invoice_data
        `)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate);

      // Apply client filter if provided
      if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
        query = query.in('client_id', clientIds);
      }

      query = query.order('invoice_date', { ascending: false });

      const { data: invoices, error } = await query;

      if (error) {
        console.error('Error fetching invoice report:', error);
        return res.status(500).json({ error: 'Failed to fetch invoice report.' });
      }

      // Get unique client IDs to fetch client information
      const clientIdsSet = new Set((invoices || []).map((invoice: any) => invoice.client_id).filter(Boolean));
      let clientInfoMap: Record<string, any> = {};
      
      if (clientIdsSet.size > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, company_name, contact_person_name1, terms')
          .in('id', Array.from(clientIdsSet));
        
        if (!clientsError && clientsData) {
          clientsData.forEach((client: any) => {
            clientInfoMap[client.id] = client;
          });
        }
      }

      // Transform the data for the frontend
      const invoiceData = (invoices || []).map((invoice: any) => {
        const invoiceData = invoice.invoice_data || {};
        const clientFromInvoice = invoiceData.client || {};
        const clientFromDB = clientInfoMap[invoice.client_id] || {};

        return {
          invoice_number: invoice.invoice_number,
          client_name: clientFromDB.company_name || clientFromInvoice.companyName || 'N/A',
          contact_person: clientFromDB.contact_person_name1 || clientFromInvoice.contactPersonName1 || 'N/A',
          terms: clientFromDB.terms || invoiceData.paymentTerms || 'N/A',
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          total_amount: (Number(invoice.grand_total) || 0).toFixed(2),
          currency: invoice.currency || 'N/A',
          email_sent: invoice.email_sent ? 'Yes' : 'No',
          email_sent_date: invoice.email_sent_date || 'N/A'
        };
      });

      res.json(invoiceData);
    } catch (error) {
      console.error('Unexpected error in invoice report:', error);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
);

// POST /api/reports/deduction
router.post(
  '/deduction',
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
        console.error('Error fetching deduction report:', error);
        return res.status(500).json({ error: 'Failed to fetch deduction report.' });
      }

      // Filter invoices that have deductions (negative bill rates) and transform the data
      const deductionData = (invoices || [])
        .map((invoice: any) => {
          const invoiceData = invoice.invoice_data || {};
          const client = invoiceData.client || {};
          const timesheets = invoiceData.timesheets || [];
          
          // Find timesheets with negative bill rates (deductions)
          const deductionTimesheets = timesheets.filter((ts: any) => {
            const billRate = Number(ts.regularBillRate) || 0;
            return billRate < 0;
          });

          if (deductionTimesheets.length === 0) {
            return null; // Skip invoices without deductions
          }

          // Calculate total deductions and format jobseeker details
          let totalDeductions = 0;
          const jobseekerDeductions: string[] = [];

          deductionTimesheets.forEach((ts: any) => {
            const deductionAmount = Math.abs(Number(ts.regularBillRate) || 0);
            totalDeductions += deductionAmount;
            
            const jobseekerProfile = ts.jobseekerProfile || {};
            const jobseekerName = `${jobseekerProfile.firstName || ''} ${jobseekerProfile.lastName || ''}`.trim() || 'N/A';
            jobseekerDeductions.push(`${jobseekerName} (-$${deductionAmount.toFixed(2)})`);
          });

          // Calculate total amount (could be different from subtotal due to mixed positive/negative rates)
          const totalAmount = timesheets.reduce((sum: number, ts: any) => {
            return sum + (Number(ts.totalClientBill) || 0);
          }, 0);

          return {
            invoice_number: invoice.invoice_number,
            client_name: client.companyName || 'N/A',
            accounting_person: client.accountingPerson || 'N/A',
            total_amount: totalAmount.toFixed(2),
            jobseeker_deductions: jobseekerDeductions.join(', '),
            total_deductions_amount: totalDeductions.toFixed(2),
            invoice_date: invoice.invoice_date
          };
        })
        .filter(Boolean); // Remove null entries (invoices without deductions)

      res.json(deductionData);
    } catch (error) {
      console.error('Unexpected error in deduction report:', error);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
);

// POST /api/reports/rate-list
router.post(
  '/rate-list',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  async (req: Request, res: Response) => {
    try {
      const { clientIds } = req.body || {};
      
      // Build query with optional client filter
      let query = supabase
        .from('positions')
        .select(`
          id,
          title,
          position_code,
          position_number,
          position_category,
          regular_pay_rate,
          bill_rate,
          overtime_hours,
          overtime_pay_rate,
          overtime_bill_rate,
          client_name,
          client:clients (
            id,
            company_name
          )
        `)
        .eq('is_draft', false);

      // Apply client filter if provided
      if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
        query = query.in('client', clientIds);
      }

      const { data: positions, error } = await query.order('client_name', { ascending: true });

      if (error) {
        console.error('Error fetching rate list:', error);
        return res.status(500).json({ error: 'Failed to fetch rate list.' });
      }

      // Transform the data for the frontend
      const rateListData = (positions || []).map((position: any) => {
        const client = position.client || {};
        
        return {
          client_name: position.client_name || client.company_name || 'N/A',
          position_details: `${position.title || 'N/A'} [${position.position_code || 'N/A'} - ${position.position_number || 'N/A'}]`,
          position_category: position.position_category || 'N/A',
          bill_rate: position.bill_rate || 'N/A',
          pay_rate: position.regular_pay_rate || 'N/A',
          overtime_hours: position.overtime_hours || 'N/A',
          overtime_bill_rate: position.overtime_bill_rate || 'N/A',
          overtime_pay_rate: position.overtime_pay_rate || 'N/A'
        };
      });

      res.json(rateListData);
    } catch (error) {
      console.error('Unexpected error in rate list:', error);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
);

// POST /api/reports/clients
router.post(
  '/clients',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  async (req: Request, res: Response) => {
    try {
      const { clientManagerIds, paymentMethods, terms } = req.body || {};
      
      let query = supabase
        .from('clients')
        .select('*')
        .eq('is_draft', false)
        .order('company_name', { ascending: true });

      // Apply filters
      if (clientManagerIds && Array.isArray(clientManagerIds) && clientManagerIds.length > 0) {
        query = query.in('client_manager', clientManagerIds);
      }
      
      if (paymentMethods && Array.isArray(paymentMethods) && paymentMethods.length > 0) {
        query = query.in('preferred_payment_method', paymentMethods);
      }
      
      if (terms && Array.isArray(terms) && terms.length > 0) {
        query = query.in('terms', terms);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching clients report:', error);
        return res.status(500).json({ error: 'Failed to fetch clients report.' });
      }

      // Map to response format and combine address fields
      const result = (data || []).map((row: any) => {
        // Combine address fields
        const addressParts = [
          row.street_address1,
          row.city1,
          row.province1,
          row.postal_code1
        ].filter(Boolean);

        if (row.street_address2) {
          addressParts.push(row.street_address2);
          if (row.city2) addressParts.push(row.city2);
          if (row.province2) addressParts.push(row.province2);
          if (row.postal_code2) addressParts.push(row.postal_code2);
        }

        if (row.street_address3) {
          addressParts.push(row.street_address3);
          if (row.city3) addressParts.push(row.city3);
          if (row.province3) addressParts.push(row.province3);
          if (row.postal_code3) addressParts.push(row.postal_code3);
        }

        const address = addressParts.join(', ');

        return {
          company_name: row.company_name || '',
          billing_name: row.billing_name || '',
          short_code: row.short_code || '',
          list_name: row.list_name || '',
          accounting_person: row.accounting_person || '',
          sales_person: row.sales_person || '',
          client_manager: row.client_manager || '',
          contact_person_name1: row.contact_person_name1 || '',
          email_address1: row.email_address1 || '',
          mobile1: row.mobile1 || '',
          address: address,
          preferred_payment_method: row.preferred_payment_method || '',
          pay_cycle: row.pay_cycle || '',
          terms: row.terms || '',
          notes: row.notes || '',
        };
      });

      res.json(result);
    } catch (error) {
      console.error('Unexpected error in clients report:', error);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
);

// POST /api/reports/sales
router.post(
  '/sales',
  authenticateToken,
  authorizeRoles(['admin', 'recruiter']),
  async (req: Request, res: Response) => {
    try {
      const { clientIds, startDate, endDate, jobseekerIds, salesPersons } = req.body || {};

      // Query invoices for selected clients and optional date range
      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          client_id,
          subtotal,
          grand_total,
          currency,
          invoice_data
        `)
        .in('client_id', clientIds);
      if (startDate) {
        query = query.gte('invoice_date', startDate);
      }
      if (endDate) {
        query = query.lte('invoice_date', endDate);
      }
      query = query.order('invoice_date', { ascending: false });

      const { data: invoices, error } = await query;

      if (error) {
        console.error('Error fetching sales report:', error);
        return res.status(500).json({ error: 'Failed to fetch sales report.' });
      }

      // Get client information and position details
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, company_name, contact_person_name1, sales_person, terms')
        .in('id', clientIds);

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        return res.status(500).json({ error: 'Failed to fetch clients.' });
      }

      const clientInfoMap: Record<string, any> = {};
      (clientsData || []).forEach((client: any) => {
        clientInfoMap[client.id] = client;
      });

      // Get all unique position IDs from timesheets to fetch position details
      const positionIds = new Set<string>();
      (invoices || []).forEach((invoice: any) => {
        const invoiceData = invoice.invoice_data || {};
        const timesheets = invoiceData.timesheets || [];
        timesheets.forEach((ts: any) => {
          if (ts.position && ts.position.positionId) {
            positionIds.add(ts.position.positionId);
          }
        });
      });
      // Fetch position details for start/end dates
      const { data: positionsData, error: positionsError } = await supabase
        .from('positions')
        .select('id, title, position_code, position_number, position_category, start_date, end_date, notes')
        .in('id', Array.from(positionIds));

      if (positionsError) {
        console.error('Error fetching positions:', positionsError);
        return res.status(500).json({ error: 'Failed to fetch positions.' });
      }

      const positionInfoMap: Record<string, any> = {};
      (positionsData || []).forEach((position: any) => {
        positionInfoMap[position.id] = position;
      });

      // Process invoices and extract timesheets
      const salesData: any[] = [];
      let totalTimesheets = 0;
      let afterWeekFilter = 0;
      let afterJobseekerFilter = 0;
      let afterSalesPersonFilter = 0;
      
      (invoices || []).forEach((invoice: any) => {
        const invoiceData = invoice.invoice_data || {};
        const timesheets = invoiceData.timesheets || [];
        const client = clientInfoMap[invoice.client_id] || {};
        totalTimesheets += timesheets.length;
        
        timesheets.forEach((ts: any) => {
          // Get positionId from nested position object
          const positionId = ts.position && ts.position.positionId;
          const position = positionId ? positionInfoMap[positionId] : {};

          // Apply jobseeker filter
          if (jobseekerIds && Array.isArray(jobseekerIds) && jobseekerIds.length > 0) {
            if (!jobseekerIds.includes(ts.jobseekerProfileId)) return;
          }
          afterJobseekerFilter++;

          // Apply sales person filter
          if (salesPersons && Array.isArray(salesPersons) && salesPersons.length > 0) {
            if (!salesPersons.includes(client.sales_person)) return;
          }
          afterSalesPersonFilter++;

          // Parse tax rate from salesTax string
          let taxRate = 0;
          if (typeof ts.salesTax === 'string') {
            const match = ts.salesTax.match(/^([\d.]+)%/);
            if (match) {
              taxRate = parseFloat(match[1]);
            }
          }
          const amount = Number(ts.totalClientBill) || 0;
          const gstHst = (amount * taxRate) / 100;

          // Calculate values
          const hours = (Number(ts.totalRegularHours || ts.regularHours) || 0);
          const billRate = Number(ts.regularBillRate) || 0;
          const discount = Number(ts.discount) || 0;
          const total = amount + gstHst - discount;

          // Use position fields from timesheet.position if available, else fallback to positions table
          const itemPosition = ts.position && ts.position.title
            ? `${ts.position.title} [${ts.position.positionNumber || ts.position.position_number || ''}]` : 'N/A';
          const positionCategory = ts.position && (ts.position.positionCategory || ts.position.position_category)
            ? (ts.position.positionCategory || ts.position.position_category)
            : (position.position_category || 'N/A');

          // Always use employeeId from invoice data
          const employeeId = ts.jobseekerProfile && ts.jobseekerProfile.employeeId
            ? ts.jobseekerProfile.employeeId
            : 'N/A';

          salesData.push({
            client_name: client.company_name || 'N/A',
            contact_person_name: client.contact_person_name1 || 'N/A',
            sales_person: client.sales_person || 'N/A',
            invoice_number: invoice.invoice_number || 'N/A',
            from_date: position.start_date || 'N/A',
            to_date: position.end_date || 'N/A',
            invoice_date: invoice.invoice_date || 'N/A',
            due_date: invoice.due_date || 'N/A',
            terms: client.terms || 'N/A',
            item_position: itemPosition,
            position_category: positionCategory,
            jobseeker_number: employeeId || 'N/A',
            jobseeker_name: ts.jobseekerProfile ? `${ts.jobseekerProfile.firstName || ''} ${ts.jobseekerProfile.lastName || ''}`.trim() || 'N/A' : 'N/A',
            description: ts.description || position.notes || 'N/A',
            hours: hours.toString(),
            bill_rate: billRate.toFixed(2),
            amount: amount.toFixed(2),
            discount: discount.toFixed(2),
            tax_rate: taxRate.toFixed(2),
            gst_hst: gstHst.toFixed(2),
            total: total.toFixed(2),
            currency: invoice.currency || 'N/A'
          });
        });
      });
      res.json(salesData);
    } catch (error) {
      console.error('Unexpected error in sales report:', error);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
);

export default router; 