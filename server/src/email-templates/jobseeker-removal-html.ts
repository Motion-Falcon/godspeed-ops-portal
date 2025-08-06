export function jobseekerRemovalHtmlTemplate(vars: Record<string, any>) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Update Regarding Your Position Assignment</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8f9fa; color: #222; margin: 0; padding: 0; }
      .container { background: #fff; max-width: 600px; margin: 40px auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px 24px; }
      h2 { color: #c62828; margin-top: 0; }
      .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      .details-table td { padding: 8px 0; vertical-align: top; }
      .details-table .label { font-weight: bold; color: #555; width: 160px; }
      .footer { font-size: 12px; color: #888; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>Update Regarding Your Position Assignment</h2>
      <p>Hi ${vars.jobseeker_first_name || ''},</p>
      <p>We wanted to let you know that you have been removed from the following position assignment:</p>
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
        ${vars.number_of_positions ? `
        <tr>
          <td class="label">Number of Positions:</td>
          <td>${vars.number_of_positions}</td>
        </tr>` : ''}
      </table>
      <p>If you have any questions or would like to discuss other opportunities, please reply to this email. We are here to support you in your job search.</p>
      <p>Best regards,<br><b>The Recruitment Team</b></p>
    </div>
  </body>
</html>
  `;
} 