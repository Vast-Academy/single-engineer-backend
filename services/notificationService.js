const admin = require('../config/firebase-admin');
const User = require('../models/User');
const WorkOrder = require('../models/WorkOrder');

// Send push notification to a user
const sendNotification = async (userId, title, body, data = {}) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
            console.log('No FCM tokens found for user:', userId);
            return { success: false, message: 'No FCM tokens found' };
        }

        const tokens = user.fcmTokens.map(t => t.token);

        const message = {
            notification: {
                title,
                body
            },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            tokens
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        // Remove invalid tokens
        if (response.failureCount > 0) {
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    invalidTokens.push(tokens[idx]);
                }
            });

            if (invalidTokens.length > 0) {
                await User.findByIdAndUpdate(userId, {
                    $pull: { fcmTokens: { token: { $in: invalidTokens } } }
                });
            }
        }

        if (response.successCount > 0) {
            const successTokens = [];
            response.responses.forEach((resp, idx) => {
                if (resp.success) {
                    successTokens.push(tokens[idx]);
                }
            });
            if (successTokens.length > 0) {
                await User.updateOne(
                    { _id: userId },
                    { $set: { 'fcmTokens.$[t].lastSeenAt': new Date() } },
                    { arrayFilters: [{ 't.token': { $in: successTokens } }] }
                );
            }
        }

        return {
            success: true,
            successCount: response.successCount,
            failureCount: response.failureCount
        };
    } catch (error) {
        console.error('Send notification error:', error);
        return { success: false, message: error.message };
    }
};

// Check and send work order reminders
const sendWorkOrderReminders = async () => {
    try {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();

        // Format current time for comparison (24-hour "HH:MM")
        const formatTime24 = (hour, minutes) => {
            const h = hour.toString().padStart(2, '0');
            const m = minutes.toString().padStart(2, '0');
            return `${h}:${m}`;
        };

        const currentTimeStr = formatTime24(currentHour, currentMinutes);

        // Find pending work orders scheduled for today at current time (only with scheduled time)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const pendingWorkOrders = await WorkOrder.find({
            status: 'pending',
            notificationSent: false,
            hasScheduledTime: true,  // Only work orders with scheduled time
            scheduleDate: {
                $gte: today,
                $lt: tomorrow
            },
            scheduleTime: currentTimeStr
        }).populate('customer', 'customerName phoneNumber');

        console.log(`Found ${pendingWorkOrders.length} work orders to notify at ${currentTimeStr}`);

        for (const workOrder of pendingWorkOrders) {
            await sendNotification(
                workOrder.createdBy,
                'Work Order Reminder',
                `${workOrder.customer?.customerName || 'Customer'}\n${workOrder.note}`,
                {
                    workOrderId: workOrder._id.toString(),
                    type: 'work_order_reminder'
                }
            );

            // Mark notification as sent
            workOrder.notificationSent = true;
            await workOrder.save();
        }

        return { success: true, notified: pendingWorkOrders.length };
    } catch (error) {
        console.error('Send work order reminders error:', error);
        return { success: false, message: error.message };
    }
};

// Cleanup old/unused FCM tokens
const purgeOldFcmTokens = async (days = 60) => {
    try {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const result = await User.updateMany({}, {
            $pull: {
                fcmTokens: {
                    $or: [
                        { lastSeenAt: { $lt: cutoff } },
                        { lastSeenAt: { $exists: false }, createdAt: { $lt: cutoff } }
                    ]
                }
            }
        });
        return { success: true, modifiedCount: result.modifiedCount || 0 };
    } catch (error) {
        console.error('Purge FCM tokens error:', error);
        return { success: false, message: error.message };
    }
};

module.exports = {
    sendNotification,
    sendWorkOrderReminders,
    purgeOldFcmTokens
};
