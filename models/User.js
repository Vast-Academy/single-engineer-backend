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
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);
