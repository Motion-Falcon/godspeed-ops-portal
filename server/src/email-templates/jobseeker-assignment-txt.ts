import { getPortalName, textFooter } from "./_layout.js";

export function jobseekerAssignmentTextTemplate(vars: Record<string, any>): string {
  const portalName = getPortalName();
  const fullAddress = [vars.street_address, vars.city, vars.province, vars.postal_code]
    .filter(Boolean)
    .join(", ");
  const payDisplay = [
    vars.regular_pay_rate ? `$${vars.regular_pay_rate}` : "",
    vars.payrate_type ? `/ ${vars.payrate_type}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const locationDisplay = (vars.street_address || vars.postal_code)
    ? fullAddress
    : `${vars.city || ""}, ${vars.province || ""}`;

  const employmentTypeDisplay = vars.employment_term
    ? `${vars.employment_type || ""} (${vars.employment_term})`
    : (vars.employment_type || "");

  const subjectTitle = [
    "Assignment Confirmation",
    vars.title ? `: ${vars.title}` : "",
    vars.client_name ? ` at ${vars.client_name}` : "",
    vars.city ? ` (${vars.city})` : "",
  ].join("");

  const lines: string[] = [
    `Subject: ${subjectTitle}`,
    ``,
    `Congratulations${vars.jobseeker_first_name ? `, ${vars.jobseeker_first_name}` : ""}!`,
    ``,
    `We are excited to share that you have been assigned to a new position through ${portalName}.`,
    ``,
    `Please review your assignment details below carefully. To secure your spot, please reply to this email or by call to confirm you are available for this shift.`,
    ``,
    `Assignment Details:`,
    ``,
    `Position: ${vars.title || ""}`,
  ];

  if (vars.client_name) lines.push(`Client: ${vars.client_name}`);
  lines.push(`Location: ${locationDisplay}`);
  lines.push(`Employment Type: ${employmentTypeDisplay}`);
  if (payDisplay) lines.push(`Pay Rate: ${payDisplay}`);
  lines.push(`Start Date: ${vars.start_date || ""}`);
  if (vars.end_date) lines.push(`End Date: ${vars.end_date}`);

  lines.push(
    ``,
    `Our team will reach out to you shortly with specific arrival instructions (who to ask for, dress code, etc.).`,
    ``,
    `If you have any immediate questions, please let us know when you reply to confirm your shift!`,
    ``,
    `Best regards,`,
    `The Team at ${portalName}`,
    ``,
    textFooter(portalName)
  );

  return lines.join("\n");
}
