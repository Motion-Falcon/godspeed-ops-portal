import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import { getNoReplyFromEmail } from "../middleware/emailNotifier.js";
import { timesheetHtmlTemplate } from "../email-templates/timesheet-html.js";
import { timesheetTextTemplate } from "../email-templates/timesheet-txt.js";
import {
  effectivePremiumPayRate,
  toNum,
} from "../email-templates/timesheet-email-numeric.js";
import type {
  CreateTimesheetResult,
  DeleteTimesheetResult,
  GenerateInvoiceNumberResult,
  GetAllTimesheetsResult,
  GetJobseekerTimesheetsResult,
  GetTimesheetByIdResult,
  SendTimesheetEmailResult,
  TimesheetFilterParams,
  TimesheetInput,
  TimesheetJobseekerListQuery,
  TimesheetListItem,
  TimesheetListQuery,
  TimesheetRow,
  TimesheetWithJoins,
  UpdateTimesheetDocumentResult,
  UpdateTimesheetResult,
} from "../types/timesheet.types.js";
import {
  addVersionToHistory,
  initializeVersionHistory,
} from "./timesheet.version.js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/** Cash / e-Transfer deduction for email templates: uses line_payment_method when set (split rows). */
export function emailCashDeductionVars(args: {
  linePaymentMethod: string | null | undefined;
  profilePaymentMethod: string | null | undefined;
  cashDeductionStr: string | null | undefined;
  totalRegularHours: number;
  regularPayRate: number;
  premiumPayRate: number;
  totalOvertimeHours: number;
  overtimePayRate: number;
}): { cash_deduction_percentage: number; cash_deduction_amount: number } {
  const pct = parseFloat(args.cashDeductionStr || "0");
  const effectivePm =
    args.linePaymentMethod && String(args.linePaymentMethod).trim() !== ""
      ? args.linePaymentMethod
      : args.profilePaymentMethod || "";
  const applies = effectivePm === "Cash" || effectivePm === "e-Transfer";
  if (!applies || pct <= 0) {
    return { cash_deduction_percentage: 0, cash_deduction_amount: 0 };
  }
  const basePay =
    toNum(args.totalRegularHours) *
      (toNum(args.regularPayRate) + toNum(args.premiumPayRate)) +
    toNum(args.totalOvertimeHours) * toNum(args.overtimePayRate);
  return {
    cash_deduction_percentage: pct,
    cash_deduction_amount: basePay * (pct / 100),
  };
}

function applyTimesheetFilters(query: any, filters: TimesheetFilterParams) {
  const {
    searchTerm,
    jobseekerFilter,
    positionFilter,
    clientFilter,
    invoiceNumberFilter,
    billingEmailFilter,
    emailSentFilter,
    dateRangeStart,
    dateRangeEnd,
  } = filters;

  if (searchTerm && searchTerm.trim().length > 0) {
    const searchTermTrimmed = searchTerm.trim();
    query = query.ilike("invoice_number", `%${searchTermTrimmed}%`);
    query = query.ilike("positions.position_code", `%${searchTermTrimmed}%`);
    query = query.ilike("positions.title", `%${searchTermTrimmed}%`);
    query = query.ilike("positions.client_name", `%${searchTermTrimmed}%`);
  }

  if (jobseekerFilter && jobseekerFilter.trim().length > 0) {
    query = query.ilike(
      "jobseeker_profiles.first_name",
      `%${jobseekerFilter.trim()}%`
    );
  }

  if (positionFilter && positionFilter.trim().length > 0) {
    query = query.ilike("positions.title", `%${positionFilter.trim()}%`);
  }

  if (clientFilter && clientFilter.trim().length > 0) {
    query = query.ilike("positions.client_name", `%${clientFilter.trim()}%`);
  }

  if (invoiceNumberFilter && invoiceNumberFilter.trim().length > 0) {
    query = query.ilike("invoice_number", `%${invoiceNumberFilter.trim()}%`);
  }

  if (billingEmailFilter && billingEmailFilter.trim().length > 0) {
    query = query.ilike(
      "jobseeker_profiles.billing_email",
      `%${billingEmailFilter.trim()}%`
    );
  }

  if (emailSentFilter && emailSentFilter.trim().length > 0) {
    const emailSentBool = emailSentFilter.toLowerCase() === "true";
    query = query.eq("email_sent", emailSentBool);
  }

  if (dateRangeStart && dateRangeStart.trim().length > 0) {
    query = query.gte("week_start_date", dateRangeStart.trim());
  }

  if (dateRangeEnd && dateRangeEnd.trim().length > 0) {
    query = query.lte("week_end_date", dateRangeEnd.trim());
  }

  return query;
}

