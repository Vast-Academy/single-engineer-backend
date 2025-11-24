const mongoose = require('mongoose');

const serialNumberSchema = new mongoose.Schema({
    serialNo: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['available', 'sold'],
        default: 'available'
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

// Stock history for generic items
const stockHistorySchema = new mongoose.Schema({
    qty: {
        type: Number,
        required: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

const itemSchema = new mongoose.Schema({
    itemType: {
        type: String,
        enum: ['generic', 'serialized'],
        required: true
    },
    itemName: {
        type: String,
        required: true
    },
    unit: {
        type: String,
        required: true
    },
    warranty: {
        type: String,
        default: 'no_warranty'
    },
    mrp: {
        type: Number,
        required: true
    },
    purchasePrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        required: true
    },
    // For Generic items
    stockQty: {
        type: Number,
        default: 0
    },
    // Stock history for generic items
    stockHistory: [stockHistorySchema],
    // For Serialized items
    serialNumbers: [serialNumberSchema],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Virtual to get available stock count for serialized items
itemSchema.virtual('availableStock').get(function() {
    if (this.itemType === 'serialized') {
        return this.serialNumbers.filter(sn => sn.status === 'available').length;
    }
    return this.stockQty;
});

// Ensure virtuals are included in JSON
itemSchema.set('toJSON', { virtuals: true });
itemSchema.set('toObject', { virtuals: true });

// Unique partial index on serial numbers - prevents duplicates across all items
itemSchema.index(
    { 'serialNumbers.serialNo': 1 },
    {
        unique: true,
        partialFilterExpression: { 'serialNumbers.serialNo': { $type: 'string' } }
    }
);

module.exports = mongoose.model('Item', itemSchema);
