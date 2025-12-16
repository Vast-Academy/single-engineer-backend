const express = require('express');
const router = express.Router();

// Controllers
const authController = require('../controllers/authController');
const inventoryController = require('../controllers/inventoryController');
const customerController = require('../controllers/customerController');
const billController = require('../controllers/billController');
const bankAccountController = require('../controllers/bankAccountController');
const workOrderController = require('../controllers/workOrderController');
const notificationController = require('../controllers/notificationController');
const dashboardController = require('../controllers/dashboardController');
const syncController = require('../controllers/syncController');

// Middlewares
const { verifyToken } = require('../middlewares/authMiddleware');

// ==================== AUTH ROUTES ====================

// POST /api/auth/google - Google Sign In / Sign Up
router.post('/auth/google', authController.googleAuth);

// GET /api/auth/me - Get current user (Protected)
router.get('/auth/me', verifyToken, authController.getCurrentUser);

// POST /api/auth/logout - Logout user (Protected)
router.post('/auth/logout', verifyToken, authController.logout);

// POST /api/auth/set-password - Set user password (Protected)
router.post('/auth/set-password', verifyToken, authController.setPassword);

// POST /api/auth/login - Email/Password login (Public)
router.post('/auth/login', authController.emailPasswordLogin);

// ==================== INVENTORY ROUTES - SERIAL NUMBER ====================

// GET /api/inventory/check-serial/:serialNumber - Check if serial exists (Protected)
router.get('/inventory/check-serial/:serialNumber', verifyToken, inventoryController.checkSerialNumber);

// ==================== INVENTORY ROUTES - ITEMS ====================

// POST /api/inventory/item - Add new item (Protected)
router.post('/inventory/item', verifyToken, inventoryController.addItem);

// GET /api/inventory/items - Get all items (Protected)
router.get('/inventory/items', verifyToken, inventoryController.getAllItems);

// GET /api/inventory/item/:id - Get single item (Protected)
router.get('/inventory/item/:id', verifyToken, inventoryController.getItem);

// PUT /api/inventory/item/:id - Update item (Protected)
router.put('/inventory/item/:id', verifyToken, inventoryController.updateItem);

// DELETE /api/inventory/item/:id - Delete item (Protected)
router.delete('/inventory/item/:id', verifyToken, inventoryController.deleteItem);

// POST /api/inventory/item/:id/stock - Update stock (Protected)
router.post('/inventory/item/:id/stock', verifyToken, inventoryController.updateStock);

// ==================== INVENTORY ROUTES - SERVICES ====================

// POST /api/inventory/service - Add new service (Protected)
router.post('/inventory/service', verifyToken, inventoryController.addService);

// GET /api/inventory/services - Get all services (Protected)
router.get('/inventory/services', verifyToken, inventoryController.getAllServices);

// PUT /api/inventory/service/:id - Update service (Protected)
router.put('/inventory/service/:id', verifyToken, inventoryController.updateService);

// DELETE /api/inventory/service/:id - Delete service (Protected)
router.delete('/inventory/service/:id', verifyToken, inventoryController.deleteService);

// ==================== CUSTOMER ROUTES ====================

// POST /api/customer - Add new customer (Protected)
router.post('/customer', verifyToken, customerController.addCustomer);

// GET /api/customers - Get all customers (Protected)
router.get('/customers', verifyToken, customerController.getAllCustomers);

// GET /api/customer/search - Search customers (Protected)
router.get('/customer/search', verifyToken, customerController.searchCustomers);

// GET /api/customer/:id - Get single customer with bills (Protected)
router.get('/customer/:id', verifyToken, customerController.getCustomer);

// PUT /api/customer/:id - Update customer (Protected)
router.put('/customer/:id', verifyToken, customerController.updateCustomer);

// DELETE /api/customer/:id - Delete customer (Protected)
router.delete('/customer/:id', verifyToken, customerController.deleteCustomer);

// ==================== BILL ROUTES ====================

// POST /api/bill - Create new bill (Protected)
router.post('/bill', verifyToken, billController.createBill);

