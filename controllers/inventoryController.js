const Item = require('../models/Item');
const Service = require('../models/Service');

// ==================== SERIAL NUMBER CONTROLLERS ====================

// Check if serial number exists in any item
const checkSerialNumber = async (req, res) => {
    try {
        const { serialNumber } = req.params;

        if (!serialNumber || serialNumber.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Serial number is required'
            });
        }

        // Check if serial number exists in any item
        const existingItem = await Item.findOne({
            'serialNumbers.serialNo': serialNumber.trim()
        });

        if (existingItem) {
            return res.status(200).json({
                success: true,
                exists: true,
                message: 'Serial number already exists in stock',
                itemName: existingItem.itemName,
                itemId: existingItem._id
            });
        }

        return res.status(200).json({
            success: true,
            exists: false,
            message: 'Serial number is available'
        });
    } catch (error) {
        console.error('Check serial number error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to check serial number'
        });
    }
};

// ==================== ITEM CONTROLLERS ====================

// Add new item
const addItem = async (req, res) => {
    try {
        const { itemType, itemName, unit, warranty, mrp, purchasePrice, salePrice } = req.body;

        const newItem = await Item.create({
            itemType,
            itemName,
            unit,
            warranty: warranty || 'no_warranty',
            mrp,
            purchasePrice,
            salePrice,
            stockQty: 0,
            serialNumbers: [],
            createdBy: req.user._id
        });

        return res.status(201).json({
            success: true,
            message: 'Item added successfully',
            item: newItem
        });
    } catch (error) {
        console.error('Add item error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to add item',
            error: error.message
        });
    }
};

// Get all items
const getAllItems = async (req, res) => {
    try {
        const items = await Item.find({ createdBy: req.user._id })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            items
        });
    } catch (error) {
        console.error('Get items error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get items'
        });
    }
};

// Get single item
const getItem = async (req, res) => {
    try {
        const { id } = req.params;

        const item = await Item.findOne({ _id: id, createdBy: req.user._id });

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        return res.status(200).json({
            success: true,
            item
        });
    } catch (error) {
        console.error('Get item error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get item'
        });
    }
};

// Update item
const updateItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { itemName, unit, warranty, mrp, purchasePrice, salePrice } = req.body;

        const item = await Item.findOneAndUpdate(
            { _id: id, createdBy: req.user._id },
            { itemName, unit, warranty, mrp, purchasePrice, salePrice },
            { new: true }
        );

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Item updated successfully',
            item
        });
    } catch (error) {
        console.error('Update item error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to update item'
        });
    }
};

// Delete item
const deleteItem = async (req, res) => {
    try {
        const { id } = req.params;

        const item = await Item.findOneAndDelete({ _id: id, createdBy: req.user._id });

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Item deleted successfully'
        });
    } catch (error) {
        console.error('Delete item error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete item'
        });
    }
};

// Update stock (for generic: qty, for serialized: serial numbers)
const updateStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { stockQty, serialNumbers } = req.body;

        const item = await Item.findOne({ _id: id, createdBy: req.user._id });

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        if (item.itemType === 'generic') {
            // Add to existing stock
            const qtyToAdd = stockQty || 0;
            item.stockQty = (item.stockQty || 0) + qtyToAdd;

            // Add to stock history
            if (qtyToAdd > 0) {
                item.stockHistory.push({
                    qty: qtyToAdd,
                    addedAt: new Date()
                });
            }
        } else if (item.itemType === 'serialized') {
            // Add new serial numbers
            if (serialNumbers && serialNumbers.length > 0) {
                // Trim and filter empty serial numbers
                const trimmedSerials = serialNumbers
                    .map(sn => sn.trim())
                    .filter(sn => sn !== '');

                if (trimmedSerials.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Please provide at least one valid serial number'
                    });
                }

                // Check for duplicates within the submitted batch itself
                const uniqueSerials = [...new Set(trimmedSerials)];
                if (uniqueSerials.length !== trimmedSerials.length) {
                    const duplicatesInInput = trimmedSerials.filter(
                        (sn, index) => trimmedSerials.indexOf(sn) !== index
                    );
                    return res.status(400).json({
                        success: false,
                        message: `Duplicate serial numbers in your input: ${[...new Set(duplicatesInInput)].join(', ')}`
                    });
                }

                // Check for duplicates across ALL items in database
                const existingItems = await Item.find({
                    'serialNumbers.serialNo': { $in: trimmedSerials }
                });

                const existingSerials = [];
                existingItems.forEach(existingItem => {
                    existingItem.serialNumbers.forEach(sn => {
                        if (trimmedSerials.includes(sn.serialNo)) {
                            existingSerials.push({
                                serialNo: sn.serialNo,
                                itemName: existingItem.itemName
                            });
                        }
                    });
                });

                if (existingSerials.length > 0) {
                    const duplicateList = existingSerials
                        .map(s => `${s.serialNo} (in ${s.itemName})`)
                        .join(', ');
                    return res.status(400).json({
                        success: false,
                        message: `Serial numbers already exist: ${duplicateList}`,
                        duplicates: existingSerials
                    });
                }

                // Add new serial numbers with timestamp
                const now = new Date();
                trimmedSerials.forEach(serialNo => {
                    item.serialNumbers.push({ serialNo, status: 'available', addedAt: now });
                });
            }
        }

        await item.save();

        return res.status(200).json({
            success: true,
            message: 'Stock updated successfully',
            item
        });
    } catch (error) {
        console.error('Update stock error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to update stock'
        });
    }
};

// ==================== SERVICE CONTROLLERS ====================

// Add new service
const addService = async (req, res) => {
    try {
        const { serviceName, servicePrice } = req.body;

        const newService = await Service.create({
            serviceName,
            servicePrice,
            createdBy: req.user._id
        });

        return res.status(201).json({
            success: true,
            message: 'Service added successfully',
            service: newService
        });
    } catch (error) {
        console.error('Add service error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to add service',
            error: error.message
        });
    }
};

// Get all services
const getAllServices = async (req, res) => {
    try {
        const services = await Service.find({ createdBy: req.user._id })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            services
        });
    } catch (error) {
        console.error('Get services error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get services'
        });
    }
};

// Update service
const updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const { serviceName, servicePrice } = req.body;

        const service = await Service.findOneAndUpdate(
            { _id: id, createdBy: req.user._id },
            { serviceName, servicePrice },
            { new: true }
        );

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Service updated successfully',
            service
        });
    } catch (error) {
        console.error('Update service error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to update service'
        });
    }
};

// Delete service
const deleteService = async (req, res) => {
    try {
        const { id } = req.params;

        const service = await Service.findOneAndDelete({ _id: id, createdBy: req.user._id });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Service deleted successfully'
        });
    } catch (error) {
        console.error('Delete service error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete service'
        });
    }
};

module.exports = {
    // Serial Number
    checkSerialNumber,
    // Items
    addItem,
    getAllItems,
    getItem,
    updateItem,
    deleteItem,
    updateStock,
    // Services
    addService,
    getAllServices,
    updateService,
    deleteService
};
