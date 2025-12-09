const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    whatsappNumber: {
        type: String,
        default: ''
    },
    address: {
        type: String,
        default: ''
    },
    deleted: {
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

// Index for faster search
customerSchema.index({ customerName: 'text', phoneNumber: 'text' });
customerSchema.index({ createdBy: 1 });
customerSchema.index({ updatedAt: -1 });
customerSchema.index({ deleted: 1, createdBy: 1 });

module.exports = mongoose.model('Customer', customerSchema);
