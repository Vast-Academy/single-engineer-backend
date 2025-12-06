const Bill = require('../models/Bill');
const Item = require('../models/Item');
const WorkOrder = require('../models/WorkOrder');

// Get dashboard metrics with optimized aggregation
const getDashboardMetrics = async (req, res) => {
    try {
        const userId = req.user._id;
        let { month, year } = req.query;

        // Default to current month if not provided
        const currentDate = new Date();
        month = month ? parseInt(month, 10) : currentDate.getMonth() + 1;
        year = year ? parseInt(year, 10) : currentDate.getFullYear();

        // ===== ALWAYS CURRENT METRICS =====

        // Total stock using aggregation (avoids pulling whole item docs)
        const stockAgg = await Item.aggregate([
            { $match: { createdBy: userId } },
            {
                $addFields: {
                    availableSerialCount: {
                        $size: {
                            $filter: {
                                input: '$serialNumbers',
                                as: 'sn',
                                cond: { $eq: ['$$sn.status', 'available'] }
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    genericStock: {
                        $sum: {
                            $cond: [{ $eq: ['$itemType', 'generic'] }, '$stockQty', 0]
                        }
                    },
                    serializedStock: {
                        $sum: {
                            $cond: [
                                { $eq: ['$itemType', 'serialized'] },
                                '$availableSerialCount',
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalStock: { $add: ['$genericStock', '$serializedStock'] }
                }
            }
        ]);
        const totalStock = stockAgg[0]?.totalStock || 0;

        // Pending work orders count
        const pendingWorkOrders = await WorkOrder.countDocuments({
            createdBy: userId,
            status: 'pending'
        }).lean();

        // ===== MONTH-WISE METRICS =====
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

        // Aggregate bill stats in a single pass
        const billStatsAgg = await Bill.aggregate([
            {
                $match: {
                    createdBy: userId,
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $addFields: {
                    serviceAmount: {
                        $reduce: {
                            input: {
                                $filter: {
                                    input: '$items',
                                    as: 'i',
                                    cond: { $eq: ['$$i.itemType', 'service'] }
                                }
                            },
                            initialValue: 0,
                            in: { $add: ['$$value', '$$this.amount'] }
                        }
                    },
                    itemExpense: {
                        $reduce: {
                            input: '$items',
                            initialValue: 0,
                            in: {
                                $add: [
                                    '$$value',
                                    {
                                        $cond: [
                                            { $eq: ['$$this.itemType', 'service'] },
                                            0,
                                            { $multiply: ['$$this.purchasePrice', '$$this.qty'] }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    billedAmount: { $sum: '$totalAmount' },
                    amountCollected: { $sum: '$receivedPayment' },
                    outstandingAmount: { $sum: '$dueAmount' },
                    totalExpenses: { $sum: '$itemExpense' },
                    servicesAmount: {
                        $sum: {
                            $cond: [
                                { $eq: ['$dueAmount', 0] },
                                '$serviceAmount',
                                { $multiply: ['$serviceAmount', -1] }
                            ]
                        }
                    }
                }
            }
        ]);

        const billStats = billStatsAgg[0] || {};
        const billedAmount = billStats.billedAmount || 0;
        const amountCollected = billStats.amountCollected || 0;
        const outstandingAmount = billStats.outstandingAmount || 0;
        const totalExpenses = billStats.totalExpenses || 0;
        const servicesAmount = billStats.servicesAmount || 0;
        const netProfit = amountCollected - totalExpenses;
        const grossProfit = netProfit + servicesAmount;

        // ===== AVAILABLE MONTHS =====
        const earliestBill = await Bill.findOne({ createdBy: userId })
            .sort({ createdAt: 1 })
            .select('createdAt');

        const availableMonths = [];
        if (earliestBill) {
            const startDate = new Date(earliestBill.createdAt);
            const endDate = new Date();

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
        const pendingWorkOrdersList = await WorkOrder.find({
            createdBy: userId,
            status: 'pending'
        })
            .populate('customer', 'customerName phoneNumber address')
            .sort({ scheduleDate: 1, scheduleTime: 1 })
            .select('workOrderNumber scheduleDate scheduleTime hasScheduledTime note status customer')
            .lean();

        const pendingWorks = pendingWorkOrdersList.map(wo => ({
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
