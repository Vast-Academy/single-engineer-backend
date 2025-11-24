const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
    bankName: {
        type: String,
        required: true,
        trim: true
    },
    accountNumber: {
        type: String,
        required: true,
        trim: true
    },
    ifscCode: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },
    accountHolderName: {
        type: String,
        required: true,
        trim: true
    },
    upiId: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    isPrimary: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Index for faster queries
bankAccountSchema.index({ createdBy: 1 });
bankAccountSchema.index({ createdBy: 1, isPrimary: 1 });

module.exports = mongoose.model('BankAccount', bankAccountSchema);
