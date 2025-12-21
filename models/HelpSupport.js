const mongoose = require('mongoose');

const helpSupportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ticketNumber: {
    type: String,
    unique: true,
    required: false  // Auto-generated in pre-save hook
  },
  // User Information
  ownerName: String,
  email: String,
  phone: String,
  alternateEmail: String,
  alternatePhone: String,

  // Issues
  selectedIssues: [{
    type: String
  }],
  customReason: String, // When "Other" is selected

  // Status
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'resolved', 'closed'],
    default: 'pending'
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date,
  adminNotes: String
});

// Generate unique ticket number (e.g., TICK-20251221-0001)
helpSupportSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.constructor.countDocuments({
      createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
    });
    this.ticketNumber = `TICK-${date}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

const HelpSupport = mongoose.model('HelpSupport', helpSupportSchema);

module.exports = HelpSupport;
