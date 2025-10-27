const mongoose = require("mongoose");
const Purchase = require("../models/QualityPurchase.model");
const CompanyName = require("../models/companyName.model");
const Role = require("../models/role.model");
const Staff = require("../models/staff.model");
const Vendor = require("../models/vendor.model");
const Kantan = require("../models/kantan.model");
const PaperGSM = require("../models/paperGSM.model"); // Add PaperGSM model import
const Inventory = require("../models/inventory.model");
const xlsx = require("xlsx");

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
      kantan,
      paperMil,
      deckal,
      gsm,
      reel,
      reelBatchNo, // Added reelBatchNo
      category, // 👈 pass either "factory" or "godown" from frontend
      bf,
    } = req.body;
    console.log("req body", req.body);

    // Required validations
    if (
      !vendorName ||
      !billNumber ||
      !companyName ||
      !role ||
      !staff ||
      !type 
      // !bf
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Vendor, bill number, company, role, staff, and type are required",
      });
    }

    // Category validation
    if (!category || !["factory", "godown"].includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Category must be either factory or godown",
      });
    }

    if (type === "kantan" && (!kantan || !reel || !deckal)) {
      return res.status(400).json({
        success: false,
        message: "Kantan, reel and deckal are required for kantan type",
      });
    }

    // KG required for kantan/glue/wire
    if ((type === "glue" || type === "wire") && !kg) {
      return res.status(400).json({
        success: false,
        message: "KG is required for glue and wire types",
      });
    }

    // Paper fields required
    if (type === "paper" && (!gsm || !deckal || !bf)) {
      return res.status(400).json({
        success: false,
        message: "GSM, Deckal, and BF are required for paper type",
      });
    }

    // Kantan fields required
    if (type === "kantan" && (!reel || !reelBatchNo)) {
      return res.status(400).json({
        success: false,
        message: "Reel and Reel/Batch No are required for kantan type",
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

    // Bill number uniqueness (for QualityPurchase)
    const existingPurchase = await Purchase.findOne({ billNumber });
    if (existingPurchase) {
      return res.status(400).json({
        success: false,
        message: "Bill number must be unique",
      });
    }

    // Vendor, Company, Role, Staff validation
    const vendorExists = await Vendor.findById(vendorName);
    if (!vendorExists)
      return res
        .status(400)
        .json({ success: false, message: "Invalid vendor" });

    const companyExists = await CompanyName.findById(companyName);
    if (!companyExists)
      return res
        .status(400)
        .json({ success: false, message: "Invalid company" });

    const roleExists = await Role.findOne({ _id: role, isDelete: false });
    if (!roleExists)
      return res
        .status(400)
        .json({ success: false, message: "Invalid or deleted role" });

    const staffExists = await Staff.findOne({
      _id: staff,
      role: role,
      status: true,
    });
    if (!staffExists)
      return res.status(400).json({
        success: false,
        message: "Invalid staff or staff-role mismatch",
      });

    if (kantan) {
      const kantanExists = await Kantan.findById(kantan);
      if (!kantanExists)
        return res
          .status(400)
          .json({ success: false, message: "Invalid kantan" });
    }

    // ✅ Save Quality Purchase
    const newPurchase = new Purchase({
      vendorName,
      billNumber,
      kg: kg || 0,
      companyName,
      for: role,
      forCompany: staff,
      paperMil: type === "paper" ? paperMil : undefined,
      type,
      reel: type === "kantan" ? reel : undefined,
      reelBatchNo: type === "kantan" ? reelBatchNo : undefined, // Added reelBatchNo
      kantan: type === "kantan" ? kantan : undefined,
      deckal: type === "paper" ? deckal : undefined,
      gsm: type === "paper" ? gsm : undefined,
      category: category,
      bf: type === "paper" ? bf : undefined,
    });

    const savedPurchase = await newPurchase.save();

    // ✅ Save Inventory with only "factory" or "godown"
    const newInventory = new Inventory({
      category, // 👈 directly from req.body ("factory" | "godown")
      type: "inward",
      inventoryType: type,
      quantity: type === "paper" ? 1 : undefined,
      kg: kg || undefined,
      gsm: type === "paper" ? gsm : undefined,
      reel: reel || undefined,
      reelBatchNo: type === "kantan" ? reelBatchNo : undefined, // Added reelBatchNo to inventory
      vendor: vendorName,
      date: new Date(),
      qpPurchase: savedPurchase._id,
      companyName,
      kantan: type === "kantan" ? kantan : undefined,
      deckal: type === "paper" ? deckal : undefined,
      gsm: type === "paper" ? gsm : undefined,
      for: role,
      forCompany: staff,
      bf: type === "paper" ? bf : undefined,
    });

    await newInventory.save();

    // ✅ Populate for response
    const populatedPurchase = await Purchase.findById(savedPurchase._id)
      .populate("vendorName", "name")
      .populate("kantan", "kantanName deckal")
      .populate("companyName", "companyName avatar")
      .populate("for", "roleName")
      .populate("forCompany", "firstName lastName");

    res.status(201).json({
      success: true,
      data: populatedPurchase,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating quality purchase: " + error.message,
    });
  }
};

// Get all purchases with populated references
exports.getAllPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find()
      .populate("vendorName", "name")
      .populate("kantan", "kantanName deckal")
      .populate("companyName", "companyName avatar")
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
      .populate("kantan", "kantanName deckal")
      .populate("companyName", "companyName avatar")
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
      kantan,
      deckal,
      gsm,
      reel,
      reelBatchNo, // Added reelBatchNo
      paperMil,
      category,
      bf, // Added bf
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

    // Validate required fields for specific types
    if (type === "kantan" && (!kantan || !reel || !reelBatchNo)) {
      return res.status(400).json({
        success: false,
        message: "Kantan, Reel, and Reel/Batch No are required for kantan type",
      });
    }
    if ((type === "glue" || type === "wire") && !kg) {
      return res.status(400).json({
        success: false,
        message: "KG is required for glue and wire types",
      });
    }
    if (type === "paper" && (!deckal || !gsm || !bf)) {
      return res.status(400).json({
        success: false,
        message: "Deckal, GSM, and BF are required for paper type",
      });
    }

    // Prepare update data
    const updateData = {
      ...(vendorName && { vendorName }),
      ...(billNumber && { billNumber }),
      ...(kg !== undefined && { kg: Number(kg) || 0 }),
      ...(companyName && { companyName }),
      ...(role && { for: role }),
      ...(staff && { forCompany: staff }),
      ...(type && { type }),
      ...(kantan && { kantan }),
      ...(reel !== undefined && { reel }),
      ...(reelBatchNo && { reelBatchNo }), // Added reelBatchNo
      ...(gsm && { gsm }),
      ...(paperMil && { paperMil }),
      ...(deckal && { deckal }),
      ...(bf && { bf }), // Added bf
    };

    // Clear fields not relevant to the type
    if (type && type !== "kantan") {
      updateData.kantan = undefined;
      updateData.reel = undefined;
      updateData.reelBatchNo = undefined; // Clear reelBatchNo for non-kantan types
    }
    if (type && type !== "paper") {
      updateData.deckal = undefined;
      updateData.gsm = undefined;
      updateData.paperMil = undefined;
      updateData.bf = undefined;
    }
    if (
      type &&
      !(
        type === "kantan" ||
        type === "glue" ||
        type === "wire" ||
        type === "paper"
      )
    ) {
      updateData.kg = 0;
    }

    const updatedPurchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPurchase) {
      return res.status(400).json({
        success: false,
        message: "Purchase not found",
      });
    }

    // ======== UPDATE OR CREATE INVENTORY =========
    let inventoryData = {
      category: category || "factory", // 👈 default if not passed
      type: "inward",
      inventoryType: type,
      quantity: type === "paper" ? 1 : undefined,
      gsm: type === "paper" ? gsm : undefined,
      kg: kg || undefined,
      reel: reel || undefined,
      reelBatchNo: type === "kantan" ? reelBatchNo : undefined, // Added reelBatchNo to inventory
      vendor: vendorName,
      date: new Date(),
      qpPurchase: updatedPurchase._id,
      companyName,
      kantan: type === "kantan" ? kantan : undefined,
      deckal: type === "paper" ? deckal : undefined,
      gsm: type === "paper" ? gsm : undefined,
      paperMil: type === "paper" ? paperMil : undefined,
      bf: type === "paper" ? bf : undefined, // Added bf to inventory
      for: role,
      forCompany: staff,
    };

    // find if inventory exists for this purchase
    let inventory = await Inventory.findOne({
      qpPurchase: updatedPurchase._id,
    });

    if (inventory) {
      // update existing inventory
      await Inventory.findByIdAndUpdate(inventory._id, inventoryData, {
        new: true,
      });
    } else {
      // create new inventory
      const newInventory = new Inventory(inventoryData);
      await newInventory.save();
    }

    // Populate all references
    const populatedPurchase = await Purchase.findById(updatedPurchase._id)
      .populate("vendorName", "name")
      .populate("kantan", "kantanName deckal")
      .populate("companyName", "companyName avatar")
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

