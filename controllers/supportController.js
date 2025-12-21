const HelpSupport = require('../models/HelpSupport');
const { sendSupportTicketConfirmation, sendAdminSupportNotification } = require('../services/emailService');

const submitSupportTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      ownerName,
      email,
      phone,
      alternateEmail,
      alternatePhone,
      selectedIssues,
      customReason
    } = req.body;

    // Validation
    if (!ownerName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Owner name, email, and phone are required'
      });
    }

    if (!selectedIssues || selectedIssues.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one issue'
      });
    }

    // Check if "Other" is selected but no custom reason provided
    if (selectedIssues.includes('Other') && !customReason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide details for "Other" issue'
      });
    }

    // Create support ticket
    const ticket = new HelpSupport({
      userId,
      ownerName,
      email,
      phone,
      alternateEmail,
      alternatePhone,
      selectedIssues,
      customReason
    });

    await ticket.save();

    // Send confirmation email to main email
    sendSupportTicketConfirmation(email, ownerName, ticket.ticketNumber)
      .catch(err => console.error('User email error (main):', err));

    // Send confirmation email to alternate email if provided
    if (alternateEmail && alternateEmail.trim()) {
      sendSupportTicketConfirmation(alternateEmail, ownerName, ticket.ticketNumber)
        .catch(err => console.error('User email error (alternate):', err));
    }

    // Send admin notification
    sendAdminSupportNotification({
      ticketNumber: ticket.ticketNumber,
      ownerName,
      email,
      phone,
      alternateEmail,
      alternatePhone,
      selectedIssues,
      customReason,
      createdAt: ticket.createdAt
    }).catch(err => console.error('Admin email error:', err));

    return res.status(201).json({
      success: true,
      message: 'Support ticket submitted successfully',
      ticketNumber: ticket.ticketNumber
    });

  } catch (error) {
    console.error('Submit support ticket error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit support ticket'
    });
  }
};

module.exports = {
  submitSupportTicket
};
