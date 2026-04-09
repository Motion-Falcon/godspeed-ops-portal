import { getPortalName, textFooter } from "./_layout.js";

export function jobseekerRemovalTextTemplate(vars: Record<string, any>): string {
  const portalName = getPortalName();
  const lines: string[] = [
    `Subject: Position Assignment Update`,
    ``,
    `Hi${vars.jobseeker_first_name ? ` ${vars.jobseeker_first_name}` : ""},`,
    ``,
    `We're writing to let you know that you've been removed from the following position:`,
    ``,
    `Position: ${vars.title || ""}`,
    `Location: ${vars.city || ""}, ${vars.province || ""}`,
    `Type: ${vars.employment_type || ""} / ${vars.employment_term || ""}`,
    `Start Date: ${vars.start_date || ""}`,
  ];

  if (vars.end_date) lines.push(`End Date: ${vars.end_date}`);
  if (vars.position_category) lines.push(`Category: ${vars.position_category}`);
  if (vars.experience) lines.push(`Experience: ${vars.experience}`);

  lines.push(
    ``,
    `If you have any questions or would like to explore other opportunities, just reply to this email — we're here to help.`,
    ``,
    `Best regards,`,
    `The Team at ${portalName}`,
    ``,
    textFooter(portalName)
  );

  return lines.join("\n");
} 