// GET /api/bills - Get all bills (Protected)
router.get('/bills', verifyToken, billController.getAllBills);

// GET /api/bills/customer/:customerId - Get bills by customer (Protected)
router.get('/bills/customer/:customerId', verifyToken, billController.getBillsByCustomer);

// GET /api/bill/:id - Get single bill (Protected)
router.get('/bill/:id', verifyToken, billController.getBill);

// PUT /api/bill/:id/payment - Update bill payment (Protected)
router.put('/bill/:id/payment', verifyToken, billController.updateBillPayment);

// PUT /api/bill/customer/:customerId/pay-due - Pay customer overall due (Protected)
router.put('/bill/customer/:customerId/pay-due', verifyToken, billController.payCustomerDue);

// ==================== BANK ACCOUNT ROUTES ====================

// POST /api/bank-account - Add new bank account (Protected)
router.post('/bank-account', verifyToken, bankAccountController.addBankAccount);

// GET /api/bank-accounts - Get all bank accounts (Protected)
router.get('/bank-accounts', verifyToken, bankAccountController.getAllBankAccounts);

// PUT /api/bank-account/:id - Update bank account (Protected)
router.put('/bank-account/:id', verifyToken, bankAccountController.updateBankAccount);

// DELETE /api/bank-account/:id - Delete bank account (Protected)
router.delete('/bank-account/:id', verifyToken, bankAccountController.deleteBankAccount);

// PUT /api/bank-account/:id/primary - Set as primary account (Protected)
router.put('/bank-account/:id/primary', verifyToken, bankAccountController.setPrimaryAccount);

// ==================== WORK ORDER ROUTES ====================

// POST /api/workorder - Create new work order (Protected)
router.post('/workorder', verifyToken, workOrderController.createWorkOrder);

// GET /api/workorders/pending - Get all pending work orders (Protected)
router.get('/workorders/pending', verifyToken, workOrderController.getPendingWorkOrders);

// GET /api/workorders/completed - Get all completed work orders (Protected)
router.get('/workorders/completed', verifyToken, workOrderController.getCompletedWorkOrders);

// GET /api/workorder/:id - Get single work order (Protected)
router.get('/workorder/:id', verifyToken, workOrderController.getWorkOrder);

// PUT /api/workorder/:id - Update work order details (Protected)
router.put('/workorder/:id', verifyToken, workOrderController.updateWorkOrder);

// PUT /api/workorder/:id/complete - Mark work order as completed (Protected)
router.put('/workorder/:id/complete', verifyToken, workOrderController.markAsCompleted);

// DELETE /api/workorder/:id - Delete work order (Protected)
router.delete('/workorder/:id', verifyToken, workOrderController.deleteWorkOrder);

// GET /api/workorders/customer/:customerId - Get work orders by customer (Protected)
router.get('/workorders/customer/:customerId', verifyToken, workOrderController.getWorkOrdersByCustomer);

// PUT /api/workorder/link-bill - Link work order with bill (Protected)
router.put('/workorder/link-bill', verifyToken, workOrderController.linkWithBill);

// ==================== NOTIFICATION ROUTES ====================

// POST /api/notification/register-token - Register FCM token (Protected)
router.post('/notification/register-token', verifyToken, notificationController.registerFcmToken);

// POST /api/notification/remove-token - Remove FCM token (Protected)
router.post('/notification/remove-token', verifyToken, notificationController.removeFcmToken);

// ==================== DASHBOARD ROUTES ====================

// GET /api/dashboard/metrics - Get dashboard metrics (Protected)
router.get('/dashboard/metrics', verifyToken, dashboardController.getDashboardMetrics);

// ==================== SYNC ROUTES (Offline support scaffolding) ====================

// POST /api/sync/pull - Pull incremental changes (Protected)
router.post('/sync/pull', verifyToken, syncController.pullChanges);

// POST /api/sync/push - Push batched local changes (Protected)
router.post('/sync/push', verifyToken, syncController.pushChanges);

// ==================== HEALTH CHECK ====================

// GET /api/health - Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
