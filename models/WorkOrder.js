const mongoose = require('mongoose');

const workOrderSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    workOrderNumber: {
        type: String,
        required: true
    },
    workOrderType: {
        type: String,
        enum: [
            'CCTV Camera',
            'Attendance System',
            'Safe and Locks',
            'Lift & Elevator Solutions',
            'Home/Office Automation',
            'IT & Networking Services',
            'Software & Website Development',
            'Custom'
        ],
        required: true
    },
    scheduleDate: {
        type: Date,
        required: true
    },
    scheduleTime: {
        type: String,
        required: true
    },
    remark: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'completed'],
        default: 'pending'
    },
    completedAt: {
        type: Date,
        default: null
    },
    notificationSent: {
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

// Indexes
workOrderSchema.index({ customer: 1 });
workOrderSchema.index({ createdBy: 1 });
workOrderSchema.index({ status: 1 });
workOrderSchema.index({ scheduleDate: 1 });
workOrderSchema.index({ workOrderNumber: 1 });

module.exports = mongoose.model('WorkOrder', workOrderSchema);
