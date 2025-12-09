const Bill = require('../models/Bill');
const Item = require('../models/Item');
const Service = require('../models/Service');
const Customer = require('../models/Customer');

// Generate bill number
const generateBillNumber = async (userId) => {
    const count = await Bill.countDocuments({ createdBy: userId });
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `BILL-${year}${month}-${(count + 1).toString().padStart(4, '0')}`;
};

// Create new bill
const createBill = async (req, res) => {
    try {
        const { customerId, items, discount, receivedPayment, paymentMethod, workOrderId } = req.body;

        // Validate customer
        const customer = await Customer.findOne({ _id: customerId, createdBy: req.user._id, deleted: false });
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one item is required'
            });
        }

        // Process items and validate stock
        const processedItems = [];
        const serializedItemsToUpdate = []; // Track serialized items for customer info update
        let subtotal = 0;

        for (const item of items) {
            if (item.itemType === 'service') {
                // Service
                const service = await Service.findOne({ _id: item.itemId, createdBy: req.user._id, deleted: false });
                if (!service) {
                    return res.status(404).json({
                        success: false,
                        message: `Service not found: ${item.itemId}`
                    });
                }

                const amount = service.servicePrice * (item.qty || 1);
                processedItems.push({
                    itemType: 'service',
                    itemId: service._id,
                    itemName: service.serviceName,
                    qty: item.qty || 1,
                    price: service.servicePrice,
                    purchasePrice: 0,  // Services have no purchase cost
                    amount
                });
                subtotal += amount;

            } else if (item.itemType === 'serialized') {
                // Serialized item
                const inventoryItem = await Item.findOne({ _id: item.itemId, createdBy: req.user._id, deleted: false });
                if (!inventoryItem) {
                    return res.status(404).json({
                        success: false,
                        message: `Item not found: ${item.itemId}`
                    });
                }

                // Find the serial number
                const serialIndex = inventoryItem.serialNumbers.findIndex(
                    sn => sn.serialNo === item.serialNumber && sn.status === 'available'
                );

                if (serialIndex === -1) {
                    return res.status(400).json({
                        success: false,
                        message: `Serial number ${item.serialNumber} is not available`
                    });
                }

                // Mark as sold
                inventoryItem.serialNumbers[serialIndex].status = 'sold';
                await inventoryItem.save();

                // Track for customer info update after bill creation
                serializedItemsToUpdate.push({
                    itemId: inventoryItem._id,
                    serialNumber: item.serialNumber
                });

                const amount = inventoryItem.salePrice;
                processedItems.push({
                    itemType: 'serialized',
                    itemId: inventoryItem._id,
                    itemName: inventoryItem.itemName,
                    serialNumber: item.serialNumber,
                    qty: 1,
                    price: inventoryItem.salePrice,
                    purchasePrice: inventoryItem.purchasePrice,
                    amount
                });
                subtotal += amount;

            } else if (item.itemType === 'generic') {
                // Generic item
                const inventoryItem = await Item.findOne({ _id: item.itemId, createdBy: req.user._id, deleted: false });
                if (!inventoryItem) {
                    return res.status(404).json({
                        success: false,
                        message: `Item not found: ${item.itemId}`
                    });
                }

                const qty = item.qty || 1;

                // Check stock availability
                if (inventoryItem.stockQty < qty) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for ${inventoryItem.itemName}. Available: ${inventoryItem.stockQty}`
                    });
                }

                // Reduce stock
                inventoryItem.stockQty -= qty;
                await inventoryItem.save();

                const amount = inventoryItem.salePrice * qty;
                processedItems.push({
                    itemType: 'generic',
                    itemId: inventoryItem._id,
                    itemName: inventoryItem.itemName,
                    qty,
                    price: inventoryItem.salePrice,
                    purchasePrice: inventoryItem.purchasePrice,
                    amount
                });
                subtotal += amount;
            }
        }

        // Calculate amounts
        const discountAmount = discount || 0;
        const totalAmount = subtotal - discountAmount;
        const received = receivedPayment || 0;
        const dueAmount = totalAmount - received;

        // Determine status
        let status = 'pending';
        if (received >= totalAmount) {
            status = 'paid';
        } else if (received > 0) {
            status = 'partial';
        }

        // Generate bill number
        const billNumber = await generateBillNumber(req.user._id);

        // Create bill
        const newBill = await Bill.create({
            customer: customerId,
            billNumber,
            items: processedItems,
            subtotal,
            discount: discountAmount,
            totalAmount,
            receivedPayment: received,
            dueAmount,
            paymentMethod: paymentMethod || 'cash',
            paymentHistory: received > 0 ? [{ amount: received, paidAt: new Date() }] : [],
            status,
            workOrderId: workOrderId || null,
            createdBy: req.user._id
        });

        // Update serialized items with customer info and bill number
        if (serializedItemsToUpdate.length > 0) {
            for (const serialItem of serializedItemsToUpdate) {
                await Item.findOneAndUpdate(
                    {
                        _id: serialItem.itemId,
                        'serialNumbers.serialNo': serialItem.serialNumber
                    },
                    {
                        $set: {
                            'serialNumbers.$.customerName': customer.customerName,
                            'serialNumbers.$.billNumber': newBill.billNumber
                        }
                    }
                );
            }
        }

        // If bill created from work order, auto-complete the work order
        if (workOrderId) {
            const WorkOrder = require('../models/WorkOrder');
            await WorkOrder.findByIdAndUpdate(workOrderId, {
                billId: newBill._id,
                status: 'completed',
                completedAt: new Date()
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Bill created successfully',
            bill: newBill
        });
    } catch (error) {
        console.error('Create bill error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to create bill',
            error: error.message
        });
    }
};

// Get all bills for a customer
const getBillsByCustomer = async (req, res) => {
    try {
        const { customerId } = req.params;

        const bills = await Bill.find({ customer: customerId, createdBy: req.user._id, deleted: false })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            bills
        });
    } catch (error) {
        console.error('Get bills error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get bills'
        });
    }
};

// Get single bill
const getBill = async (req, res) => {
    try {
        const { id } = req.params;

        const bill = await Bill.findOne({ _id: id, createdBy: req.user._id, deleted: false })
            .populate('customer', 'customerName phoneNumber');

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found'
            });
        }

        return res.status(200).json({
            success: true,
            bill
        });
    } catch (error) {
        console.error('Get bill error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get bill'
        });
    }
};

// Update payment
const updateBillPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, note } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid payment amount is required'
            });
        }

        const bill = await Bill.findOne({ _id: id, createdBy: req.user._id, deleted: false });

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found'
            });
        }

        // Add to payment history
        bill.paymentHistory.push({
            amount,
            paidAt: new Date(),
            note: note || ''
        });

        // Update received payment and due
        bill.receivedPayment += amount;
        bill.dueAmount = bill.totalAmount - bill.receivedPayment;

        // Update status
        if (bill.receivedPayment >= bill.totalAmount) {
            bill.status = 'paid';
            bill.dueAmount = 0;
        } else if (bill.receivedPayment > 0) {
            bill.status = 'partial';
        }

        await bill.save();

        return res.status(200).json({
            success: true,
            message: 'Payment updated successfully',
            bill
        });
    } catch (error) {
        console.error('Update payment error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to update payment'
        });
    }
};

// Get all bills (for dashboard/reports)
const getAllBills = async (req, res) => {
    try {
        const bills = await Bill.find({ createdBy: req.user._id, deleted: false })
            .populate('customer', 'customerName phoneNumber')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            bills
        });
    } catch (error) {
        console.error('Get all bills error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get bills'
        });
    }
};

// Pay customer overall due (distributes across oldest bills first)
const payCustomerDue = async (req, res) => {
    try {
        const { customerId } = req.params;
        const { amount, note } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid payment amount is required'
            });
        }

        // Validate customer
        const customer = await Customer.findOne({ _id: customerId, createdBy: req.user._id, deleted: false });
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Get all bills with due amount > 0, sorted by oldest first (FIFO)
        const bills = await Bill.find({
            customer: customerId,
            createdBy: req.user._id,
            dueAmount: { $gt: 0 },
            deleted: false
        }).sort({ createdAt: 1 }); // Oldest first

        if (bills.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No pending bills found for this customer'
            });
        }

        // Calculate total due
        const totalDue = bills.reduce((sum, bill) => sum + bill.dueAmount, 0);

        if (amount > totalDue) {
            return res.status(400).json({
                success: false,
                message: `Amount (₹${amount}) cannot exceed total due (₹${totalDue})`
            });
        }

        // Distribute payment across bills (FIFO)
        let remainingPayment = amount;
        const affectedBills = [];

        for (const bill of bills) {
            if (remainingPayment <= 0) break;

            const amountForThisBill = Math.min(bill.dueAmount, remainingPayment);

            // Add to payment history
            bill.paymentHistory.push({
                amount: amountForThisBill,
                paidAt: new Date(),
                note: note || ''
            });

            // Update payment amounts
            bill.receivedPayment += amountForThisBill;
            bill.dueAmount -= amountForThisBill;

            // Update status
            if (bill.dueAmount <= 0) {
                bill.status = 'paid';
                bill.dueAmount = 0; // Ensure it's exactly 0
            } else if (bill.receivedPayment > 0) {
                bill.status = 'partial';
            }

            await bill.save();
            affectedBills.push(bill);

            remainingPayment -= amountForThisBill;
        }

        return res.status(200).json({
            success: true,
            message: `Payment of ₹${amount} distributed across ${affectedBills.length} bill(s)`,
            affectedBills,
            totalPaid: amount
        });
    } catch (error) {
        console.error('Pay customer due error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to process payment',
            error: error.message
        });
    }
};

module.exports = {
    createBill,
    getBillsByCustomer,
    getBill,
    updateBillPayment,
    getAllBills,
    payCustomerDue
};
