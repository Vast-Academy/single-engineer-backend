const User = require('../models/User');

// Register FCM token
const registerFcmToken = async (req, res) => {
    try {
        const { token, device } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'FCM token is required'
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if token already exists
        const existingToken = user.fcmTokens.find(t => t.token === token);
        if (existingToken) {
            return res.status(200).json({
                success: true,
                message: 'Token already registered'
            });
        }

        // Add new token
        user.fcmTokens.push({
            token,
            device: device || 'web',
            createdAt: new Date()
        });

        await user.save();

        return res.status(200).json({
            success: true,
            message: 'FCM token registered successfully'
        });
    } catch (error) {
        console.error('Register FCM token error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to register FCM token'
        });
    }
};

// Remove FCM token
const removeFcmToken = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'FCM token is required'
            });
        }

        await User.findByIdAndUpdate(req.user._id, {
            $pull: { fcmTokens: { token } }
        });

        return res.status(200).json({
            success: true,
            message: 'FCM token removed successfully'
        });
    } catch (error) {
        console.error('Remove FCM token error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to remove FCM token'
        });
    }
};

module.exports = {
    registerFcmToken,
    removeFcmToken
};
