// Offline sync scaffolding: placeholder endpoints to be implemented in later steps.
const Customer = require('../models/Customer');
const Item = require('../models/Item');
const Service = require('../models/Service');
const WorkOrder = require('../models/WorkOrder');
const Bill = require('../models/Bill');
const BankAccount = require('../models/BankAccount');

// Pull incremental changes since a given timestamp/watermark
const pullChanges = async (req, res) => {
    return res.status(501).json({
        success: false,
        message: 'Sync pull not implemented yet'
    });
};

// Push batched local changes from client to server
const pushChanges = async (req, res) => {
    return res.status(501).json({
        success: false,
        message: 'Sync push not implemented yet'
    });
};

// Lightweight check to see if user has any server data
const hasServerData = async (req, res) => {
    try {
        const userId = req.user._id;

        const [
            hasCustomers,
            hasItems,
            hasServices,
            hasWorkOrders,
            hasBills,
            hasBankAccounts
        ] = await Promise.all([
            Customer.exists({ createdBy: userId, deleted: false }),
            Item.exists({ createdBy: userId, deleted: false }),
            Service.exists({ createdBy: userId, deleted: false }),
            WorkOrder.exists({ createdBy: userId, deleted: false }),
            Bill.exists({ createdBy: userId, deleted: false }),
            BankAccount.exists({ createdBy: userId, deleted: false })
        ]);

        const hasData = !!(
            hasCustomers ||
            hasItems ||
            hasServices ||
            hasWorkOrders ||
            hasBills ||
            hasBankAccounts
        );

        return res.status(200).json({
            success: true,
            hasData,
            breakdown: {
                customers: !!hasCustomers,
                items: !!hasItems,
                services: !!hasServices,
                workOrders: !!hasWorkOrders,
                bills: !!hasBills,
                bankAccounts: !!hasBankAccounts
            }
        });
    } catch (error) {
        console.error('Has server data check error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to check server data',
            error: error.message
        });
    }
};

module.exports = {
    pullChanges,
    pushChanges,
    hasServerData
};
