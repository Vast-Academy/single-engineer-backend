const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    addBankAccount,
    getAllBankAccounts,
    updateBankAccount,
    deleteBankAccount,
    setPrimaryAccount
} = require('../controllers/bankAccountController');

// All routes require authentication
router.use(authMiddleware);

// Bank account routes
router.post('/bank-account', addBankAccount);
router.get('/bank-accounts', getAllBankAccounts);
router.put('/bank-account/:id', updateBankAccount);
router.delete('/bank-account/:id', deleteBankAccount);
router.put('/bank-account/:id/primary', setPrimaryAccount);

module.exports = router;
