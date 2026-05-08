const mongoose = require("mongoose");
const Inventory = require("../models/inventory.model");
const Vendor = require("../models/vendor.model"); // Add missing import
const Kantan = require("../models/kantan.model"); // Add missing import (assume model exists)

exports.getInventoryByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const {
      type, // Optional: inward/outward
      page = 1,
      pageSize = 10,
      isPagination = true
    } = req.body; // From POST body

    if (!["printer", "binder", "booklet", "factory", "godown"].includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    let query = { category };
    if (type) query.type = type; // Filter by type if provided

    // Get total count
    const totalCount = await Inventory.countDocuments(query);

    let data = [];
    let pagination = null;

    if (isPagination) {
      const skip = (page - 1) * pageSize;
      data = await Inventory.find(query)
        .skip(skip)
        .limit(pageSize)
        .populate("material", "materialName materialSize materialGSM")
        .populate("vendor", "name")
        .populate("companyName", "companyName")
        .populate("for", "roleName")
        .populate("kantan", "kantanName")
        .populate("forCompany", "firstName lastName")
        .populate("orderId", "orderNumber")
        .sort({ date: -1 });

      pagination = {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNext: page < Math.ceil(totalCount / pageSize),
        hasPrev: page > 1,
      };
    } else {
      // Fetch all for aggregation
      data = await Inventory.find(query)
        .populate("material", "materialName materialSize materialGSM")
        .populate("vendor", "name")
        .populate("companyName", "companyName")
        .populate("for", "roleName")
        .populate("kantan", "kantanName")
        .populate("forCompany", "firstName lastName")
        .populate("orderId", "orderNumber")
        .sort({ date: -1 });
    }

    res.status(200).json({
      success: true,
      data,
      totalCount,
      pagination,
      count: data.length,
      message: "Inventory fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
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

// Get paper inventory summary by material for staff (printer, binder, booklet)
exports.getStaffPaperInventory = async (req, res) => {
  try {
    const { category } = req.params;
    const user = req.user;
    const {
      page = 1,
      pageSize = 10,
      isPagination = true
    } = req.body;

    // if (!["printer", "binder", "booklet"].includes(category)) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Invalid category. Must be printer, binder, or booklet",
    //   });
    // }

    console.log(req.user, 'bgsdghdgdgdgdgd')

    // Get all inventory records for this category
    const inventoryRecords = await Inventory.find({ forCompany: user.id, for: category })
      .populate("material", "materialName materialSize materialGSM")
      .populate("vendor", "name")
      .populate("purchase", "billNumber ratePerSheet")
      .sort({ date: -1 })
      .lean();

    // Group by material and calculate totals
    const materialMap = new Map();

    for (const record of inventoryRecords) {
      const materialId = record.material?._id?.toString() || 'unknown';
      const materialName = record.material?.materialName || 'Unknown Material';
      const materialSize = record.material?.materialSize || '-';
      const materialGSM = record.material?.materialGSM || '-';
  
      if (!materialMap.has(materialId)) {
        materialMap.set(materialId, {
          materialId,
          materialName,
          materialSize,
          materialGSM,
          totalPurchased: 0,
          totalUsed: 0,
          balance: 0,
          inwardRecords: [],
          outwardRecords: []
        });
      }

      const materialData = materialMap.get(materialId);

      if (record.type === 'inward') {
        materialData.totalPurchased += record.quantity || 0;
        materialData.inwardRecords.push({
          date: record.date,
          quantity: record.quantity,
          vendor: record.vendor?.name,
          billNumber: record.purchase?.billNumber,
          ratePerSheet: record.purchase?.ratePerSheet
        });
      } else if (record.type === 'outward') {
        materialData.totalUsed += record.quantity || 0;
        materialData.outwardRecords.push({
          date: record.date,
          quantity: record.quantity,
          orderId: record.orderId
        });
      }
    }

    // Calculate balance for each material
    for (const [id, data] of materialMap) {
      data.balance = data.totalPurchased - data.totalUsed;
    }

    let result = Array.from(materialMap.values());

    // Sort by material name
    result.sort((a, b) => a.materialName.localeCompare(b.materialName));

    // Pagination
    let pagination = null;
    if (isPagination) {
      const skip = (page - 1) * pageSize;
      const totalCount = result.length;
      result = result.slice(skip, skip + pageSize);

      pagination = {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNext: page < Math.ceil(totalCount / pageSize),
        hasPrev: page > 1,
      };
    }

    // Get overall summary
    const overallSummary = {
      totalPurchased: result.reduce((sum, item) => sum + item.totalPurchased, 0),
      totalUsed: result.reduce((sum, item) => sum + item.totalUsed, 0),
      totalBalance: result.reduce((sum, item) => sum + item.balance, 0)
    };

    res.status(200).json({
      success: true,
      data: result,
      summary: overallSummary,
      pagination,
      message: "Staff paper inventory fetched successfully"
    });
  } catch (error) {
    console.error("Error fetching staff paper inventory:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching staff paper inventory: " + error.message,
    });
  }
};

exports.getAllInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find({}, { __v: 0 })
      .populate('material', 'materialName materialSize materialGSM -__v')
      .populate('vendor', 'name -__v')
      .populate('companyName', 'companyName -__v')
      .populate('for', 'roleName -__v')
      .populate('kantan', 'kantanName -__v')
      .populate('forCompany', 'firstName lastName -__v')
      .populate('orderId', 'orderNumber -__v')
      .sort({ date: -1 })
      .lean();

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
exports.getAllInventoryForQuality = async (req, res) => {
  try {
    const {
      filters = {},
      search = "",
      startDate,
      endDate,
      isPagination = true,
      page = 1,
      pageSize = 10,
      includeCounts = true
    } = req.body;
    console.log("📊 Inventory API - Request:", { filters, search, startDate, endDate, page, pageSize, isPagination });

    // Build query object - similar to payment folders
    const query = {};
    let exprConditions = []; // Collect $expr conditions for derived fields

    // Search functionality - adapt for inventory fields
    if (search && search.trim()) {
      const directOr = [
        { 'material.materialName': { $regex: search, $options: "i" } },
        { 'vendor.name': { $regex: search, $options: "i" } },
        // Add more fields as needed
      ];
      query.$or = directOr;
    }

    // Date range filter on createdAt or date
    if (startDate || endDate) {
      query.date = {}; // or createdAt
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    // Category filter
    if (filters.category && filters.category.length > 0) {
      query.category = { $in: filters.category };
    }

    // Type filter (inward/outward)
    if (filters.type && filters.type.length > 0) {
      query.type = { $in: filters.type };
    }

    // Vendor filter
    if (filters.vendor && filters.vendor.length > 0) {
      const vendors = await Vendor.find({ name: { $in: filters.vendor } }).select('_id').lean();
      if (vendors.length > 0) {
        query.vendor = { $in: vendors.map(v => v._id) };
      }
    }

    // Fixed: Add inventory-specific filters (direct fields)
    if (filters.deckal && filters.deckal.length > 0) {
      // Normalize 'no' to handle null/empty in DB
      const normalizedDeckals = filters.deckal.map(val => val === 'no' ? { $in: [null, '', 'no'] } : val).flat();
      query.deckal = { $in: normalizedDeckals };
    }

    if (filters.ply && filters.ply.length > 0) {
      query.ply = { $in: filters.ply };
    }

    if (filters.gsm && filters.gsm.length > 0) {
      query.gsm = { $in: filters.gsm };
    }

    if (filters.bf && filters.bf.length > 0) {
      query.bf = { $in: filters.bf };
    }

    if (filters.color && filters.color.length > 0) {
      query.color = { $in: filters.color };
    }

    if (filters.isKantan !== undefined && filters.isKantan.length > 0) {
      query.isKantan = { $in: filters.isKantan.map(v => v === 'yes' ? true : false) };
    }

    // Fixed: Handle derived fields for box (using $expr)
    if (filters.boxSize && filters.boxSize.length > 0) {
      const sizeExpr = {
        $in: [
          {
            $concat: [
              { $toString: { $ifNull: ["$boxLength", ""] } },
              " x ",
              { $toString: { $ifNull: ["$boxWidth", ""] } },
              " x ",
              { $toString: { $ifNull: ["$boxHeight", ""] } }
            ]
          },
          filters.boxSize
        ]
      };
      exprConditions.push(sizeExpr);
    }

    if (filters.boxGSM && filters.boxGSM.length > 0) {
      const gsmExpr = {
        $in: [
          {
            $concat: [
              { $toString: { $ifNull: ["$paper1GSM", ""] } },
              " - ",
              { $toString: { $ifNull: ["$paper2GSM", ""] } },
              " - ",
              { $toString: { $ifNull: ["$paper3GSM", ""] } }
            ]
          },
          filters.boxGSM
        ]
      };
      exprConditions.push(gsmExpr);
    }

    // Apply $expr if any conditions
    if (exprConditions.length > 0) {
      query.$expr = exprConditions.length === 1 ? exprConditions[0] : { $and: exprConditions };
    }

    // Add more filters as needed (e.g., material, quantity range)

    console.log("📊 Inventory - Final query:", JSON.stringify(query, null, 2));

    // Get total count
    const totalCount = await Inventory.countDocuments(query);
    console.log("📊 Inventory - Total count:", totalCount);

    // Populate options
    const populateFields = [
      { path: "material", select: "materialName materialSize materialGSM" },
      { path: "vendor", select: "name" },
      { path: "companyName", select: "companyName" },
      { path: "for", select: "roleName" },
      { path: "kantan", select: "kantanName" },
      { path: "forCompany", select: "firstName lastName" },
      { path: "orderId", select: "orderNumber" },
    ];

    let data = [];
    let pagination = null;
    if (isPagination) {
      const skip = (page - 1) * pageSize;
      data = await Inventory.find(query)
        .skip(skip)
        .limit(pageSize)
        .populate(populateFields)
        .sort({ createdAt: -1 });
      pagination = {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNext: page < Math.ceil(totalCount / pageSize),
        hasPrev: page > 1,
      };
    } else {
      data = await Inventory.find(query)
        .populate(populateFields)
        .sort({ createdAt: -1 });
    }

    res.status(200).json({
      success: true,
      data: data,
      pagination: pagination,
      totalCount: totalCount,
      message: "Inventory fetched successfully"
    });
  } catch (error) {
    console.error("❌ Error fetching inventory:", error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory: ' + error.message,
    });
  }
};

// Fixed: Enhanced filter options with aggregation for derived fields (boxSize, boxGSM)
exports.getInventoryFilterOptions = async (req, res) => {
  try {
    const { field } = req.params;
    const filters = req.body || {};
    const { search = "", ...otherFilters } = filters;
    if (!field) {
      return res.status(400).json({
        success: false,
        message: "Field parameter is required"
      });
    }
    console.log("Inventory Filter Options - Field:", field, "Filters:", otherFilters);
    // Extended validFields for inventory-specific fields
    const validFields = [
      'category', 'type', 'vendor', 'date',
      'deckal', 'ply', 'gsm', 'bf', 'color',
      'kantanName', 'reel', 'boxType', 'boxSize', 'boxGSM', 'isKantan'
    ]; // Add more as needed based on your schema

    if (!validFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: `Invalid field. Valid: ${validFields.join(', ')}`
      });
    }

    // Build main query from other filters (similar to getAllInventory) - reuse logic if possible
    let query = {};

    // Category filter
    if (otherFilters.category && otherFilters.category.length > 0) {
      query.category = { $in: otherFilters.category };
    }

    // Type filter (inward/outward)
    if (otherFilters.type && otherFilters.type.length > 0) {
      query.type = { $in: otherFilters.type };
    }

    // Date range filter
    if (otherFilters.startDate || otherFilters.endDate) {
      query.date = {};
      if (otherFilters.startDate) {
        const start = new Date(otherFilters.startDate);
        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (otherFilters.endDate) {
        const end = new Date(otherFilters.endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    // Vendor filter (if field is not vendor, but otherFilters has it)
    if (otherFilters.vendor && otherFilters.vendor.length > 0) {
      const vendors = await Vendor.find({ name: { $in: otherFilters.vendor } }).select('_id').lean();
      if (vendors.length > 0) {
        query.vendor = { $in: vendors.map(v => v._id) };
      }
    }

    // Add more filter building as needed

    let uniqueValues = [];
    switch (field) {
      case "category":
        uniqueValues = await Inventory.distinct("category", query);
        break;
      case "type":
        uniqueValues = await Inventory.distinct("type", query);
        break;
      case "vendor":
        const vendorIds = await Inventory.distinct("vendor", query);
        const vendors = await Vendor.find({ _id: { $in: vendorIds } }, "name").lean();
        uniqueValues = vendors.map(v => v.name).filter(Boolean);
        break;
      case "date":
        const dateValues = await Inventory.distinct("date", query);
        uniqueValues = dateValues
          .filter(d => d && new Date(d).getTime() > 0)
          .map(d => new Date(d).toISOString().split('T')[0])
          .filter((v, i, self) => self.indexOf(v) === i)
          .sort();
        break;
      case "deckal":
        uniqueValues = await Inventory.distinct("deckal", query);
        uniqueValues = uniqueValues.filter(val => val && String(val).trim() !== "").sort();
        break;
      case "ply":
        uniqueValues = await Inventory.distinct("ply", query);
        uniqueValues = uniqueValues.filter(val => val && String(val).trim() !== "").sort((a, b) => a - b);
        break;
      case "gsm":
        uniqueValues = await Inventory.distinct("gsm", query);
        uniqueValues = uniqueValues.filter(val => val !== null && val !== undefined).sort((a, b) => a - b);
        break;
      case "bf":
        uniqueValues = await Inventory.distinct("bf", query);
        uniqueValues = uniqueValues.filter(val => val && String(val).trim() !== "").sort();
        break;
      case "color":
        uniqueValues = await Inventory.distinct("color", query);
        uniqueValues = uniqueValues.filter(val => val && String(val).trim() !== "").sort();
        break;
      case "kantanName":
        const kantanIds = await Inventory.distinct("kantan", query);
        const kantans = await Kantan.find({ _id: { $in: kantanIds } }, "kantanName").lean();
        uniqueValues = kantans.map(k => k.kantanName).filter(Boolean).sort();
        break;
      case "reel":
        uniqueValues = await Inventory.distinct("reel", query);
        uniqueValues = uniqueValues.filter(val => val && String(val).trim() !== "").sort();
        break;
      case "boxType":
        uniqueValues = await Inventory.distinct("boxType", query);
        uniqueValues = uniqueValues.filter(val => val && String(val).trim() !== "").sort();
        break;
      // Fixed: Derived boxSize via aggregation
      case "boxSize":
        const sizeResult = await Inventory.aggregate([
          { $match: query },
          {
            $project: {
              sizeStr: {
                $concat: [
                  { $toString: { $ifNull: ["$boxLength", ""] } },
                  " x ",
                  { $toString: { $ifNull: ["$boxWidth", ""] } },
                  " x ",
                  { $toString: { $ifNull: ["$boxHeight", ""] } }
                ]
              }
            }
          },
          { $group: { _id: "$sizeStr" } },
          { $match: { _id: { $ne: " x  x " } } }, // Exclude empty
          { $sort: { _id: 1 } }
        ]);
        uniqueValues = sizeResult.map(r => r._id).filter(Boolean);
        break;
      // Fixed: Derived boxGSM via aggregation
      case "boxGSM":
        const gsmResult = await Inventory.aggregate([
          { $match: query },
          {
            $project: {
              gsmStr: {
                $concat: [
                  { $toString: { $ifNull: ["$paper1GSM", ""] } },
                  " - ",
                  { $toString: { $ifNull: ["$paper2GSM", ""] } },
                  " - ",
                  { $toString: { $ifNull: ["$paper3GSM", ""] } }
                ]
              }
            }
          },
          { $group: { _id: "$gsmStr" } },
          { $match: { _id: { $ne: " -  - " } } }, // Exclude empty
          { $sort: { _id: 1 } }
        ]);
        uniqueValues = gsmResult.map(r => r._id).filter(Boolean);
        break;
      case "isKantan":
        uniqueValues = await Inventory.distinct("isKantan", query);
        uniqueValues = uniqueValues.filter(val => val !== null && val !== undefined)
          .map(val => val ? 'yes' : 'no') // Map to display values
          .sort();
        break;
      // Add more cases as needed
      default:
        uniqueValues = [];
    }

    // Apply search
    if (search && search.trim()) {
      const regex = new RegExp(search, 'i');
      uniqueValues = uniqueValues.filter(val => regex.test(String(val)));
    }

    // uniqueValues = uniqueValues.slice(0, 100); // Limit

    console.log(`✅ Inventory Filter options for ${field}:`, uniqueValues.length, "items");
    res.status(200).json({
      success: true,
      data: uniqueValues,
      count: uniqueValues.length
    });
  } catch (err) {
    console.error("❌ Error loading inventory filter options:", err);
    res.status(500).json({
      success: false,
      message: "Error loading filter options",
      error: err.message
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
      boxLength: length,
      boxWidth: width,
      boxHeight: height,
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
