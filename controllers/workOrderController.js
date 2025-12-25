const WorkOrder = require('../models/WorkOrder');
const Customer = require('../models/Customer');

// Generate work order number testing
const generateWorkOrderNumber = async (userId) => {
    const count = await WorkOrder.countDocuments({ createdBy: userId });
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `WO-${year}${month}-${(count + 1).toString().padStart(4, '0')}`;
};

// Create new work order
const createWorkOrder = async (req, res) => {
    try {
        const { customerId, note, scheduleDate, hasScheduledTime, scheduleTime } = req.body;

        // Validate customer
        const customer = await Customer.findOne({ _id: customerId, createdBy: req.user._id, deleted: false });
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Validate note (mandatory)
        if (!note || note.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Work note is required'
            });
        }

        // Validate time ONLY if hasScheduledTime is true
        if (hasScheduledTime && (!scheduleTime || scheduleTime === '')) {
            return res.status(400).json({
                success: false,
                message: 'Schedule time is required when time is enabled'
            });
        }

        // Validate schedule date (must be today or future)
        const scheduleDateObj = new Date(scheduleDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (scheduleDateObj < today) {
            return res.status(400).json({
                success: false,
                message: 'Schedule date cannot be in the past'
            });
        }

        // Generate work order number
        const workOrderNumber = await generateWorkOrderNumber(req.user._id);

        // Create work order
        const newWorkOrder = await WorkOrder.create({
            customer: customerId,
            workOrderNumber,
            note: note.trim(),
            hasScheduledTime: hasScheduledTime || false,
            scheduleTime: hasScheduledTime ? scheduleTime : '',
            scheduleDate: scheduleDateObj,
            status: 'pending',
            createdBy: req.user._id
        });

        // Populate customer data
        const populatedWorkOrder = await WorkOrder.findById(newWorkOrder._id)
            .populate('customer', 'customerName phoneNumber address');

        return res.status(201).json({
            success: true,
            message: 'Work order created successfully',
            workOrder: populatedWorkOrder
        });
    } catch (error) {
        console.error('Create work order error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to create work order',
            error: error.message
        });
    }
};

// Get all pending work orders (with pagination)
const getPendingWorkOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        // Get total count
        const totalCount = await WorkOrder.countDocuments({
            createdBy: req.user._id,
            status: 'pending',
            deleted: false
        });

        const workOrders = await WorkOrder.find({
            createdBy: req.user._id,
            status: 'pending',
            deleted: false
        })
            .populate('customer', 'customerName phoneNumber address')
            .sort({ scheduleDate: 1, scheduleTime: 1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            workOrders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount,
                hasMore: page < Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Get pending work orders error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get work orders'
        });
    }
};

// Get all completed work orders (with pagination)
const getCompletedWorkOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        // Get total count
        const totalCount = await WorkOrder.countDocuments({
            createdBy: req.user._id,
            status: 'completed',
            deleted: false
        });

        const workOrders = await WorkOrder.find({
            createdBy: req.user._id,
            status: 'completed',
            deleted: false
        })
            .populate('customer', 'customerName phoneNumber address')
            .sort({ completedAt: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            workOrders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount,
                hasMore: page < Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Get completed work orders error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get work orders'
        });
    }
};

// Get single work order
const getWorkOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const workOrder = await WorkOrder.findOne({
            _id: id,
            createdBy: req.user._id,
            deleted: false
        }).populate('customer', 'customerName phoneNumber address');

        if (!workOrder) {
            return res.status(404).json({
                success: false,
                message: 'Work order not found'
            });
        }

        return res.status(200).json({
            success: true,
            workOrder
        });
    } catch (error) {
        console.error('Get work order error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get work order'
        });
    }
};

