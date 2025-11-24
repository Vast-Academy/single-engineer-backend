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

module.exports = mongoose.model('Customer', customerSchema);
