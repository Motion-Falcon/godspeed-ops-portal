import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { sanitizeInputs } from "../middleware/security.js";
import { activityLogger } from "../middleware/activityLogger.js";
import { emailNotifier } from "../middleware/emailNotifier.js";
import {
  generateInvoiceNumber,
  getAllTimesheets,
  sendTimesheetEmail,
  getTimesheetById,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
  getJobseekerTimesheets,
  updateTimesheetDocument,
} from "../controllers/timesheet.controller.js";
import { supabase } from "../services/timesheet.service.js";
import {
  buildCreateTimesheetNotifierEmail,
  buildUpdateTimesheetNotifierEmail,
} from "../services/timesheet.email.js";
import type { TimesheetInput } from "../types/timesheet.types.js";

const router = Router();

router.get(
  "/generate-invoice-number",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  generateInvoiceNumber
);

router.get(
  "/jobseeker/:jobseekerUserId",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  getJobseekerTimesheets
);

router.post(
  "/send-email/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  activityLogger({
    onSuccess: (req, res) => {
      const { id } = req.params;
      const result =
        res.locals.timesheetSendResult || res.locals.timesheet || {};
      return {
        actionType: "send_bulk_timesheet_email",
        actionVerb: "sent email",
        primaryEntityType: "timesheet",
        primaryEntityId: id,
        primaryEntityName: result.invoice_number || id,
        displayMessage: `Sent timesheet email for invoice ${
          result.invoice_number || id
        } to ${result.jobseeker_name || "jobseeker"}`,
        category: "financial",
        priority: "normal",
        metadata: {
          invoice_number: result.invoice_number,
          jobseeker_name: result.jobseeker_name,
          email_sent: result.email_sent,
        },
      };
    },
  }),
  sendTimesheetEmail
);

router.get(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  getAllTimesheets
);

router.post(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  sanitizeInputs,
  activityLogger({
    onSuccess: async (req: Request, res: Response) => {
      const timesheetData = req.body as TimesheetInput;
      const newTimesheet = res.locals.newTimesheet;

      let jobseekerName = "Unknown Jobseeker";
      if (timesheetData.jobseeker_profile_id) {
        try {
          const { data: profile } = await supabase
            .from("jobseeker_profiles")
            .select("first_name, last_name")
            .eq("id", timesheetData.jobseeker_profile_id)
            .single();
          if (profile) {
            jobseekerName = `${profile.first_name} ${profile.last_name}`;
          }
        } catch {
          console.warn("Could not fetch jobseeker name for activity log");
        }
      }

      let positionTitle = "Unknown Position";
      if (timesheetData.position_id) {
        try {
          const { data: position } = await supabase
            .from("positions")
            .select("title, position_code")
            .eq("id", timesheetData.position_id)
            .single();
          if (position) {
            positionTitle = position.title || position.position_code;
          }
        } catch {
          console.warn("Could not fetch position title for activity log");
        }
      }

      return {
        actionType: "create_timesheet",
        actionVerb: "created",
        primaryEntityType: "timesheet",
        primaryEntityId: newTimesheet?.id,
        primaryEntityName: `Timesheet for week ${timesheetData.week_start_date}`,
        secondaryEntityType: "jobseeker",
        secondaryEntityId: timesheetData.jobseeker_profile_id,
        secondaryEntityName: jobseekerName,
        tertiaryEntityType: "position",
        tertiaryEntityId: timesheetData.position_id,
        tertiaryEntityName: positionTitle,
        displayMessage: `Created timesheet for ${jobseekerName} (${positionTitle}) - Week ${timesheetData.week_start_date}`,
        category: "financial",
        priority: "normal" as const,
        metadata: {
          week_start_date: timesheetData.week_start_date,
          week_end_date: timesheetData.week_end_date,
          total_regular_hours: timesheetData.total_regular_hours,
          total_overtime_hours: timesheetData.total_overtime_hours,
          total_jobseeker_pay: timesheetData.total_jobseeker_pay,
          total_client_bill: timesheetData.total_client_bill,
          invoice_number: timesheetData.invoice_number,
        },
      };
    },
  }),
  emailNotifier({
    onSuccessEmail: async (req: Request, res: Response) => {
      if (!req.body.email_sent) return null;
      return buildCreateTimesheetNotifierEmail(
        req.body as TimesheetInput,
        res.locals.newTimesheet
      );
    },
  }),
  createTimesheet
);

router.patch(
  "/:id/document",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  sanitizeInputs,
  updateTimesheetDocument
);

