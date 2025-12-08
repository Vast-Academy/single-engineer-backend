const Bill = require('../models/Bill');
const Item = require('../models/Item');
const WorkOrder = require('../models/WorkOrder');

// Get dashboard metrics
const getDashboardMetrics = async (req, res) => {
    try {
        const userId = req.user._id;
        let { filterType, period, month, year } = req.query;

        // Default to period-based filter (1 month) if not provided
        filterType = filterType || 'period';
        period = period || '1month';

        const currentDate = new Date();
        let startDate, endDate;

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

        // ===== DATE RANGE CALCULATION BASED ON FILTER TYPE =====

        if (filterType === 'period') {
            // Period-based filtering (1 week, 1 month, 3 months, 6 months, 1 year)
            endDate = new Date();
            startDate = new Date();

            switch(period) {
                case '1week':
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case '1month':
                    startDate.setDate(endDate.getDate() - 30);
                    break;
                case '3months':
                    startDate.setMonth(endDate.getMonth() - 3);
                    break;
                case '6months':
                    startDate.setMonth(endDate.getMonth() - 6);
                    break;
                case '1year':
                    startDate.setFullYear(endDate.getFullYear() - 1);
                    break;
                default:
                    startDate.setDate(endDate.getDate() - 30); // Default to 1 month
            }

            // Set start of day for startDate
            startDate.setHours(0, 0, 0, 0);
            // Set end of day for endDate
            endDate.setHours(23, 59, 59, 999);

        } else if (filterType === 'monthYear') {
            // Month-Year based filtering
            month = parseInt(month);
            year = parseInt(year);

            if (!month || !year) {
                return res.status(400).json({
                    success: false,
                    message: 'Month and year are required for monthYear filter type'
                });
            }

            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59, 999);
        }

        // ===== MONTH-WISE METRICS =====

        // Date range for the selected period

        // Get all bills for the selected period
        const bills = await Bill.find({
            createdBy: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        // Check if no data exists for monthYear filter
        if (filterType === 'monthYear' && bills.length === 0) {
            return res.status(200).json({
                success: true,
                noData: true,
                message: 'This month\'s record is not in the database'
            });
        }

        // 3. Billed Amount
        const billedAmount = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);

        // 4. Amount Collected
        const amountCollected = bills.reduce((sum, bill) => sum + bill.receivedPayment, 0);

        // 5. Outstanding Amount
        const outstandingAmount = bills.reduce((sum, bill) => sum + bill.dueAmount, 0);

        // 6. Total Expenses (Full purchase price of items used in all bills)
        // 7. Net Profit (Total Amount Collected - Total Full Expenses)
        // 8. Services Amount (Only from fully paid bills, negative for pending bills)
        let totalExpenses = 0;
        let netProfit = 0;
        let servicesAmount = 0;
        let totalCollected = 0;  // Track total amount collected

        // Process each bill and calculate expenses
        for (const bill of bills) {
            // Track total collected amount
            totalCollected += bill.receivedPayment;

            // Calculate bill-level totals
            let billItemExpense = 0;
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
                    billItemExpense += itemExpense;
                }
            }

            // Add full expenses
            totalExpenses += billItemExpense;

            // Services logic:
            // - If bill fully paid (dueAmount = 0): Add as positive (earned)
            // - If bill has pending due (dueAmount > 0): Add as negative (not earned yet)
            if (bill.dueAmount === 0) {
                // Bill fully cleared - services earned
                servicesAmount += billServiceAmount;
            } else {
                // Bill has pending due - services not earned yet (negative)
                servicesAmount -= billServiceAmount;
            }
        }

        // Net Profit = Total Collected - Total Expenses
        // If collected < expenses → Loss (negative)
        // If collected > expenses → Profit (positive)
        netProfit = totalCollected - totalExpenses;

        // Gross Profit = Net Profit + Services (full amount)
        const grossProfit = netProfit + servicesAmount;

        // ===== AVAILABLE MONTHS AND YEARS =====
        // Find the earliest bill to determine available months and years
        const earliestBill = await Bill.findOne({ createdBy: userId })
            .sort({ createdAt: 1 })
            .select('createdAt');

        const availableMonths = [];
        const availableYears = [];

        if (earliestBill) {
            const earliestDate = new Date(earliestBill.createdAt);
            const currentDateForCalc = new Date();

            // Generate years list from earliest to current
            const earliestYear = earliestDate.getFullYear();
            const currentYear = currentDateForCalc.getFullYear();

            for (let y = earliestYear; y <= currentYear; y++) {
                availableYears.push(y);
            }

            // Generate month list from earliest to current
            let currentMonth = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];

            while (currentMonth <= currentDateForCalc) {
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
                filterInfo: {
                    filterType,
                    period: filterType === 'period' ? period : null,
                    month: filterType === 'monthYear' ? month : null,
                    year: filterType === 'monthYear' ? year : null,
                    startDate,
                    endDate
                },
                currentMetrics: {
                    totalStock,
                    pendingWorkOrders
                },
                monthMetrics: {
                    billedAmount,
                    amountCollected,
                    outstandingAmount,
                    totalExpenses,
                    netProfit,
                    servicesAmount,
                    grossProfit
                },
                availableMonths,
                availableYears,
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
