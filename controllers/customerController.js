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
        return res.status(500).json({
            success: false,
            message: 'Failed to add customer',
            error: error.message
        });
    }
};

// Get all customers with due amount (paginated + aggregated)
const getAllCustomers = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
        const search = req.query.search ? req.query.search.trim() : '';
        const skip = (page - 1) * limit;
        const userId = req.user._id;

        const match = { createdBy: userId };
        if (search) {
            match.$or = [
                { customerName: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const [customers, total] = await Promise.all([
            Customer.aggregate([
                { $match: match },
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },
                // Lookup bills once to compute outstanding
                {
                    $lookup: {
                        from: 'bills',
                        let: { customerId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$customer', '$$customerId'] },
                                            { $eq: ['$createdBy', userId] }
                                        ]
                                    }
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    totalDue: { $sum: '$dueAmount' }
                                }
                            }
                        ],
                        as: 'billStats'
                    }
                },
                {
                    $addFields: {
                        totalDue: {
                            $ifNull: [{ $arrayElemAt: ['$billStats.totalDue', 0] }, 0]
                        }
                    }
                },
                {
                    $project: {
                        customerName: 1,
                        phoneNumber: 1,
                        whatsappNumber: 1,
                        address: 1,
                        totalDue: 1,
                        createdAt: 1
                    }
                }
            ]),
            Customer.countDocuments(match)
        ]);

        return res.status(200).json({
            success: true,
            customers,
            pagination: {
                page,
                limit,
                total,
                hasMore: skip + customers.length < total
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

        const customer = await Customer.findOne({ _id: id, createdBy: req.user._id });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Get bills for this customer
        const bills = await Bill.find({ customer: id, createdBy: req.user._id })
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
            { _id: id, createdBy: req.user._id },
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
        const billCount = await Bill.countDocuments({ customer: id });
        if (billCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete customer with ${billCount} bill(s). Delete bills first.`
            });
        }

        const customer = await Customer.findOneAndDelete({ _id: id, createdBy: req.user._id });

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
