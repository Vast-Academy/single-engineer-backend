const Customer = require('../models/Customer');
const Bill = require('../models/Bill');

// Add new customer
const addCustomer = async (req, res) => {
    try {
        const { customerName, phoneNumber, whatsappNumber, address } = req.body;

        if (!customerName || !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Customer name and phone number are required'
            });
        }

        // Check for duplicate phone number for the same user
        const existingCustomer = await Customer.findOne({ 
            phoneNumber, 
            createdBy: req.user._id 
        });

        if (existingCustomer) {
            return res.status(409).json({
                success: false,
                message: 'A customer with this phone number already exists.'
            });
        }

        const newCustomer = await Customer.create({
            customerName,
            phoneNumber,
            whatsappNumber: whatsappNumber || '',
            address: address || '',
            createdBy: req.user._id
        });

        return res.status(201).json({
            success: true,
            message: 'Customer added successfully',
            customer: newCustomer
        });
    } catch (error) {
        console.error('Add customer error:', error.message);
        if (error.code === 11000) { // Handle potential race condition with unique index
            return res.status(409).json({
                success: false,
                message: 'A customer with this phone number already exists.'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to add customer',
            error: error.message
        });
    }
};

// Get all customers with due amount (with pagination)
const getAllCustomers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        // Get total count
        const totalCount = await Customer.countDocuments({ createdBy: req.user._id });

        // Get paginated customers
        const customers = await Customer.find({ createdBy: req.user._id, deleted: false })
            .skip(skip)
            .limit(limit);

        // Calculate due amount for each customer
        const customersWithDue = await Promise.all(
            customers.map(async (customer) => {
                // Get all bills for this customer
                const bills = await Bill.find({
                    customer: customer._id,
                    createdBy: req.user._id
                });

                // Calculate total due
                const totalDue = bills.reduce((sum, bill) => sum + bill.dueAmount, 0);

                return {
                    ...customer.toObject(),
                    totalDue
                };
            })
        );

        // Sort by totalDue (highest first)
        customersWithDue.sort((a, b) => b.totalDue - a.totalDue);

        return res.status(200).json({
            success: true,
            customers: customersWithDue,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount,
                hasMore: page < Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Get customers error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get customers'
        });
    }
};

// Get single customer with bills summary
const getCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        const customer = await Customer.findOne({ _id: id, createdBy: req.user._id, deleted: false });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Get bills for this customer
        const bills = await Bill.find({ customer: id, createdBy: req.user._id, deleted: false })
            .sort({ createdAt: -1 });

        // Calculate totals
        const totalBilled = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
        const totalReceived = bills.reduce((sum, bill) => sum + bill.receivedPayment, 0);
        const totalDue = bills.reduce((sum, bill) => sum + bill.dueAmount, 0);

        return res.status(200).json({
            success: true,
            customer,
            bills,
            summary: {
                totalBills: bills.length,
                totalBilled,
                totalReceived,
                totalDue
            }
        });
    } catch (error) {
        console.error('Get customer error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get customer'
        });
    }
};

// Update customer
const updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { customerName, phoneNumber, whatsappNumber, address } = req.body;

        const customer = await Customer.findOneAndUpdate(
            { _id: id, createdBy: req.user._id, deleted: false },
            { customerName, phoneNumber, whatsappNumber, address },
            { new: true }
        );

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Customer updated successfully',
            customer
        });
    } catch (error) {
        console.error('Update customer error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to update customer'
        });
    }
};

// Delete customer
const deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if customer has bills
        const billCount = await Bill.countDocuments({ customer: id, deleted: false });
        if (billCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete customer with ${billCount} bill(s). Delete bills first.`
            });
        }

        const customer = await Customer.findOneAndUpdate(
            { _id: id, createdBy: req.user._id, deleted: false },
            { deleted: true },
            { new: true }
        );

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Customer deleted successfully'
        });
    } catch (error) {
        console.error('Delete customer error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete customer'
        });
    }
};

// Search customers
const searchCustomers = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const customers = await Customer.find({
            createdBy: req.user._id,
            deleted: false,
            $or: [
                { customerName: { $regex: q, $options: 'i' } },
                { phoneNumber: { $regex: q, $options: 'i' } }
            ]
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            customers
        });
    } catch (error) {
        console.error('Search customers error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to search customers'
        });
    }
};

module.exports = {
    addCustomer,
    getAllCustomers,
    getCustomer,
    updateCustomer,
    deleteCustomer,
    searchCustomers
};
