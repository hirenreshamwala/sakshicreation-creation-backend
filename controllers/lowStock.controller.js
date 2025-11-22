const mongoose = require('mongoose');
const LowStock = require('../models/lowStock.model');
const Inventory = require('../models/inventory.model');

// Helper function to transform MongoDB _id to id
const transformLowStock = (doc) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: obj._id.toString(),
  };
};

// Get all low stock configurations
exports.getAllLowStocks = async (req, res) => {
  try {
    const lowStocks = await LowStock.find({ isActive: true }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: lowStocks.length,
      data: lowStocks.map(transformLowStock),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching low stock configurations',
      error: error.message,
    });
  }
};

// Get single low stock configuration by ID
exports.getLowStockById = async (req, res) => {
  try {
    const lowStock = await LowStock.findById(req.params.id);
    
    if (!lowStock) {
      return res.status(404).json({
        success: false,
        message: 'Low stock configuration not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: transformLowStock(lowStock),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching low stock configuration',
      error: error.message,
    });
  }
};

// Create new low stock configuration
exports.createLowStock = async (req, res) => {
  try {
    const { deckal, gsm, bf, color, minKg } = req.body;
    
    // Validation
    if (!deckal || !gsm || !bf || !color || minKg === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All fields (deckal, gsm, bf, color, minKg) are required',
      });
    }
    
    if (minKg < 0) {
      return res.status(400).json({
        success: false,
        message: 'Minimum KG must be a positive number',
      });
    }
    
    // Check if combination already exists
    const existing = await LowStock.findOne({
      deckal,
      gsm,
      bf,
      color,
    });
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'This paper combination already has a low stock threshold configured',
      });
    }
    
    const newLowStock = new LowStock({
      deckal,
      gsm,
      bf,
      color,
      minKg,
    });
    
    const savedLowStock = await newLowStock.save();
    
    res.status(201).json({
      success: true,
      message: 'Low stock configuration created successfully',
      data: transformLowStock(savedLowStock),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating low stock configuration',
      error: error.message,
    });
  }
};

// Update low stock configuration
exports.updateLowStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { deckal, gsm, bf, color, minKg } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid low stock ID format',
      });
    }
    
    const existingLowStock = await LowStock.findById(id);
    
    if (!existingLowStock) {
      return res.status(404).json({
        success: false,
        message: 'Low stock configuration not found',
      });
    }
    
    // Check for duplicate if fields are being changed
    if (deckal || gsm || bf || color) {
      const duplicate = await LowStock.findOne({
        _id: { $ne: id },
        deckal: deckal || existingLowStock.deckal,
        gsm: gsm || existingLowStock.gsm,
        bf: bf || existingLowStock.bf,
        color: color || existingLowStock.color,
      });
      
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'This paper combination already exists',
        });
      }
    }
    
    const updateData = {};
    if (deckal !== undefined) updateData.deckal = deckal;
    if (gsm !== undefined) updateData.gsm = gsm;
    if (bf !== undefined) updateData.bf = bf;
    if (color !== undefined) updateData.color = color;
    if (minKg !== undefined) {
      if (minKg < 0) {
        return res.status(400).json({
          success: false,
          message: 'Minimum KG must be a positive number',
        });
      }
      updateData.minKg = minKg;
    }
    
    const updatedLowStock = await LowStock.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Low stock configuration updated successfully',
      data: transformLowStock(updatedLowStock),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating low stock configuration',
      error: error.message,
    });
  }
};

// Delete low stock configuration
exports.deleteLowStock = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid low stock ID format',
      });
    }
    
    const deletedLowStock = await LowStock.findByIdAndDelete(id);
    
    if (!deletedLowStock) {
      return res.status(404).json({
        success: false,
        message: 'Low stock configuration not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Low stock configuration deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting low stock configuration',
      error: error.message,
    });
  }
};

// Check low stock status for inventory
exports.checkLowStockStatus = async (req, res) => {
  try {
    const lowStocks = await LowStock.find({ isActive: true });
    
    const lowStockItems = [];
    
    for (const lowStock of lowStocks) {
      // Calculate total available KG for this paper combination
      const inwardKg = await Inventory.aggregate([
        {
          $match: {
            inventoryType: 'paper',
            type: 'inward',
            deckal: lowStock.deckal,
            gsm: lowStock.gsm,
            bf: lowStock.bf,
            color: lowStock.color,
          },
        },
        {
          $group: {
            _id: null,
            totalKg: { $sum: '$kg' },
          },
        },
      ]);
      
      const outwardKg = await Inventory.aggregate([
        {
          $match: {
            inventoryType: 'paper',
            type: 'outward',
            deckal: lowStock.deckal,
            gsm: lowStock.gsm,
            bf: lowStock.bf,
            color: lowStock.color,
          },
        },
        {
          $group: {
            _id: null,
            totalKg: { $sum: '$kg' },
          },
        },
      ]);
      
      const totalInward = inwardKg.length > 0 ? inwardKg[0].totalKg : 0;
      const totalOutward = outwardKg.length > 0 ? outwardKg[0].totalKg : 0;
      const availableKg = totalInward - totalOutward;
      
      if (availableKg < lowStock.minKg) {
        lowStockItems.push({
          ...transformLowStock(lowStock),
          availableKg,
          isLowStock: true,
        });
      }
    }
    
    res.status(200).json({
      success: true,
      count: lowStockItems.length,
      data: lowStockItems,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking low stock status',
      error: error.message,
    });
  }
};
