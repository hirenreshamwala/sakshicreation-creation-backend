const mongoose = require("mongoose");
const Purchase = require("../models/QualityPurchase.model");
const CompanyName = require("../models/companyName.model");
const Role = require("../models/role.model");
const Staff = require("../models/staff.model");
const Material = require("../models/material.model");
const Vendor = require("../models/vendor.model");
const Kantan = require("../models/kantan.model"); // Add Kantan model import
const Inventory = require("../models/inventory.model");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

// Get all companies
exports.getCompanies = async (req, res) => {
  try {
    const companies = await CompanyName.find().select("companyName _id");
    res.status(200).json({
      success: true,
      data: companies,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching companies: " + error.message,
    });
  }
};

// Get all roles
exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find({ isDelete: false }).select("roleName _id");
    res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching roles: " + error.message,
    });
  }
};

// Get staff by role
exports.getStaffByRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    // Log the roleId for debugging
    console.log("Received roleId:", roleId);

    // Check if roleId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(roleId)) {
      console.log("Invalid roleId format:", roleId);
      return res.status(400).json({
        success: false,
        message: "Invalid role ID format",
      });
    }

    // Verify role exists
    const role = await Role.findById(roleId);
    if (!role || role.isDelete) {
      console.log("Role not found or deleted:", roleId);
      return res.status(404).json({
        success: false,
        message: "Role not found or has been deleted",
      });
    }

    // Fetch staff with the given role
    const staff = await Staff.find({
      role: roleId,
      status: true,
    }).select("firstName lastName _id");

    res.status(200).json({
      success: true,
      count: staff.length,
      data: staff,
    });
  } catch (error) {
    console.error("Error in getStaffByRole:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching staff: " + error.message,
    });
  }
};

// Create a new purchase
exports.createPurchase = async (req, res) => {
  try {
    const {
      vendorName,
      billNumber,
      kg,
      companyName,
      for: role,
      forCompany: staff,
      type,
      kantan
    } = req.body;

    // Validate required fields
    if (!vendorName || !billNumber || !companyName || !role || !staff || !type) {
      return res.status(400).json({
        success: false,
        message: "Vendor, bill number, company, role, staff, and type are required",
      });
    }

    // Validate KG for glue and wire types
    if ((type === 'glue' || type === 'wire') && !kg) {
      return res.status(400).json({
        success: false,
        message: "KG is required for glue and wire types",
      });
    }

    // Validate kantan for kantan type
    if (type === 'kantan' && !kantan) {
      return res.status(400).json({
        success: false,
        message: "Kantan is required for kantan type",
      });
    }

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(vendorName) ||
      !mongoose.Types.ObjectId.isValid(companyName) ||
      !mongoose.Types.ObjectId.isValid(role) ||
      !mongoose.Types.ObjectId.isValid(staff) ||
      (kantan && !mongoose.Types.ObjectId.isValid(kantan))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    // Check if bill number already exists
    const existingPurchase = await Purchase.findOne({ billNumber });
    if (existingPurchase) {
      return res.status(400).json({
        success: false,
        message: "Bill number must be unique",
      });
    }

    // Verify vendor exists
    const vendorExists = await Vendor.findById(vendorName);
    if (!vendorExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor",
      });
    }

    // Verify company exists
    const companyExists = await CompanyName.findById(companyName);
    if (!companyExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid company",
      });
    }

    // Verify role exists and is not deleted
    const roleExists = await Role.findOne({ _id: role, isDelete: false });
    if (!roleExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid or deleted role",
      });
    }

    // Verify staff exists and matches role
    const staffExists = await Staff.findOne({
      _id: staff,
      role: role,
      status: true,
    });
    if (!staffExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff or staff-role mismatch",
      });
    }

    // Verify kantan exists if provided
    if (kantan) {
      const kantanExists = await Kantan.findById(kantan);
      if (!kantanExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid kantan",
        });
      }
    }

    // Create new purchase
    const newPurchase = new Purchase({
      vendorName,
      billNumber,
      kg: kg || 0,
      companyName,
      for: role,
      forCompany: staff,
      type,
      kantan: type === 'kantan' ? kantan : undefined
    });

    const savedPurchase = await newPurchase.save();

    // Populate all references
    const populatedPurchase = await Purchase.findById(savedPurchase._id)
      .populate("vendorName", "name")
      .populate("kantan")
      .populate("companyName", "companyName")
      .populate("for", "roleName")
      .populate("forCompany", "firstName lastName");

    res.status(201).json({
      success: true,
      data: populatedPurchase,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating purchase: " + error.message,
    });
  }
};

