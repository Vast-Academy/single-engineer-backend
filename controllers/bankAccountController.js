const BankAccount = require('../models/BankAccount');

// Add new bank account
const addBankAccount = async (req, res) => {
    try {
        const { bankName, accountNumber, ifscCode, accountHolderName, upiId, isPrimary } = req.body;

        // Validate required fields
        if (!bankName || !accountNumber || !ifscCode || !accountHolderName || !upiId) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // If setting as primary, unset any existing primary
        if (isPrimary) {
            await BankAccount.updateMany(
                { createdBy: req.user._id, isPrimary: true },
                { isPrimary: false }
            );
        }

        // Check if this is the first account (make it primary by default)
        const existingCount = await BankAccount.countDocuments({ createdBy: req.user._id, deleted: false });
        const shouldBePrimary = isPrimary || existingCount === 0;

        const bankAccount = await BankAccount.create({
            bankName: bankName.trim(),
            accountNumber: accountNumber.trim(),
            ifscCode: ifscCode.trim().toUpperCase(),
            accountHolderName: accountHolderName.trim(),
            upiId: upiId.trim().toLowerCase(),
            isPrimary: shouldBePrimary,
            createdBy: req.user._id
        });

        return res.status(201).json({
            success: true,
            message: 'Bank account added successfully',
            bankAccount
        });
    } catch (error) {
        console.error('Add bank account error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to add bank account',
            error: error.message
        });
    }
};

// Get all bank accounts
const getAllBankAccounts = async (req, res) => {
    try {
        const bankAccounts = await BankAccount.find({ createdBy: req.user._id, deleted: false })
            .sort({ isPrimary: -1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            bankAccounts
        });
    } catch (error) {
        console.error('Get bank accounts error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get bank accounts'
        });
    }
};

// Update bank account
const updateBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { bankName, accountNumber, ifscCode, accountHolderName, upiId, isPrimary } = req.body;

        const bankAccount = await BankAccount.findOne({ _id: id, createdBy: req.user._id, deleted: false });

        if (!bankAccount) {
            return res.status(404).json({
                success: false,
                message: 'Bank account not found'
            });
        }

        // If setting as primary, unset any existing primary
        if (isPrimary && !bankAccount.isPrimary) {
            await BankAccount.updateMany(
                { createdBy: req.user._id, isPrimary: true },
                { isPrimary: false }
            );
        }

        // Update fields
        if (bankName) bankAccount.bankName = bankName.trim();
        if (accountNumber) bankAccount.accountNumber = accountNumber.trim();
        if (ifscCode) bankAccount.ifscCode = ifscCode.trim().toUpperCase();
        if (accountHolderName) bankAccount.accountHolderName = accountHolderName.trim();
        if (upiId) bankAccount.upiId = upiId.trim().toLowerCase();
        if (typeof isPrimary === 'boolean') bankAccount.isPrimary = isPrimary;

        await bankAccount.save();

        return res.status(200).json({
            success: true,
            message: 'Bank account updated successfully',
            bankAccount
        });
    } catch (error) {
        console.error('Update bank account error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to update bank account',
            error: error.message
        });
    }
};

// Delete bank account
const deleteBankAccount = async (req, res) => {
    try {
        const { id } = req.params;

        const bankAccount = await BankAccount.findOneAndUpdate(
            { _id: id, createdBy: req.user._id, deleted: false },
            { deleted: true },
            { new: true }
        );

        if (!bankAccount) {
            return res.status(404).json({
                success: false,
                message: 'Bank account not found'
            });
        }

        // If deleted account was primary, set another as primary
        if (bankAccount.isPrimary) {
            const nextAccount = await BankAccount.findOne({ createdBy: req.user._id });
            if (nextAccount) {
                nextAccount.isPrimary = true;
                await nextAccount.save();
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Bank account deleted successfully'
        });
    } catch (error) {
        console.error('Delete bank account error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete bank account',
            error: error.message
        });
    }
};

// Set as primary account
const setPrimaryAccount = async (req, res) => {
    try {
        const { id } = req.params;

        const bankAccount = await BankAccount.findOne({ _id: id, createdBy: req.user._id, deleted: false });

        if (!bankAccount) {
            return res.status(404).json({
                success: false,
                message: 'Bank account not found'
            });
        }

        // Unset all other primary accounts
        await BankAccount.updateMany(
            { createdBy: req.user._id, isPrimary: true },
            { isPrimary: false }
        );

        // Set this as primary
        bankAccount.isPrimary = true;
        await bankAccount.save();

        return res.status(200).json({
            success: true,
            message: 'Primary account updated successfully',
            bankAccount
        });
    } catch (error) {
        console.error('Set primary account error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to set primary account',
            error: error.message
        });
    }
};

module.exports = {
    addBankAccount,
    getAllBankAccounts,
    updateBankAccount,
    deleteBankAccount,
    setPrimaryAccount
};