export async function generateInvoiceNumber(): Promise<GenerateInvoiceNumberResult> {
  const { data: maxInvoiceData, error: maxInvoiceError } = await supabase
    .from("timesheets")
    .select("invoice_number")
    .not("invoice_number", "is", null)
    .order("invoice_number", { ascending: false })
    .limit(1);

  if (maxInvoiceError) {
    console.error("Error fetching max invoice number:", maxInvoiceError);
    return {
      success: false,
      status: 500,
      error: "Failed to generate invoice number",
    };
  }

  let nextInvoiceNumber: string;

  if (!maxInvoiceData || maxInvoiceData.length === 0) {
    nextInvoiceNumber = "000001";
  } else {
    const currentMax = maxInvoiceData[0].invoice_number;
    const currentNumber = parseInt(currentMax, 10);
    const nextNumber = currentNumber + 1;
    nextInvoiceNumber = nextNumber.toString().padStart(6, "0");
  }

  const { data: existingInvoice, error: existingError } = await supabase
    .from("timesheets")
    .select("id")
    .eq("invoice_number", nextInvoiceNumber)
    .maybeSingle();

  if (existingError) {
    console.error("Error checking existing invoice number:", existingError);
    return {
      success: false,
      status: 500,
      error: "Failed to validate invoice number",
    };
  }

  if (existingInvoice) {
    const nextNumber = parseInt(nextInvoiceNumber, 10) + 1;
    nextInvoiceNumber = nextNumber.toString().padStart(6, "0");
  }

  return {
    success: true,
    invoice_number: nextInvoiceNumber,
  };
}