// Get all purchases with populated references
exports.getAllPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find()
      .populate("vendorName", "name")
      .populate("kantan")
      .populate("companyName", "companyName")
      .populate("for", "roleName")
      .populate("forCompany", "firstName lastName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching purchases: " + error.message,
    });
  }
};

// Get single purchase by ID with populated references
exports.getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate("vendorName", "name")
      .populate("kantan")
      .populate("companyName", "companyName")
      .populate("for", "roleName")
      .populate("forCompany", "firstName lastName");

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching purchase: " + error.message,
    });
  }
};

// Update purchase by ID
exports.updatePurchase = async (req, res) => {
  try {
    const {
      vendorName,
      billNumber,
      kg,
      companyName,
      for: role,
      forCompany: staff,
      type,
      kantan
    } = req.body;

    // Validate ObjectIds if provided
    if (vendorName && !mongoose.Types.ObjectId.isValid(vendorName)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vendor ID",
      });
    }

    if (companyName && !mongoose.Types.ObjectId.isValid(companyName)) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID",
      });
    }
    if (role && !mongoose.Types.ObjectId.isValid(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role ID",
      });
    }
    if (staff && !mongoose.Types.ObjectId.isValid(staff)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }
    if (kantan && !mongoose.Types.ObjectId.isValid(kantan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid kantan ID",
      });
    }

    // Check if bill number is being updated to an existing one
    if (billNumber) {
      const existingPurchase = await Purchase.findOne({
        billNumber,
        _id: { $ne: req.params.id },
      });
      if (existingPurchase) {
        return res.status(400).json({
          success: false,
          message: "Bill number must be unique",
        });
      }
    }

    // Verify vendor exists if provided
    if (vendorName) {
      const vendorExists = await Vendor.findById(vendorName);
      if (!vendorExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid vendor",
        });
      }
    }

    // Verify company exists if provided
    if (companyName) {
      const companyExists = await CompanyName.findById(companyName);
      if (!companyExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid company",
        });
      }
    }

    // Verify role exists and is not deleted if provided
    if (role) {
      const roleExists = await Role.findOne({ _id: role, isDelete: false });
      if (!roleExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid or deleted role",
        });
      }
    }

    // Verify staff exists and matches role if both provided
    if (staff && role) {
      const staffExists = await Staff.findOne({
        _id: staff,
        role: role,
        status: true,
      });
      if (!staffExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid staff or staff-role mismatch",
        });
      }
    }

    // Verify kantan exists if provided
    if (kantan) {
      const kantanExists = await Kantan.findById(kantan);
      if (!kantanExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid kantan",
        });
      }
    }

    // Prepare update data
    const updateData = {
      ...(vendorName && { vendorName }),
      ...(billNumber && { billNumber }),
      ...(kg !== undefined && { kg }),
      ...(companyName && { companyName }),
      ...(role && { for: role }),
      ...(staff && { forCompany: staff }),
      ...(type && { type }),
      ...(kantan && { kantan })
    };

    // Clear kantan if type is not kantan
    if (type && type !== 'kantan') {
      updateData.kantan = undefined;
    }

    const updatedPurchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPurchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    // Populate all references
    const populatedPurchase = await Purchase.findById(updatedPurchase._id)
      .populate("vendorName", "name")
      .populate("kantan")
      .populate("companyName", "companyName")
      .populate("for", "roleName")
      .populate("forCompany", "firstName lastName");

    res.status(200).json({
      success: true,
      data: populatedPurchase,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating purchase: " + error.message,
    });
  }
};