router.put(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  sanitizeInputs,
  activityLogger({
    onSuccess: async (req: Request, res: Response) => {
      const timesheetData = req.body as TimesheetInput;
      const { id } = req.params;

      let jobseekerName = "Unknown Jobseeker";
      if (timesheetData.jobseeker_profile_id) {
        try {
          const { data: profile } = await supabase
            .from("jobseeker_profiles")
            .select("first_name, last_name")
            .eq("id", timesheetData.jobseeker_profile_id)
            .single();
          if (profile) {
            jobseekerName = `${profile.first_name} ${profile.last_name}`;
          }
        } catch {
          console.warn("Could not fetch jobseeker name for activity log");
        }
      }

      let positionTitle = "Unknown Position";
      if (timesheetData.position_id) {
        try {
          const { data: position } = await supabase
            .from("positions")
            .select("title, position_code")
            .eq("id", timesheetData.position_id)
            .single();
          if (position) {
            positionTitle = position.title || position.position_code;
          }
        } catch {
          console.warn("Could not fetch position title for activity log");
        }
      }

      return {
        actionType: "update_timesheet",
        actionVerb: "updated",
        primaryEntityType: "timesheet",
        primaryEntityId: id,
        primaryEntityName: `Timesheet for week ${timesheetData.week_start_date}`,
        secondaryEntityType: "jobseeker",
        secondaryEntityId: timesheetData.jobseeker_profile_id,
        secondaryEntityName: jobseekerName,
        tertiaryEntityType: "position",
        tertiaryEntityId: timesheetData.position_id,
        tertiaryEntityName: positionTitle,
        displayMessage: `Updated timesheet for ${jobseekerName} (${positionTitle}) - Week ${timesheetData.week_start_date}`,
        category: "financial",
        priority: "normal" as const,
        metadata: {
          week_start_date: timesheetData.week_start_date,
          week_end_date: timesheetData.week_end_date,
          total_regular_hours: timesheetData.total_regular_hours,
          total_overtime_hours: timesheetData.total_overtime_hours,
          total_jobseeker_pay: timesheetData.total_jobseeker_pay,
          total_client_bill: timesheetData.total_client_bill,
          invoice_number: timesheetData.invoice_number,
        },
      };
    },
  }),
  emailNotifier({
    onSuccessEmail: async (req: Request, res: Response) => {
      if (!req.body.email_sent) return null;
      return buildUpdateTimesheetNotifierEmail(
        req.body as TimesheetInput,
        res.locals.updatedTimesheet
      );
    },
  }),
  updateTimesheet
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  activityLogger({
    onSuccess: async (req: Request, res: Response) => {
      const { id } = req.params;
      const deletedTimesheet = res.locals.deletedTimesheet;

      let jobseekerName = "Unknown Jobseeker";
      if (deletedTimesheet?.jobseeker_user_id) {
        try {
          const { data: profile } = await supabase
            .from("jobseeker_profiles")
            .select("first_name, last_name")
            .eq("user_id", deletedTimesheet.jobseeker_user_id)
            .single();
          if (profile) {
            jobseekerName = `${profile.first_name} ${profile.last_name}`;
          }
        } catch {
          console.warn("Could not fetch jobseeker name for activity log");
        }
      }

      let positionTitle = "Unknown Position";
      if (deletedTimesheet?.position_id) {
        try {
          const { data: position } = await supabase
            .from("positions")
            .select("title, position_code")
            .eq("id", deletedTimesheet.position_id)
            .single();
          if (position) {
            positionTitle = position.title || position.position_code;
          }
        } catch {
          console.warn("Could not fetch position title for activity log");
        }
      }

      return {
        actionType: "delete_timesheet",
        actionVerb: "deleted",
        primaryEntityType: "timesheet",
        primaryEntityId: id,
        primaryEntityName: `Timesheet for week ${
          deletedTimesheet?.week_start_date || "Unknown"
        }`,
        secondaryEntityType: "jobseeker",
        secondaryEntityId: deletedTimesheet?.jobseeker_profile_id,
        secondaryEntityName: jobseekerName,
        tertiaryEntityType: "position",
        tertiaryEntityId: deletedTimesheet?.position_id,
        tertiaryEntityName: positionTitle,
        displayMessage: `Deleted timesheet for ${jobseekerName} (${positionTitle}) - Week ${
          deletedTimesheet?.week_start_date || "Unknown"
        }`,
        category: "financial",
        priority: "high" as const,
        metadata: {
          week_start_date: deletedTimesheet?.week_start_date,
          week_end_date: deletedTimesheet?.week_end_date,
          total_regular_hours: deletedTimesheet?.total_regular_hours,
          total_overtime_hours: deletedTimesheet?.total_overtime_hours,
          total_jobseeker_pay: deletedTimesheet?.total_jobseeker_pay,
          total_client_bill: deletedTimesheet?.total_client_bill,
          invoice_number: deletedTimesheet?.invoice_number,
        },
      };
    },
  }),
  deleteTimesheet
);

router.get(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  getTimesheetById
);

export default router;
