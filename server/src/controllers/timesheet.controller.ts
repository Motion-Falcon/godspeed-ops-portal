import { Request, Response } from "express";
import {
  generateInvoiceNumber as generateInvoiceNumberService,
  getAllTimesheets as getAllTimesheetsService,
  sendTimesheetEmail as sendTimesheetEmailService,
  getTimesheetById as getTimesheetByIdService,
  createTimesheet as createTimesheetService,
  updateTimesheet as updateTimesheetService,
  deleteTimesheet as deleteTimesheetService,
  getJobseekerTimesheets as getJobseekerTimesheetsService,
  updateTimesheetDocument as updateTimesheetDocumentService,
} from "../services/timesheet.service.js";
import type {
  TimesheetInput,
  TimesheetJobseekerListQuery,
  TimesheetListQuery,
} from "../types/timesheet.types.js";

export async function generateInvoiceNumber(
  req: Request,
  res: Response
): Promise<Response | void> {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await generateInvoiceNumberService();

    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(200).json({
      success: true,
      invoice_number: result.invoice_number,
    });
  } catch (error) {
    console.error("Unexpected error generating invoice number:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
}

export async function getAllTimesheets(
  req: Request,
  res: Response
): Promise<Response | void> {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await getAllTimesheetsService(
      req.user.id,
      req.user.user_metadata?.user_type,
      req.query as TimesheetListQuery
    );

    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }

    if (result.timesheets.length === 0) {
      return res.json({
        timesheets: result.timesheets,
        pagination: result.pagination,
      });
    }

    return res.status(200).json({
      timesheets: result.timesheets,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Unexpected error fetching timesheets:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
}

export async function sendTimesheetEmail(
  req: Request,
  res: Response
): Promise<Response | void> {
  try {
    const { id } = req.params;

    const result = await sendTimesheetEmailService(
      id,
      req.user?.id,
      req.user?.user_metadata?.user_type
    );

    if (result.timesheetSendResult) {
      res.locals.timesheetSendResult = result.timesheetSendResult;
    }

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Error sending email for timesheet:", error);
    return res
      .status(500)
      .json({ error: "Failed to send email for timesheet" });
  }
}

export async function getTimesheetById(
  req: Request,
  res: Response
): Promise<Response | void> {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await getTimesheetByIdService(
      req.params.id,
      req.user.id,
      req.user.user_metadata?.user_type
    );

    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(200).json(result.data);
  } catch (error) {
    console.error("Unexpected error fetching timesheet:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
}

export async function createTimesheet(
  req: Request,
  res: Response
): Promise<Response | void> {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await createTimesheetService(
      req.user.id,
      req.user.user_metadata?.user_type,
      req.body as TimesheetInput
    );

    if (!result.success) {
      const body: Record<string, unknown> = { error: result.error };
      if (result.details) body.details = result.details;
      if (result.code) body.code = result.code;
      if (result.field) body.field = result.field;
      return res.status(result.status).json(body);
    }

    res.locals.newTimesheet = result.timesheet;

    return res.status(201).json({
      success: true,
      message: "Timesheet created successfully",
      timesheet: result.timesheet,
    });
  } catch (error) {
    console.error("Unexpected error creating timesheet:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
}

export async function updateTimesheet(
  req: Request,
  res: Response
): Promise<Response | void> {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await updateTimesheetService(
      req.params.id,
      req.user.id,
      req.user.user_metadata?.user_type,
      req.body as TimesheetInput
    );

    if (!result.success) {
      const body: Record<string, unknown> = { error: result.error };
      if (result.field) body.field = result.field;
      return res.status(result.status).json(body);
    }

    res.locals.updatedTimesheet = result.timesheet;

    return res.status(200).json({
      success: true,
      message: "Timesheet updated successfully",
      timesheet: result.timesheet,
    });
  } catch (error) {
    console.error("Unexpected error updating timesheet:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
}

export async function deleteTimesheet(
  req: Request,
  res: Response
): Promise<Response | void> {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await deleteTimesheetService(
      req.params.id,
      req.user.id,
      req.user.user_metadata?.user_type
    );

    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }

    res.locals.deletedTimesheet = result.timesheet;

    return res.status(200).json({
      success: true,
      message: "Timesheet deleted successfully",
      deleted_id: result.deleted_id,
    });
  } catch (error) {
    console.error("Unexpected error deleting timesheet:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
}

export async function getJobseekerTimesheets(
  req: Request,
  res: Response
): Promise<Response | void> {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await getJobseekerTimesheetsService(
      req.params.jobseekerUserId,
      req.user.user_metadata?.user_type,
      req.user.id,
      req.query as TimesheetJobseekerListQuery
    );

    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(200).json({
      timesheets: result.timesheets,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Unexpected error fetching jobseeker timesheets:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
}

export async function updateTimesheetDocument(
  req: Request,
  res: Response
): Promise<Response | void> {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await updateTimesheetDocumentService(
      req.params.id,
      req.user.id,
      req.user.user_metadata?.user_type,
      req.body.document
    );

    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(200).json({
      success: true,
      message: "Timesheet document updated successfully",
      timesheet: result.timesheet,
    });
  } catch (error) {
    console.error("Unexpected error updating timesheet document:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
}