// Delete purchase by ID
exports.deletePurchase = async (req, res) => {
  try {
    const deletedPurchase = await Purchase.findByIdAndDelete(req.params.id);

    if (!deletedPurchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Purchase deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting purchase: " + error.message,
    });
  }
};

exports.bulkCreatePurchases = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const {
      vendorName,
      companyName,
      for: role,
      forCompany: staff,
      type
    } = req.body;

    // Validate required fields
    if (
      !vendorName ||
      !companyName ||
      !role ||
      !staff ||
      !type
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(vendorName) ||
      !mongoose.Types.ObjectId.isValid(companyName) ||
      !mongoose.Types.ObjectId.isValid(role) ||
      !mongoose.Types.ObjectId.isValid(staff)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    // Verify vendor exists
    const vendorExists = await Vendor.findById(vendorName);
    if (!vendorExists) {
      return res.status(400).json({
        success: false,
        message: `Invalid vendor ID: ${vendorName}`,
      });
    }

    // Verify company exists
    const companyExists = await CompanyName.findById(companyName);
    if (!companyExists) {
      return res.status(400).json({
        success: false,
        message: `Invalid company ID: ${companyName}`,
      });
    }

    // Verify role exists and is not deleted
    const roleExists = await Role.findOne({ _id: role, isDelete: false });
    if (!roleExists) {
      return res.status(400).json({
        success: false,
        message: `Invalid or deleted role ID: ${role}`,
      });
    }

    // Verify staff exists and matches role
    const staffExists = await Staff.findOne({
      _id: staff,
      role: role,
      status: true,
    });
    if (!staffExists) {
      return res.status(400).json({
        success: false,
        message: `Invalid staff ID or staff-role mismatch: ${staff}`,
      });
    }

    const results = [];
    const filePath = path.join(__dirname, "../uploads", file.filename);

    // Parse CSV file
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          const purchases = [];

          // Process each row
          for (const row of results) {
            const { billNumber, kg } = row;

            // Validate required fields
            if (!billNumber) {
              return res.status(400).json({
                success: false,
                message: `Missing bill number in row: ${JSON.stringify(row)}`,
              });
            }

            // Validate KG for glue and wire types
            if ((type === 'glue' || type === 'wire') && !kg) {
              return res.status(400).json({
                success: false,
                message: `KG is required for glue and wire types in row: ${JSON.stringify(row)}`,
              });
            }

            // Check for duplicate bill number
            const existingPurchase = await Purchase.findOne({ billNumber });
            if (existingPurchase) {
              return res.status(400).json({
                success: false,
                message: `Duplicate bill number: ${billNumber}`,
              });
            }

            // Prepare purchase record
            purchases.push({
              vendorName,
              billNumber,
              kg: kg ? Number(kg) : 0,
              companyName,
              for: role,
              forCompany: staff,
              type
            });
          }

          // Insert purchases
          const savedPurchases = await Purchase.insertMany(purchases);

          // Clean up uploaded file
          fs.unlinkSync(filePath);

          // Populate saved purchases
          const populatedPurchases = await Purchase.find({
            _id: { $in: savedPurchases.map((p) => p._id) },
          })
            .populate("vendorName", "name")
            .populate("companyName", "companyName")
            .populate("for", "roleName")
            .populate("forCompany", "firstName lastName");

          res.status(200).json({
            success: true,
            message: "Bulk purchase upload completed successfully",
            count: savedPurchases.length,
            data: populatedPurchases,
          });
        } catch (error) {
          console.error("Error processing bulk upload:", error);
          fs.unlinkSync(filePath);
          res.status(500).json({
            success: false,
            message: `Failed to process bulk upload: ${error.message}`,
          });
        }
      });
  } catch (error) {
    console.error("Error in bulk upload:", error);
    res.status(500).json({
      success: false,
      message: `Server error during bulk upload: ${error.message}`,
    });
  }
};