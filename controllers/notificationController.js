const User = require('../models/User');

// Register FCM token
const registerFcmToken = async (req, res) => {
    try {
        const { token, device, deviceId } = req.body;

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

        const now = new Date();
        const normalizedDevice = device || 'web';
        const existingByDevice = deviceId
            ? user.fcmTokens.find(t => t.deviceId === deviceId)
            : null;
        const existingByToken = user.fcmTokens.find(t => t.token === token);

        if (existingByDevice) {
            existingByDevice.token = token;
            existingByDevice.device = normalizedDevice;
            existingByDevice.lastSeenAt = now;
            if (!existingByDevice.createdAt) {
                existingByDevice.createdAt = now;
            }
        } else if (existingByToken) {
            existingByToken.deviceId = deviceId || existingByToken.deviceId;
            existingByToken.device = normalizedDevice;
            existingByToken.lastSeenAt = now;
            if (!existingByToken.createdAt) {
                existingByToken.createdAt = now;
            }
        } else {
            user.fcmTokens.push({
                token,
                device: normalizedDevice,
                deviceId: deviceId || undefined,
                createdAt: now,
                lastSeenAt: now
            });
        }

        const maxTokens = parseInt(process.env.MAX_FCM_TOKENS_PER_USER || '10', 10);
        if (Number.isFinite(maxTokens) && user.fcmTokens.length > maxTokens) {
            user.fcmTokens.sort((a, b) => {
                const aTime = new Date(a.lastSeenAt || a.createdAt || 0).getTime();
                const bTime = new Date(b.lastSeenAt || b.createdAt || 0).getTime();
                return aTime - bTime;
            });
            user.fcmTokens = user.fcmTokens.slice(-maxTokens);
        }

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
        const { token, deviceId } = req.body;

        if (!token && !deviceId) {
            return res.status(400).json({
                success: false,
                message: 'FCM token or deviceId is required'
            });
        }

        const pullQuery = deviceId
            ? { deviceId }
            : { token };

        await User.findByIdAndUpdate(req.user._id, {
            $pull: { fcmTokens: pullQuery }
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
