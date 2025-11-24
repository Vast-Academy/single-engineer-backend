const WorkOrder = require('../models/WorkOrder');
const Customer = require('../models/Customer');

// Generate work order number
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
        const { customerId, workOrderType, scheduleDate, scheduleTime, remark } = req.body;

        // Validate customer
        const customer = await Customer.findOne({ _id: customerId, createdBy: req.user._id });
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
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
            workOrderType,
            scheduleDate: scheduleDateObj,
            scheduleTime,
            remark: remark || '',
            status: 'pending',
            createdBy: req.user._id
        });

        // Populate customer data
        const populatedWorkOrder = await WorkOrder.findById(newWorkOrder._id)
            .populate('customer', 'customerName phoneNumber');

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

// Get all pending work orders
const getPendingWorkOrders = async (req, res) => {
    try {
        const workOrders = await WorkOrder.find({
            createdBy: req.user._id,
            status: 'pending'
        })
            .populate('customer', 'customerName phoneNumber')
            .sort({ scheduleDate: 1, scheduleTime: 1 });

        return res.status(200).json({
            success: true,
            workOrders
        });
    } catch (error) {
        console.error('Get pending work orders error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get work orders'
        });
    }
};

// Get all completed work orders
const getCompletedWorkOrders = async (req, res) => {
    try {
        const workOrders = await WorkOrder.find({
            createdBy: req.user._id,
            status: 'completed'
        })
            .populate('customer', 'customerName phoneNumber')
            .sort({ completedAt: -1 });

        return res.status(200).json({
            success: true,
            workOrders
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
            createdBy: req.user._id
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

// Mark work order as completed
const markAsCompleted = async (req, res) => {
    try {
        const { id } = req.params;

        const workOrder = await WorkOrder.findOne({
            _id: id,
            createdBy: req.user._id
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
            .populate('customer', 'customerName phoneNumber');

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

        const workOrder = await WorkOrder.findOneAndDelete({
            _id: id,
            createdBy: req.user._id
        });

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
            createdBy: req.user._id
        })
            .populate('customer', 'customerName phoneNumber')
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

module.exports = {
    createWorkOrder,
    getPendingWorkOrders,
    getCompletedWorkOrders,
    getWorkOrder,
    markAsCompleted,
    deleteWorkOrder,
    getWorkOrdersByCustomer
};
