export function jobseekerAssignmentTextTemplate(vars: Record<string, any>) {
  const portalName = process.env.PORTAL_NAME || 'Ops Portal';
  return `Subject: Congratulations! You've Been Matched to a New Position Opportunity

Hi ${vars.jobseeker_first_name || ""},

We are excited to inform you that you have been matched to a new position opportunity:

Position Title: ${vars.title || ''}
${vars.client_name ? `Client: ${vars.client_name}\n` : ''}Location: ${vars.city || ''}, ${vars.province || ''}
${(vars.street_address || vars.postal_code) ? `Address: ${[vars.street_address, vars.city, vars.province, vars.postal_code].filter(Boolean).join(', ')}\n` : ''}Employment Type: ${vars.employment_type || ''} / ${vars.employment_term || ''}
${(vars.task_time || '').trim() ? `Shift Time: ${vars.task_time}\n` : ''}${(vars.regular_pay_rate || vars.payrate_type) ? `Pay: ${vars.regular_pay_rate ? `$${vars.regular_pay_rate}` : ''}${vars.payrate_type ? ` (${vars.payrate_type})` : ''}\n` : ''}Start Date: ${vars.start_date || ''}
${vars.end_date ? `End Date: ${vars.end_date}\n` : ''}${vars.position_category ? `Category: ${vars.position_category}\n` : ''}${vars.experience ? `Experience Required: ${vars.experience}\n` : ''}${vars.number_of_positions ? `Number of Positions: ${vars.number_of_positions}\n` : ''}Our team will reach out to you soon with further details and next steps. 

If you have any questions, feel free to reply to this email.

Congratulations again, and we look forward to supporting you in this new opportunity!

Best regards,
The ${portalName} Team

---

If you believe this message was sent in error or you are no longer interested in this opportunity, please let us know by replying to this email.`;
}
