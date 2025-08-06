export function jobseekerAssignmentTextTemplate(vars: Record<string, any>) {
  return `Subject: Congratulations! You've Been Matched to a New Position Opportunity

Hi ${vars.jobseeker_first_name || ''},

We are excited to inform you that you have been matched to a new position opportunity:

Position Title: ${vars.title || ''}
Location: ${vars.city || ''}, ${vars.province || ''}
Employment Type: ${vars.employment_type || ''} / ${vars.employment_term || ''}
Start Date: ${vars.start_date || ''}
${vars.end_date ? `End Date: ${vars.end_date}\n` : ''}${vars.position_category ? `Category: ${vars.position_category}\n` : ''}${vars.experience ? `Experience Required: ${vars.experience}\n` : ''}${vars.number_of_positions ? `Number of Positions: ${vars.number_of_positions}\n` : ''}Our team will reach out to you soon with further details and next steps. 

Please review the attached Godspeed Employee Handbook 2024, which contains important information about our company policies, procedures, and expectations. This handbook will help you understand your rights and responsibilities as a Godspeed employee.

If you have any questions, feel free to reply to this email.

Congratulations again, and we look forward to supporting you in this new opportunity!

Best regards,
The Recruitment Team

---

If you believe this message was sent in error or you are no longer interested in this opportunity, please let us know by replying to this email.`;
}
