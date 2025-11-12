const mongoose = require("mongoose");
const Inventory = require("../models/inventory.model");

exports.getInventoryByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    if (
      !["printer", "binder", "booklet", "factory", "godown"].includes(category)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    const inventory = await Inventory.find({ category })
      .populate("material", "materialName materialSize materialGSM")
      .populate("vendor", "name")
      .populate("companyName", "companyName")
      .populate("for", "roleName")
      .populate("kantan", "kantanName")
      .populate("forCompany", "firstName lastName")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: inventory.length,
      data: inventory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching inventory: " + error.message,
    });
  }
};

exports.getInventorySummary = async (req, res) => {
  try {
    const { category } = req.params;
    if (
      !["printer", "binder", "booklet", "factory", "godown"].includes(category)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    const inward = await Inventory.aggregate([
      { $match: { category, type: "inward" } },
      { $group: { _id: null, totalQty: { $sum: "$quantity" } } },
    ]);

    const outward = await Inventory.aggregate([
      { $match: { category, type: "outward" } },
      { $group: { _id: null, totalQty: { $sum: "$quantity" } } },
    ]);

    const lastPurchase = inward.length > 0 ? inward[0].totalQty : 0;
    const usedQty = outward.length > 0 ? outward[0].totalQty : 0;
    const balance = lastPurchase - usedQty;

    res.status(200).json({
      success: true,
      data: { lastPurchase, usedQty, balance },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching inventory summary: " + error.message,
    });
  }
};

exports.getAllInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find()
      .populate("material", "materialName materialSize materialGSM")
      .populate("vendor", "name")
      .populate("companyName", "companyName")
      .populate("for", "roleName")
      .populate("kantan", "kantanName")
      .populate("forCompany", "firstName lastName")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: inventory.length,
      data: inventory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching inventory: " + error.message,
    });
  }
};

exports.updateInventory = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid inventory ID format",
      });
    }

    // Check if inventory exists
    const existingInventory = await Inventory.findById(id);
    if (!existingInventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    // Extract update data from request body
    const {
      material,
      vendor,
      companyName,
      category,
      type,
      quantity,
      date,
      for: assignedTo,
      kantan,
      forCompany,
      remarks,
      usedKg,
    } = req.body;

    // Create update object with only provided fields
    const updateData = {};

    if (material !== undefined) updateData.material = material;
    if (vendor !== undefined) updateData.vendor = vendor;
    if (companyName !== undefined) updateData.companyName = companyName;
    if (category !== undefined) updateData.category = category;
    if (type !== undefined) updateData.type = type;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (date !== undefined) updateData.date = date;
    if (assignedTo !== undefined) updateData.for = assignedTo;
    if (kantan !== undefined) updateData.kantan = kantan;
    if (forCompany !== undefined) updateData.forCompany = forCompany;
    if (remarks !== undefined) updateData.remarks = remarks;
    if (usedKg !== undefined) updateData.usedKg = usedKg;

    // Update the inventory item
    const updatedInventory = await Inventory.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("material", "materialName materialSize materialGSM")
      .populate("vendor", "name")
      .populate("companyName", "companyName")
      .populate("for", "roleName")
      .populate("kantan", "kantanName")
      .populate("forCompany", "firstName lastName");

    res.status(200).json({
      success: true,
      message: "Inventory updated successfully",
      data: updatedInventory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating inventory: " + error.message,
    });
  }
};

exports.getAvailableBoxes = async (req, res) => {
  try {
    const {
      ply,
      length,
      width,
      height,
      deckal,
      paper1GSM,
      paper2GSM,
      paper3GSM,
    } = req.body;

    // ✅ Validate input
    if (!ply || !length || !width || !height) {
      return res.status(400).json({
        success: false,
        message: "Missing required box specification fields",
      });
    }

    // 🔍 Base filter
    const baseFilter = {
      inventoryType: "Box",
      ply,
      length,
      width,
      height,
      deckal,
      paper1GSM,
      paper2GSM,
      paper3GSM,
    };

    console.log(baseFilter, "filter-------------");

    // 🏭 Get inward/outward records for factory (only where usedBox < quantity)
    const factoryInward = await Inventory.find({
      ...baseFilter,
      type: "inward",
      category: "factory",
      $expr: { $lt: ["$usedBox", "$quantity"] },
    }).lean();

    const factoryOutward = await Inventory.find({
      ...baseFilter,
      type: "outward",
      category: "factory",
      $expr: { $lt: ["$usedBox", "$quantity"] },
    }).lean();

    // 📦 Get inward/outward records for godown (only where usedBox < quantity)
    const godownInward = await Inventory.find({
      ...baseFilter,
      type: "inward",
      category: "godown",
      $expr: { $lt: ["$usedBox", "$quantity"] },
    }).lean();

    const godownOutward = await Inventory.find({
      ...baseFilter,
      type: "outward",
      category: "godown",
      $expr: { $lt: ["$usedBox", "$quantity"] },
    }).lean();

    // 🧮 Calculate totals for each
    const calcTotal = (records) =>
      records.reduce((sum, item) => sum + (item.quantity || 0), 0);

    const factoryIn = calcTotal(factoryInward);
    const factoryOut = calcTotal(factoryOutward);
    const godownIn = calcTotal(godownInward);
    const godownOut = calcTotal(godownOutward);

    const factoryAvailable = factoryIn - factoryOut;
    const godownAvailable = godownIn - godownOut;
    const totalAvailable = factoryAvailable + godownAvailable;

    // ✅ Summary
    const summary = {
      factory: {
        inward: factoryIn,
        inArray: factoryInward,
        // outward: factoryOut,
        available: factoryAvailable > 0 ? factoryAvailable : 0,
      },
      godown: {
        inward: godownIn,
        inArray: factoryOutward,
        // outward: godownOut,
        available: godownAvailable > 0 ? godownAvailable : 0,
      },
      totalAvailable: totalAvailable > 0 ? totalAvailable : 0,
    };

    // ✅ Response payload
    const response = {
      success: true,
      filter: baseFilter,
      data: summary,
    };

    // 📋 Include full records only if boxes are available
    if (totalAvailable > 0) {
      response.records = {
        factoryInward,
        factoryOutward,
        godownInward,
        godownOutward,
      };
    }

    // ✅ Send response
    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching available boxes:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching available boxes: " + error.message,
    });
  }
};
 