const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    serviceName: {
        type: String,
        required: true
    },
    servicePrice: {
        type: Number,
        required: true
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

serviceSchema.index({ updatedAt: -1 });
serviceSchema.index({ deleted: 1, createdBy: 1 });

module.exports = mongoose.model('Service', serviceSchema);
