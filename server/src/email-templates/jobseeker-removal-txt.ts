export function jobseekerRemovalTextTemplate(vars: Record<string, any>) {
  return `Subject: Update Regarding Your Position Assignment

Hi ${vars.jobseeker_first_name || ''},

We wanted to let you know that you have been removed from the following position assignment:

Position Title: ${vars.title || ''}
Location: ${vars.city || ''}, ${vars.province || ''}
Employment Type: ${vars.employment_type || ''} / ${vars.employment_term || ''}
Start Date: ${vars.start_date || ''}
${vars.end_date ? `End Date: ${vars.end_date}\n` : ''}${vars.position_category ? `Category: ${vars.position_category}\n` : ''}${vars.experience ? `Experience Required: ${vars.experience}\n` : ''}${vars.number_of_positions ? `Number of Positions: ${vars.number_of_positions}\n` : ''}If you have any questions or would like to discuss other opportunities, please reply to this email. We are here to support you in your job search.

Best regards,
The Recruitment Team`;
} 