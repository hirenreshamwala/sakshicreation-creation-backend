const ProductItem = require("../models/productItem.model");
const mongoose = require("mongoose");
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
// const csv = require('csv-parser');
// const ProductItem = require('../models/productItem.model');
// Create a new product item
exports.createProductItem = async (req, res) => {
  try {
    const { itemName } = req.body;

    // Input validation
    if (!itemName) {
      return res.status(400).json({
        success: false,
        message: "Item name is required",
      });
    }

    // Check for duplicate item name (case-insensitive)
    const existingItem = await ProductItem.findOne({ itemName: { $regex: `^${itemName}$`, $options: 'i' } });
    if (existingItem) {
      return res.status(409).json({
        success: false,
        message: "Item with this name already exists",
      });
    }

    // Create new product item
    const newProductItem = new ProductItem({ itemName });

    // Save to database
    await newProductItem.save();

    res.status(201).json({
      success: true,
      message: "Product item created successfully",
      data: newProductItem,
    });

  } catch (error) {
    console.error("Error creating product item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create product item",
      error: error.message,
    });
  }
};

exports.getAllProductItems = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      itemNames = []
    } = req.query;
    const skip = (page - 1) * limit;
    let filter = {};
    if (search) {
      filter.$or = [
        { itemName: { $regex: search, $options: "i" } }
      ];
    }
    if (itemNames.length) filter.itemName = { $in: itemNames };
    const total = await ProductItem.countDocuments(filter);
    const productItems = await ProductItem.find(filter)
      .skip(Number(skip))
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: productItems,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: Number(limit)
      }
    });
  } catch (error) {
    console.error("Error fetching product items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product items",
      error: error.message
    });
  }
};

exports.getProductItemFilters = async (req, res) => {
  try {
    const itemNames = await ProductItem.distinct("itemName");
    res.json({
      itemNames: itemNames.sort()
    });
  } catch (err) {
    console.error("Error in getProductItemFilters:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get single product item by ID
exports.getProductItemById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product item ID"
      });
    }

    // Find item by ID
    const productItem = await ProductItem.findById(id);

    // Check if item exists
    if (!productItem) {
      return res.status(404).json({
        success: false,
        message: "Product item not found"
      });
    }

    // Return success response
    res.status(200).json({
      success: true,
      data: productItem
    });

  } catch (error) {
    console.error("Error fetching product item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product item",
      error: error.message
    });
  }
};

// Update product item
exports.updateProductItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemName } = req.body;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product item ID"
      });
    }

    // Validate input
    if (!itemName) {
      return res.status(400).json({
        success: false,
        message: "Item name is required"
      });
    }

    // Find and update item
    const updatedProductItem = await ProductItem.findByIdAndUpdate(
      id,
      { itemName },
      { new: true, runValidators: true }
    );

    // Check if item exists
    if (!updatedProductItem) {
      return res.status(404).json({
        success: false,
        message: "Product item not found"
      });
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: "Product item updated successfully",
      data: updatedProductItem
    });

  } catch (error) {
    console.error("Error updating product item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product item",
      error: error.message
    });
  }
};

// Delete product item
exports.deleteProductItem = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product item ID"
      });
    }

    // Find and delete item
    const deletedProductItem = await ProductItem.findByIdAndDelete(id);

    // Check if item exists
    if (!deletedProductItem) {
      return res.status(404).json({
        success: false,
        message: "Product item not found"
      });
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: "Product item deleted successfully",
      data: deletedProductItem
    });

  } catch (error) {
    console.error("Error deleting product item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete product item",
      error: error.message
    });
  }
};

exports.bulkCreateProductItems = async (req, res) => {
  try {
    const file = req.file;

    if (!file || !file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const results = [];

    const stream = Readable.from(file.buffer);

    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          const productItems = [];

          for (const row of results) {
            const { itemName } = row;

            if (!itemName) {
              return res.status(400).json({
                success: false,
                message: `Missing itemName in row: ${JSON.stringify(row)}`,
              });
            }

            const existingItem = await ProductItem.findOne({
              itemName: { $regex: `^${itemName}$`, $options: 'i' },
            });

            if (existingItem) {
              return res.status(400).json({
                success: false,
                message: `Item "${itemName}" already exists`,
              });
            }

            productItems.push({ itemName });
          }

          const savedItems = await ProductItem.insertMany(productItems);

          return res.status(200).json({
            success: true,
            message: 'Bulk product upload completed successfully',
            count: savedItems.length,
            data: savedItems,
          });
        } catch (error) {
          console.error('Error processing bulk upload:', error);
          return res.status(500).json({
            success: false,
            message: `Failed to process bulk upload: ${error.message}`,
          });
        }
      });
  } catch (error) {
    console.error('Error in bulk upload:', error);
    return res.status(500).json({
      success: false,
      message: `Server error during bulk upload: ${error.message}`,
    });
  }
};