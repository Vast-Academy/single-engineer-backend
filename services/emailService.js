const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendPasswordResetOTP = async (email, displayName, otp) => {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: 'Password Reset OTP - Engineer App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Password Reset Request</h2>
          <p>Hello ${displayName || 'User'},</p>
          <p>You requested to reset your password. Use the OTP below to verify your identity:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="color: #1f2937; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #6b7280;">This OTP will expire in <strong>5 minutes</strong>.</p>
          <p style="color: #6b7280;">If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px;">Engineer App - Password Reset Service</p>
        </div>
      `
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log('Password reset OTP sent:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Email service error:', error);
    return { success: false, error: error.message };
  }
};

const sendSupportTicketConfirmation = async (userEmail, userName, ticketNumber) => {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: userEmail,
      subject: `Support Request Received - ${ticketNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Support Request Received</h1>
          </div>

          <div style="padding: 30px; background: #f7fafc;">
            <p style="font-size: 16px; color: #2d3748;">Hi ${userName},</p>

            <p style="font-size: 16px; color: #2d3748;">
              Thank you for contacting MeraSoftware support. We have received your request and our team is reviewing it.
            </p>

            <div style="background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0;">
              <p style="margin: 0; color: #718096; font-size: 14px;">Your Ticket Number</p>
              <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 24px; font-weight: bold;">${ticketNumber}</p>
            </div>

            <p style="font-size: 16px; color: #2d3748;">
              <strong>Expected Resolution Time:</strong> Within 5 minutes
            </p>

            <p style="font-size: 14px; color: #718096; margin-top: 30px;">
              If you have any urgent concerns, please reply to this email or contact us directly.
            </p>

            <p style="font-size: 14px; color: #718096;">
              Best regards,<br/>
              <strong>MeraSoftware Support Team</strong>
            </p>
          </div>

          <div style="background: #2d3748; padding: 20px; text-align: center;">
            <p style="color: #a0aec0; font-size: 12px; margin: 0;">
              © 2025 MeraSoftware. All rights reserved.
            </p>
          </div>
        </div>
      `
    });

    if (error) {
      console.error('Resend error (user confirmation):', error);
      return { success: false, error: error.message };
    }

    console.log('Support ticket confirmation sent:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Email service error (user confirmation):', error);
    return { success: false, error: error.message };
  }
};

const sendAdminSupportNotification = async (ticketData) => {
  try {
    const issuesList = ticketData.selectedIssues.map(issue =>
      `<li style="padding: 5px 0;">${issue}</li>`
    ).join('');

    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: 'contact@merasoftware.com',
      subject: `🚨 New Support Ticket - ${ticketData.ticketNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <div style="background: #e53e3e; padding: 20px;">
            <h2 style="color: white; margin: 0;">🚨 New Support Ticket</h2>
          </div>

          <div style="padding: 30px; background: #f7fafc;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #2d3748; margin-top: 0;">Ticket Information</h3>
              <p><strong>Ticket Number:</strong> ${ticketData.ticketNumber}</p>
              <p><strong>Created:</strong> ${new Date(ticketData.createdAt).toLocaleString()}</p>
              <p><strong>Status:</strong> <span style="background: #fbbf24; padding: 4px 12px; border-radius: 12px; color: #78350f;">Pending</span></p>
            </div>

            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #2d3748; margin-top: 0;">User Details</h3>
              <p><strong>Name:</strong> ${ticketData.ownerName}</p>
              <p><strong>Email:</strong> ${ticketData.email}</p>
              <p><strong>Phone:</strong> ${ticketData.phone}</p>
              ${ticketData.alternateEmail ? `<p><strong>Alternate Email:</strong> ${ticketData.alternateEmail}</p>` : ''}
              ${ticketData.alternatePhone ? `<p><strong>Alternate Phone:</strong> ${ticketData.alternatePhone}</p>` : ''}
            </div>

            <div style="background: white; padding: 20px; border-radius: 8px;">
              <h3 style="color: #2d3748; margin-top: 0;">Reported Issues</h3>
              <ul style="color: #2d3748; line-height: 1.6;">
                ${issuesList}
              </ul>

              ${ticketData.customReason ? `
                <div style="margin-top: 15px; padding: 15px; background: #fef3c7; border-left: 3px solid #f59e0b;">
                  <p style="margin: 0; color: #92400e;"><strong>Additional Details (Other):</strong></p>
                  <p style="margin: 10px 0 0 0; color: #78350f;">${ticketData.customReason}</p>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `
    });

    if (error) {
      console.error('Resend error (admin notification):', error);
      return { success: false, error: error.message };
    }

    console.log('Admin support notification sent:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Email service error (admin notification):', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPasswordResetOTP,
  sendSupportTicketConfirmation,
  sendAdminSupportNotification
};
