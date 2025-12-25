const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firebaseUid: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    displayName: {
        type: String,
        default: ''
    },
    photoURL: {
        type: String,
        default: ''
    },
    phoneNumber: {
        type: String,
        default: ''
    },
    password: {
        type: String,
        default: null  // null means password not set yet
    },
    isPasswordSet: {
        type: Boolean,
        default: false
    },
    // Password Reset Fields
    resetPasswordOTP: {
        type: String,
        default: null
    },
    resetPasswordOTPExpires: {
        type: Date,
        default: null
    },
    resetPasswordOTPAttempts: {
        type: Number,
        default: 0
    },
    // Business Profile Fields
    businessProfile: {
        businessName: {
            type: String,
            default: ''
        },
        ownerName: {
            type: String,
            default: ''
        },
        address: {
            type: String,
            default: ''
        },
        state: {
            type: String,
            default: ''
        },
        city: {
            type: String,
            default: ''
        },
        pincode: {
            type: String,
            default: ''
        },
        phone: {
            type: String,
            default: ''
        },
        hidePhoneOnBills: {
            type: Boolean,
            default: false
        },
        isComplete: {
            type: Boolean,
            default: false
        },
        completedAt: {
            type: Date,
            default: null
        }
    },
    role: {
        type: String,
        default: 'engineer'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    fcmTokens: [{
        token: String,
        device: String,
        deviceId: String,
        createdAt: {
            type: Date,
            default: Date.now
        },
        lastSeenAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);
