export function jobseekerAssignmentHtmlTemplate(vars: Record<string, any>) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Congratulations! You've Been Matched to a New Position Opportunity</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8f9fa; color: #222; margin: 0; padding: 0; }
      .container { background: #fff; max-width: 600px; margin: 40px auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px 24px; }
      h2 { color: #2e7d32; margin-top: 0; }
      .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      .details-table td { padding: 8px 0; vertical-align: top; }
      .details-table .label { font-weight: bold; color: #555; width: 160px; }
      .footer { font-size: 12px; color: #888; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; }
      .handbook-notice { background: #e8f5e8; border-left: 4px solid #2e7d32; padding: 16px; margin: 20px 0; border-radius: 4px; }
      .handbook-notice h4 { margin: 0 0 8px 0; color: #2e7d32; }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>Congratulations${vars.jobseeker_first_name ? `, ${vars.jobseeker_first_name}` : ''}!</h2>
      <p>We are excited to inform you that you have been matched to a new position opportunity:</p>
      <table class="details-table">
        <tr>
          <td class="label">Position Title:</td>
          <td>${vars.title || ''}</td>
        </tr>
        <tr>
          <td class="label">Location:</td>
          <td>${vars.city || ''}, ${vars.province || ''}</td>
        </tr>
        <tr>
          <td class="label">Employment Type:</td>
          <td>${vars.employment_type || ''} / ${vars.employment_term || ''}</td>
        </tr>
        <tr>
          <td class="label">Start Date:</td>
          <td>${vars.start_date || ''}</td>
        </tr>
        ${vars.end_date ? `
        <tr>
          <td class="label">End Date:</td>
          <td>${vars.end_date}</td>
        </tr>` : ''}
        ${vars.position_category ? `
        <tr>
          <td class="label">Category:</td>
          <td>${vars.position_category}</td>
        </tr>` : ''}
        ${vars.experience ? `
        <tr>
          <td class="label">Experience Required:</td>
          <td>${vars.experience}</td>
        </tr>` : ''}
      </table>
      
      <div class="handbook-notice">
        <h4>📋 Employee Handbook</h4>
        <p>Please review the attached <strong>Godspeed Employee Handbook 2024</strong>, which contains important information about our company policies, procedures, and expectations. This handbook will help you understand your rights and responsibilities as a Godspeed employee.</p>
      </div>
      
      <p>Our team will reach out to you soon with further details and next steps. If you have any questions, feel free to reply to this email.</p>
      <p>Congratulations again, and we look forward to supporting you in this new opportunity!</p>
      <p>Best regards,<br><b>The Recruitment Team</b></p>
      <div class="footer">
        If you believe this message was sent in error or you are no longer interested in this opportunity, please let us know by replying to this email.
      </div>
    </div>
  </body>
</html>
  `;
} 