export async function getAllTimesheets(
  userId: string,
  userType: string | undefined,
  query: TimesheetListQuery
): Promise<GetAllTimesheetsResult> {
  const {
    page = "1",
    limit = "10",
    searchTerm = "",
    jobseekerFilter = "",
    positionFilter = "",
    clientFilter = "",
    invoiceNumberFilter = "",
    billingEmailFilter = "",
    emailSentFilter = "",
    dateRangeStart = "",
    dateRangeEnd = "",
  } = query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let baseQuery = supabase.from("timesheets").select(`
          id,
          invoice_number,
          week_start_date,
          week_end_date,
          total_jobseeker_pay,
          email_sent,
          jobseeker_profiles!inner(first_name, last_name, email, billing_email),
          positions!inner(title, position_code, client_name)
        `);

  if (userType === "jobseeker") {
    baseQuery = baseQuery.eq("jobseeker_user_id", userId);
  }

  baseQuery = applyTimesheetFilters(baseQuery, {
    searchTerm,
    jobseekerFilter,
    positionFilter,
    clientFilter,
    invoiceNumberFilter,
    billingEmailFilter,
    emailSentFilter,
    dateRangeStart,
    dateRangeEnd,
  });

  let totalCountQuery = supabase
    .from("timesheets")
    .select("*", { count: "exact", head: true });

  if (userType === "jobseeker") {
    totalCountQuery = totalCountQuery.eq("jobseeker_user_id", userId);
  }

  const { count: totalCount, error: countError } = await totalCountQuery;

  if (countError) {
    console.error("Error getting total count:", countError);
    return {
      success: false,
      status: 500,
      error: "Failed to get total count of timesheets",
    };
  }

  let filteredCountQuery = supabase.from("timesheets").select(
    `
          id,
          invoice_number,
          week_start_date,
          week_end_date,
          total_jobseeker_pay,
          email_sent,
          jobseeker_profiles!inner(first_name, last_name, email, billing_email),
          positions!inner(title, position_code, client_name)
        `,
    { count: "exact", head: true }
  );

  if (userType === "jobseeker") {
    filteredCountQuery = filteredCountQuery.eq("jobseeker_user_id", userId);
  }

  filteredCountQuery = applyTimesheetFilters(filteredCountQuery, {
    searchTerm,
    jobseekerFilter,
    positionFilter,
    clientFilter,
    invoiceNumberFilter,
    billingEmailFilter,
    emailSentFilter,
    dateRangeStart,
    dateRangeEnd,
  });

  const { count: filteredCount, error: filteredCountError } =
    await filteredCountQuery;

  if (filteredCountError) {
    console.error("Error getting filtered count:", filteredCountError);
    return {
      success: false,
      status: 500,
      error: "Failed to get filtered count of timesheets",
    };
  }

  const { data: timesheets, error } = await baseQuery
    .range(offset, offset + limitNum - 1)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching timesheets:", error);
    return { success: false, status: 500, error: "Failed to fetch timesheets" };
  }

  if (!timesheets || timesheets.length === 0) {
    return {
      success: true,
      timesheets: [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount || 0,
        totalFiltered: filteredCount || 0,
        totalPages: Math.ceil((filteredCount || 0) / limitNum),
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  const totalFiltered = filteredCount || 0;
  const totalPages = Math.ceil(totalFiltered / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  return {
    success: true,
    timesheets: timesheets as unknown as TimesheetListItem[],
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: totalCount || 0,
      totalFiltered,
      totalPages,
      hasNextPage,
      hasPrevPage,
    },
  };
}

export async function sendTimesheetEmail(
  id: string,
  userId: string | undefined,
  userType: string | undefined
): Promise<SendTimesheetEmailResult> {
  const { data: timesheet } = await supabase
    .from("timesheets")
    .select(
      `
          *,
          jobseeker_profiles!inner(
            first_name,
            last_name,
            email,
            billing_email,
            payment_method,
            cash_deduction
          ),
          positions!inner(
            title,
            client_name,
            city,
            province,
            premium_pay_rate
          )
        `
    )
    .eq("id", id)
    .maybeSingle();

  if (!timesheet) {
    return {
      success: false,
      status: 404,
      body: { error: "Timesheet not found" },
    };
  }

  const jobseekerProfile = timesheet.jobseeker_profiles;
  const position = timesheet.positions;
  const premiumPayRate = effectivePremiumPayRate(
    timesheet.premium_pay_rate,
    position?.premium_pay_rate
  );

  if (!jobseekerProfile?.email) {
    return {
      success: false,
      status: 400,
      body: { error: "Jobseeker email not found" },
    };
  }

  const emailTo = jobseekerProfile.billing_email || jobseekerProfile.email;

  if (userType === "jobseeker" && userId !== timesheet.jobseeker_user_id) {
    return {
      success: false,
      status: 403,
      body: {
        error:
          "Access denied: You can only send emails for your own timesheets",
      },
    };
  }

  const templateVars = {
    invoice_number: timesheet.invoice_number,
    jobseeker_name: `${jobseekerProfile.first_name} ${jobseekerProfile.last_name}`,
    jobseeker_email: emailTo,
    position_title: position?.title || "Unknown Position",
    week_start_date: timesheet.week_start_date,
    week_end_date: timesheet.week_end_date,
    daily_hours: timesheet.daily_hours || [],
    total_regular_hours: timesheet.total_regular_hours,
    total_overtime_hours: timesheet.total_overtime_hours,
    regular_pay_rate: timesheet.regular_pay_rate,
    premium_pay_rate: premiumPayRate,
    overtime_pay_rate: timesheet.overtime_pay_rate,
    total_jobseeker_pay: timesheet.total_jobseeker_pay,
    overtime_enabled:
      timesheet.overtime_enabled || timesheet.total_overtime_hours > 0,
    bonus_amount: timesheet.bonus_amount,
    deduction_amount: timesheet.deduction_amount,
    ...emailCashDeductionVars({
      linePaymentMethod: timesheet.line_payment_method,
      profilePaymentMethod: jobseekerProfile.payment_method,
      cashDeductionStr: jobseekerProfile.cash_deduction,
      totalRegularHours: toNum(timesheet.total_regular_hours),
      regularPayRate: toNum(timesheet.regular_pay_rate),
      premiumPayRate,
      totalOvertimeHours: toNum(timesheet.total_overtime_hours),
      overtimePayRate: toNum(timesheet.overtime_pay_rate),
    }),
    generated_date: new Date().toLocaleDateString(),
  };

  console.log(
    "Sending timesheet email to:",
    emailTo,
    jobseekerProfile.billing_email ? "(billing email)" : "(primary email)"
  );

  const html = timesheetHtmlTemplate(templateVars);
  const text = timesheetTextTemplate(templateVars);
  const [subjectLine, ...bodyLines] = text.split("\n");
  const subject = subjectLine.replace("Subject:", "").trim();

  let emailSent = false;
  let errorMsg = "";

  try {
    await sgMail.send({
      to: emailTo,
      from: getNoReplyFromEmail(),
      subject,
      text: bodyLines.join("\n").trim(),
      html,
    });
    emailSent = true;
  } catch (err) {
    if (err instanceof Error) {
      errorMsg = err.message;
    } else if (typeof err === "string") {
      errorMsg = err;
    } else {
      errorMsg = JSON.stringify(err);
    }
  }

  if (emailSent) {
    await supabase
      .from("timesheets")
      .update({ email_sent: true })
      .eq("id", id);
  }

  const timesheetSendResult = {
    invoice_number: timesheet.invoice_number,
    jobseeker_name: `${jobseekerProfile.first_name} ${jobseekerProfile.last_name}`,
    email_sent: emailSent,
    error: errorMsg,
  };

  if (emailSent) {
    return {
      success: true,
      status: 200,
      body: {
        success: true,
        message: `Email sent successfully to ${emailTo}`,
        email_sent: true,
      },
      timesheetSendResult,
    };
  }

  return {
    success: false,
    status: 500,
    body: {
      success: false,
      message: `Failed to send email: ${errorMsg}`,
      email_sent: false,
      error: errorMsg,
    },
    timesheetSendResult,
  };
}

export async function getTimesheetById(
  id: string,
  userId: string,
  userType: string | undefined
): Promise<GetTimesheetByIdResult> {
  let query = supabase
    .from("timesheets")
    .select(
      `
          *,
          jobseeker_profiles!inner(id, first_name, last_name, email),
          positions(id, position_code, title, client)
        `
    )
    .eq("id", id);

  if (userType === "jobseeker") {
    query = query.eq("jobseeker_user_id", userId);
  }

  const { data: timesheet, error } = await query.single();

  if (error) {
    console.error("Error fetching timesheet:", error);
    return { success: false, status: 404, error: "Timesheet not found" };
  }

  return { success: true, data: timesheet as TimesheetWithJoins };
}

const CREATE_REQUIRED_FIELDS: (keyof TimesheetInput)[] = [
  "jobseeker_profile_id",
  "jobseeker_user_id",
  "position_id",
  "week_start_date",
  "week_end_date",
  "daily_hours",
  "total_regular_hours",
  "total_overtime_hours",
  "regular_pay_rate",
  "overtime_pay_rate",
  "regular_bill_rate",
  "overtime_bill_rate",
  "total_jobseeker_pay",
  "total_client_bill",
  "overtime_enabled",
];

function withTimesheetDefaults(
  data: TimesheetInput
): Omit<TimesheetRow, "id" | "created_at" | "updated_at"> {
  return {
    ...data,
    premium_pay_rate: data.premium_pay_rate ?? 0,
    email_sent: data.email_sent ?? false,
    pay_split_segment: data.pay_split_segment ?? "single",
    line_payment_method:
      data.line_payment_method === undefined ? null : data.line_payment_method,
  };
}

export async function createTimesheet(
  userId: string,
  userType: string | undefined,
  timesheetData: TimesheetInput
): Promise<CreateTimesheetResult> {
  for (const field of CREATE_REQUIRED_FIELDS) {
    if (
      timesheetData[field] === undefined ||
      timesheetData[field] === null
    ) {
      return {
        success: false,
        status: 400,
        error: `Missing required field: ${field}`,
      };
    }
  }

  if (
    userType === "jobseeker" &&
    timesheetData.jobseeker_user_id !== userId
  ) {
    return {
      success: false,
      status: 403,
      error: "You can only create timesheets for yourself",
    };
  }

  const paySegment = timesheetData.pay_split_segment ?? "single";

  const { data: duplicateTimesheet, error: duplicateCheckError } = await supabase
    .from("timesheets")
    .select("id")
    .eq("jobseeker_profile_id", timesheetData.jobseeker_profile_id)
    .eq("position_id", timesheetData.position_id!)
    .eq("week_start_date", timesheetData.week_start_date)
    .eq("pay_split_segment", paySegment)
    .maybeSingle();

  if (duplicateCheckError) {
    console.error(
      "Error checking for duplicate timesheet:",
      duplicateCheckError
    );
    return {
      success: false,
      status: 500,
      error: "Failed to validate timesheet uniqueness",
    };
  }

  if (duplicateTimesheet) {
    return {
      success: false,
      status: 409,
      error:
        "A timesheet for this jobseeker, position and week already exists",
      field: "position_id",
    };
  }

  const dbTimesheetData = {
    ...withTimesheetDefaults(timesheetData),
    created_by_user_id: userId,
    updated_by_user_id: userId,
    version: 1,
    version_history: initializeVersionHistory(userId),
  };

  const { data: newTimesheet, error: insertError } = await supabase
    .from("timesheets")
    .insert([dbTimesheetData])
    .select("*")
    .single();

  if (insertError) {
    console.error("Error creating timesheet:", insertError);
    console.error("Attempted to insert data:", dbTimesheetData);
    return {
      success: false,
      status: 500,
      error: "Failed to create timesheet",
      details: insertError.message,
      code: insertError.code,
    };
  }

  return { success: true, timesheet: newTimesheet as TimesheetRow };
}

export async function updateTimesheet(
  id: string,
  userId: string,
  userType: string | undefined,
  timesheetData: TimesheetInput
): Promise<UpdateTimesheetResult> {
  let existingQuery = supabase
    .from("timesheets")
    .select(
      "id, jobseeker_user_id, jobseeker_profile_id, week_start_date, position_id, pay_split_segment, version, version_history"
    )
    .eq("id", id);

  if (userType === "jobseeker") {
    existingQuery = existingQuery.eq("jobseeker_user_id", userId);
  }

  const { data: existingTimesheet, error: timesheetCheckError } =
    await existingQuery.maybeSingle();

  if (timesheetCheckError || !existingTimesheet) {
    return {
      success: false,
      status: 404,
      error: "Timesheet not found or access denied",
    };
  }

  if (
    userType === "jobseeker" &&
    timesheetData.jobseeker_user_id !== userId
  ) {
    return {
      success: false,
      status: 403,
      error: "You can only update your own timesheets",
    };
  }

  const mergedWeek =
    timesheetData.week_start_date ?? existingTimesheet.week_start_date;
  const mergedPositionId =
    timesheetData.position_id ?? existingTimesheet.position_id;
  const mergedProfileId =
    timesheetData.jobseeker_profile_id ?? existingTimesheet.jobseeker_profile_id;
  const mergedSegment =
    timesheetData.pay_split_segment ??
    existingTimesheet.pay_split_segment ??
    "single";

  const { data: duplicateTimesheet, error: duplicateCheckError } =
    await supabase
      .from("timesheets")
      .select("id")
      .eq("jobseeker_profile_id", mergedProfileId)
      .eq("position_id", mergedPositionId)
      .eq("week_start_date", mergedWeek)
      .eq("pay_split_segment", mergedSegment)
      .neq("id", id)
      .maybeSingle();

  if (duplicateCheckError) {
    console.error(
      "Error checking for duplicate timesheet:",
      duplicateCheckError
    );
    return {
      success: false,
      status: 500,
      error: "Failed to validate timesheet uniqueness",
    };
  }

  if (duplicateTimesheet) {
    return {
      success: false,
      status: 409,
      error:
        "Another timesheet for this jobseeker, position, week, and pay segment already exists",
      field: "position_id",
    };
  }

  const newVersion = (existingTimesheet.version ?? 1) + 1;
  const dbTimesheetData = {
    ...withTimesheetDefaults(timesheetData),
    updated_by_user_id: userId,
    updated_at: new Date().toISOString(),
    version: newVersion,
    version_history: addVersionToHistory(
      existingTimesheet.version_history || [],
      userId,
      newVersion
    ),
  };

  const { data: updatedTimesheet, error: updateError } = await supabase
    .from("timesheets")
    .update(dbTimesheetData)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    console.error("Error updating timesheet:", updateError);
    return { success: false, status: 500, error: "Failed to update timesheet" };
  }

  return { success: true, timesheet: updatedTimesheet as TimesheetRow };
}

export async function deleteTimesheet(
  id: string,
  userId: string,
  userType: string | undefined
): Promise<DeleteTimesheetResult> {
  let existingQuery = supabase.from("timesheets").select("*").eq("id", id);

  if (userType === "jobseeker") {
    existingQuery = existingQuery.eq("jobseeker_user_id", userId);
  }

  const { data: existingTimesheet, error: timesheetCheckError } =
    await existingQuery.maybeSingle();

  if (timesheetCheckError || !existingTimesheet) {
    return {
      success: false,
      status: 404,
      error: "Timesheet not found or access denied",
    };
  }

  const { error: deleteError } = await supabase
    .from("timesheets")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Error deleting timesheet:", deleteError);
    return { success: false, status: 500, error: "Failed to delete timesheet" };
  }

  return {
    success: true,
    deleted_id: id,
    timesheet: existingTimesheet as TimesheetRow,
  };
}