// Normalize helper
const normalize = (val) => (val ? String(val).trim().toLowerCase() : null);

// Generic helper to resolve by name
const findByName = async (Model, field, value, session) => {
  if (!value) return null;
  const normalized = normalize(value);

  const doc = await Model.findOne({
    [field]: { $regex: new RegExp(`^${normalized}$`, "i") },
  }).session(session);

  return doc ? doc._id : null;
};

exports.bulkCreatePurchases = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.file) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Read CSV
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    const purchases = [];
    const skippedRecords = [];

    for (const [index, row] of data.entries()) {
      try {
        // Vendor
        const vendorId = await findByName(
          Vendor,
          "vendorName",
          row.vendorName,
          session
        );
        if (!vendorId) {
          skippedRecords.push({
            row: index + 1,
            reason: `Vendor not found: ${row.vendorName}`,
          });
          continue;
        }

        // Kantan (optional)
        const kantanId = await findByName(Kantan, "name", row.kantan, session);

        const heightId = await findByName(
          PaperGSM,
          "name",
          row.height,
          session
        );
        const widthId = await findByName(PaperGSM, "name", row.width, session);
        const lengthId = await findByName(
          PaperGSM,
          "name",
          row.length,
          session
        );

        // Company
        const companyId = await findByName(
          CompanyName,
          "companyName",
          row.companyName,
          session
        );
        if (!companyId) {
          skippedRecords.push({
            row: index + 1,
            reason: `Company not found: ${row.companyName}`,
          });
          continue;
        }

        // Role
        const roleId = await findByName(Role, "roleName", row.for, session);
        if (!roleId) {
          skippedRecords.push({
            row: index + 1,
            reason: `Role not found: ${row.for}`,
          });
          continue;
        }

        // Staff
        const staffId = await findByName(
          Staff,
          "fullName",
          row.forCompany,
          session
        );
        if (!staffId) {
          skippedRecords.push({
            row: index + 1,
            reason: `Staff not found: ${row.forCompany}`,
          });
          continue;
        }

        // Purchase data
        const purchaseData = {
          vendorName: vendorId,
          billNumber: row.billNumber,
          type: row.type || null,
          kantan: kantanId,
          kg: row.kg || null,
          height: heightId,
          width: widthId,
          length: lengthId,
          companyName: companyId,
          for: roleId,
          forCompany: staffId,
        };

        const newPurchase = await Purchase.create([purchaseData], {
          session,
        });
        purchases.push(newPurchase[0]);
      } catch (err) {
        skippedRecords.push({
          row: index + 1,
          reason: err.message,
        });
        continue;
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Bulk purchases processed",
      insertedCount: purchases.length,
      skippedCount: skippedRecords.length,
      skippedRecords,
      data: purchases,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      success: false,
      message: "Failed to bulk create purchases",
      error: error.message,
    });
  }
};
