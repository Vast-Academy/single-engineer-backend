const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
    itemType: {
        type: String,
        enum: ['serialized', 'generic', 'service'],
        required: true
    },
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    itemName: {
        type: String,
        required: true
    },
    // For serialized items
    serialNumber: {
        type: String,
        default: null
    },
    // For generic items
    qty: {
        type: Number,
        default: 1
    },
    price: {
        type: Number,
        required: true
    },
    // Purchase price at time of billing (for profit calculation)
    purchasePrice: {
        type: Number,
        default: 0  // Services have 0 purchase price
    },
    amount: {
        type: Number,
        required: true
    }
}, { _id: true });

const paymentHistorySchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    paidAt: {
        type: Date,
        default: Date.now
    },
    note: {
        type: String,
        default: ''
    }
}, { _id: true });

const billSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    billNumber: {
        type: String,
        required: true
    },
    items: [billItemSchema],
    subtotal: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },
    receivedPayment: {
        type: Number,
        default: 0
    },
    dueAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'upi'],
        default: 'cash'
    },
    paymentHistory: [paymentHistorySchema],
    status: {
        type: String,
        enum: ['pending', 'partial', 'paid'],
        default: 'pending'
    },
    workOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkOrder',
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes
billSchema.index({ customer: 1 });
billSchema.index({ createdBy: 1 });
billSchema.index({ billNumber: 1 });
billSchema.index({ status: 1 });

module.exports = mongoose.model('Bill', billSchema);
