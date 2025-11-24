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

        // Format current time for comparison (e.g., "10:00 AM")
        const formatTime = (hour, minutes) => {
            const h = hour % 12 || 12;
            const m = minutes.toString().padStart(2, '0');
            const ampm = hour >= 12 ? 'PM' : 'AM';
            return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
        };

        const currentTimeStr = formatTime(currentHour, currentMinutes);

        // Find pending work orders scheduled for today at current time
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const pendingWorkOrders = await WorkOrder.find({
            status: 'pending',
            notificationSent: false,
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
                `${workOrder.workOrderType} for ${workOrder.customer?.customerName || 'Customer'} is scheduled now!`,
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

// Send reminder 30 minutes before
const sendUpcomingReminders = async () => {
    try {
        const now = new Date();
        const reminderTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
        const reminderHour = reminderTime.getHours();
        const reminderMinutes = Math.floor(reminderTime.getMinutes() / 30) * 30; // Round to nearest 30 min

        const formatTime = (hour, minutes) => {
            const h = hour % 12 || 12;
            const m = minutes.toString().padStart(2, '0');
            const ampm = hour >= 12 ? 'PM' : 'AM';
            return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
        };

        const targetTimeStr = formatTime(reminderHour, reminderMinutes);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Find work orders scheduled in ~30 minutes that haven't been reminded
        const upcomingWorkOrders = await WorkOrder.find({
            status: 'pending',
            scheduleDate: {
                $gte: today,
                $lt: tomorrow
            },
            scheduleTime: targetTimeStr
        }).populate('customer', 'customerName phoneNumber');

        for (const workOrder of upcomingWorkOrders) {
            await sendNotification(
                workOrder.createdBy,
                'Upcoming Work Order',
                `${workOrder.workOrderType} for ${workOrder.customer?.customerName || 'Customer'} in 30 minutes!`,
                {
                    workOrderId: workOrder._id.toString(),
                    type: 'work_order_upcoming'
                }
            );
        }

        return { success: true, notified: upcomingWorkOrders.length };
    } catch (error) {
        console.error('Send upcoming reminders error:', error);
        return { success: false, message: error.message };
    }
};

module.exports = {
    sendNotification,
    sendWorkOrderReminders,
    sendUpcomingReminders
};