// Update work order details
const updateWorkOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { note, scheduleDate, hasScheduledTime, scheduleTime } = req.body;

        const workOrder = await WorkOrder.findOne({
            _id: id,
            createdBy: req.user._id,
            deleted: false
        });

        if (!workOrder) {
            return res.status(404).json({
                success: false,
                message: 'Work order not found'
            });
        }

        if (workOrder.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot edit completed work order'
            });
        }

        const originalScheduleDate = workOrder.scheduleDate;
        const originalHasScheduledTime = workOrder.hasScheduledTime;
        const originalScheduleTime = workOrder.scheduleTime || '';
        let scheduleChanged = false;

        // Validate note (mandatory)
        if (note !== undefined) {
            if (!note || note.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Work note is required'
                });
            }
            workOrder.note = note.trim();
        }

        // Validate schedule date if provided
        if (scheduleDate) {
            const scheduleDateObj = new Date(scheduleDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (scheduleDateObj < today) {
                return res.status(400).json({
                    success: false,
                    message: 'Schedule date cannot be in the past'
                });
            }
            if (!originalScheduleDate || scheduleDateObj.getTime() !== originalScheduleDate.getTime()) {
                scheduleChanged = true;
            }
            workOrder.scheduleDate = scheduleDateObj;
        }

        // Update time settings
        if (hasScheduledTime !== undefined) {
            workOrder.hasScheduledTime = hasScheduledTime;
            if (hasScheduledTime !== originalHasScheduledTime) {
                scheduleChanged = true;
            }

            if (hasScheduledTime) {
                if (!scheduleTime || scheduleTime === '') {
                    return res.status(400).json({
                        success: false,
                        message: 'Schedule time is required when time is enabled'
                    });
                }
                if ((scheduleTime || '') !== originalScheduleTime) {
                    scheduleChanged = true;
                }
                workOrder.scheduleTime = scheduleTime;
            } else {
                if (originalScheduleTime !== '') {
                    scheduleChanged = true;
                }
                workOrder.scheduleTime = '';
            }
        }

        if (scheduleChanged) {
            workOrder.notificationSent = false;
        }

        await workOrder.save();

        const updatedWorkOrder = await WorkOrder.findById(id)
            .populate('customer', 'customerName phoneNumber address');

        return res.status(200).json({
            success: true,
            message: 'Work order updated successfully',
            workOrder: updatedWorkOrder
        });
    } catch (error) {
        console.error('Update work order error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to update work order',
            error: error.message
        });
    }
};

// Mark work order as completed
const markAsCompleted = async (req, res) => {
    try {
        const { id } = req.params;

        const workOrder = await WorkOrder.findOne({
            _id: id,
            createdBy: req.user._id,
            deleted: false
        });

        if (!workOrder) {
            return res.status(404).json({
                success: false,
                message: 'Work order not found'
            });
        }

        if (workOrder.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Work order is already completed'
            });
        }

        workOrder.status = 'completed';
        workOrder.completedAt = new Date();
        await workOrder.save();

        const updatedWorkOrder = await WorkOrder.findById(id)
            .populate('customer', 'customerName phoneNumber address');

        return res.status(200).json({
            success: true,
            message: 'Work order marked as completed',
            workOrder: updatedWorkOrder
        });
    } catch (error) {
        console.error('Mark completed error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to update work order'
        });
    }
};

// Delete work order
const deleteWorkOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const workOrder = await WorkOrder.findOneAndUpdate({
            _id: id,
            createdBy: req.user._id,
            deleted: false
        }, {
            deleted: true
        }, { new: true });

        if (!workOrder) {
            return res.status(404).json({
                success: false,
                message: 'Work order not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Work order deleted successfully'
        });
    } catch (error) {
        console.error('Delete work order error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete work order'
        });
    }
};

// Get work orders by customer
const getWorkOrdersByCustomer = async (req, res) => {
    try {
        const { customerId } = req.params;

        const workOrders = await WorkOrder.find({
            customer: customerId,
            createdBy: req.user._id,
            deleted: false
        })
            .populate('customer', 'customerName phoneNumber address')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            workOrders
        });
    } catch (error) {
        console.error('Get customer work orders error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get work orders'
        });
    }
};

// Link work order with bill
const linkWithBill = async (req, res) => {
    try {
        const { workOrderId, billId } = req.body;

        const workOrder = await WorkOrder.findOneAndUpdate(
            { _id: workOrderId, createdBy: req.user._id, deleted: false },
            {
                billId,
                status: 'completed',
                completedAt: new Date()
            },
            { new: true }
        ).populate('customer', 'customerName phoneNumber address');

        if (!workOrder) {
            return res.status(404).json({
                success: false,
                message: 'Work order not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Work order linked with bill successfully',
            workOrder
        });
    } catch (error) {
        console.error('Link with bill error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to link work order with bill',
            error: error.message
        });
    }
};

module.exports = {
    createWorkOrder,
    getPendingWorkOrders,
    getCompletedWorkOrders,
    getWorkOrder,
    updateWorkOrder,
    markAsCompleted,
    deleteWorkOrder,
    getWorkOrdersByCustomer,
    linkWithBill
};