export async function getJobseekerTimesheets(
  jobseekerUserId: string,
  userType: string | undefined,
  requestUserId: string,
  query: TimesheetJobseekerListQuery
): Promise<GetJobseekerTimesheetsResult> {
  if (userType === "jobseeker" && jobseekerUserId !== requestUserId) {
    return {
      success: false,
      status: 403,
      error: "You can only access your own timesheets",
    };
  }

  const {
    page = "1",
    limit = "10",
    dateRangeStart = "",
    dateRangeEnd = "",
  } = query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let dbQuery = supabase
    .from("timesheets")
    .select(
      `
          *,
          jobseeker_profiles!inner(id, first_name, last_name, email),
          positions(id, position_code, title, client)
        `
    )
    .eq("jobseeker_user_id", jobseekerUserId);

  if (dateRangeStart) {
    dbQuery = dbQuery.gte("week_start_date", dateRangeStart);
  }
  if (dateRangeEnd) {
    dbQuery = dbQuery.lte("week_end_date", dateRangeEnd);
  }

  let countQuery = supabase
    .from("timesheets")
    .select("*", { count: "exact", head: true })
    .eq("jobseeker_user_id", jobseekerUserId);

  if (dateRangeStart) {
    countQuery = countQuery.gte("week_start_date", dateRangeStart);
  }
  if (dateRangeEnd) {
    countQuery = countQuery.lte("week_end_date", dateRangeEnd);
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    console.error("Error getting count:", countError);
    return {
      success: false,
      status: 500,
      error: "Failed to get count of timesheets",
    };
  }

  const { data: timesheets, error } = await dbQuery
    .range(offset, offset + limitNum - 1)
    .order("week_start_date", { ascending: false });

  if (error) {
    console.error("Error fetching jobseeker timesheets:", error);
    return { success: false, status: 500, error: "Failed to fetch timesheets" };
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / limitNum);

  return {
    success: true,
    timesheets: (timesheets || []) as unknown as TimesheetWithJoins[],
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
  };
}

export async function updateTimesheetDocument(
  id: string,
  userId: string,
  userType: string | undefined,
  document: string
): Promise<UpdateTimesheetDocumentResult> {
  if (!document || typeof document !== "string") {
    return {
      success: false,
      status: 400,
      error: "Document field is required and must be a string",
    };
  }

  let existingQuery = supabase
    .from("timesheets")
    .select("id, jobseeker_user_id")
    .eq("id", id);

  if (userType === "jobseeker") {
    existingQuery = existingQuery.eq("jobseeker_user_id", userId);
  }

  const { data: existingTimesheet, error: timesheetCheckError } =
    await existingQuery.maybeSingle();

  if (timesheetCheckError || !existingTimesheet) {
    return {
      success: false,
      status: 404,
      error: "Timesheet not found or access denied",
    };
  }

  const { data: updatedTimesheet, error: updateError } = await supabase
    .from("timesheets")
    .update({
      document,
      updated_by_user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    console.error("Error updating timesheet document:", updateError);
    return {
      success: false,
      status: 500,
      error: "Failed to update timesheet document",
    };
  }

  return { success: true, timesheet: updatedTimesheet as TimesheetRow };
}

export { supabase };
