const Bill = require('../models/Bill');
const Item = require('../models/Item');
const WorkOrder = require('../models/WorkOrder');

// Get dashboard metrics
const getDashboardMetrics = async (req, res) => {
    try {
        const userId = req.user._id;
        let { month, year } = req.query;

        // Default to current month if not provided
        const currentDate = new Date();
        month = month ? parseInt(month) : currentDate.getMonth() + 1;
        year = year ? parseInt(year) : currentDate.getFullYear();

        // ===== ALWAYS CURRENT METRICS =====

        // 1. Total Stock (Generic + Serialized)
        const items = await Item.find({ createdBy: userId });

        const genericStock = items
            .filter(i => i.itemType === 'generic')
            .reduce((sum, i) => sum + i.stockQty, 0);

        const serializedStock = items
            .filter(i => i.itemType === 'serialized')
            .reduce((sum, i) => {
                const availableCount = i.serialNumbers.filter(sn => sn.status === 'available').length;
                return sum + availableCount;
            }, 0);

        const totalStock = genericStock + serializedStock;

        // 2. Pending Work Orders
        const pendingWorkOrders = await WorkOrder.countDocuments({
            createdBy: userId,
            status: 'pending'
        });

        // ===== MONTH-WISE METRICS =====

        // Date range for the selected month
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

        // Get all bills for the selected month
        const bills = await Bill.find({
            createdBy: userId,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        });

        // 3. Billed Amount
        const billedAmount = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);

        // 4. Amount Collected
        const amountCollected = bills.reduce((sum, bill) => sum + bill.receivedPayment, 0);

        // 5. Outstanding Amount
        const outstandingAmount = bills.reduce((sum, bill) => sum + bill.dueAmount, 0);

        // 6. Total Expenses (Purchase price of items used - proportional to payment received)
        // 7. Net Profit (Items profit only - proportional to payment received)
        // 8. Services Amount (Total services billed - FULL amount, not proportional)
        // 9. Services Collected (Services revenue - proportional to payment received, for Gross Profit)
        let totalExpenses = 0;
        let netProfit = 0;
        let servicesAmount = 0;  // Full billed amount
        let servicesCollected = 0;  // Proportional to payment

        // Process each bill and calculate expenses/profit based on received payment
        for (const bill of bills) {
            // Calculate payment percentage (what % of bill has been paid)
            const paymentPercentage = bill.totalAmount > 0
                ? bill.receivedPayment / bill.totalAmount
                : 0;

            // Calculate bill-level totals first
            let billItemExpense = 0;
            let billItemRevenue = 0;
            let billServiceAmount = 0;

            for (const item of bill.items) {
                if (item.itemType === 'service') {
                    // Services - no purchase cost, pure revenue
                    billServiceAmount += item.amount;
                } else {
                    // Items (generic or serialized)
                    let purchasePrice = item.purchasePrice;

                    // If purchasePrice is not in bill (old bills), fetch from Item model
                    if (!purchasePrice || purchasePrice === 0) {
                        const inventoryItem = await Item.findById(item.itemId).select('purchasePrice');
                        purchasePrice = inventoryItem ? inventoryItem.purchasePrice : 0;
                    }

                    const itemExpense = purchasePrice * item.qty;
                    const itemRevenue = item.price * item.qty;

                    billItemExpense += itemExpense;
                    billItemRevenue += itemRevenue;
                }
            }

            // Calculate proportional amounts based on payment received
            const proportionalItemExpense = billItemExpense * paymentPercentage;
            const proportionalItemRevenue = billItemRevenue * paymentPercentage;
            const proportionalServiceAmount = billServiceAmount * paymentPercentage;

            // Net profit = Items revenue (proportional) - Items expense (proportional)
            const itemProfit = proportionalItemRevenue - proportionalItemExpense;

            totalExpenses += billItemExpense;  // Full item expense (not proportional)
            netProfit += itemProfit;
            servicesAmount += billServiceAmount;  // Full service amount (not proportional)
            servicesCollected += proportionalServiceAmount;  // Collected service amount
        }

        // 10. Gross Profit = Net Profit (from items) + Services Collected
        const grossProfit = netProfit + servicesCollected;

        // ===== AVAILABLE MONTHS =====
        // Find the earliest bill to determine available months
        const earliestBill = await Bill.findOne({ createdBy: userId })
            .sort({ createdAt: 1 })
            .select('createdAt');

        const availableMonths = [];
        if (earliestBill) {
            const startDate = new Date(earliestBill.createdAt);
            const endDate = new Date();

            // Generate month list from earliest to current
            let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];

            while (currentMonth <= endDate) {
                availableMonths.push({
                    month: currentMonth.getMonth() + 1,
                    year: currentMonth.getFullYear(),
                    label: `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`
                });
                currentMonth.setMonth(currentMonth.getMonth() + 1);
            }
        }

        // ===== PENDING WORK ORDERS (ALL) =====
        // Get all pending work orders sorted by schedule date (earliest first)
        const allPendingWorkOrders = await WorkOrder.find({
            createdBy: userId,
            status: 'pending'
        })
            .populate('customer', 'customerName phoneNumber address')
            .sort({ scheduleDate: 1, scheduleTime: 1 })
            .select('workOrderNumber scheduleDate scheduleTime hasScheduledTime note status customer');

        // Map to consistent format
        const pendingWorks = allPendingWorkOrders.map(wo => ({
            _id: wo._id,
            workOrderNumber: wo.workOrderNumber,
            scheduleDate: wo.scheduleDate,
            scheduleTime: wo.scheduleTime,
            hasScheduledTime: wo.hasScheduledTime,
            note: wo.note,
            status: wo.status,
            customer: {
                _id: wo.customer?._id,
                customerName: wo.customer?.customerName || 'Unknown',
                phoneNumber: wo.customer?.phoneNumber,
                address: wo.customer?.address
            }
        }));

        // Return all metrics
        return res.status(200).json({
            success: true,
            data: {
                currentMetrics: {
                    totalStock,
                    pendingWorkOrders
                },
                monthMetrics: {
                    month,
                    year,
                    billedAmount,
                    amountCollected,
                    outstandingAmount,
                    totalExpenses,
                    netProfit,
                    servicesAmount,
                    grossProfit
                },
                availableMonths,
                pendingWorks
            }
        });

    } catch (error) {
        console.error('Get dashboard metrics error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get dashboard metrics',
            error: error.message
        });
    }
};

module.exports = {
    getDashboardMetrics
};
