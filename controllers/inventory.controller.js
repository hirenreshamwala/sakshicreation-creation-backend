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
      usedKg
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
    const updatedInventory = await Inventory.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
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
    const { uv, lamination, varnish } = req.query;

    const filter = { category: "printer", type: "inward" };

    if (uv !== undefined) filter.uv = uv === "true";
    if (lamination !== undefined) filter.lamination = lamination === "true";
    if (varnish !== undefined) filter.varnish = varnish === "true";

    // 1. Get total inward grouped by box spec
    const inward = await Inventory.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            boxLength: "$boxLength",
            boxWidth: "$boxWidth",
            boxHeight: "$boxHeight",
            uv: "$uv",
            lamination: "$lamination",
            varnish: "$varnish"
          },
          totalInward: { $sum: "$quantity" }
        }
      }
    ]);

    // 2. Get total outward grouped by same spec
    const outward = await Inventory.aggregate([
      {
        $match: {
          category: "printer",
          type: "outward"
        }
      },
      {
        $group: {
          _id: {
            boxLength: "$boxLength",
            boxWidth: "$boxWidth",
            boxHeight: "$boxHeight",
            uv: "$uv",
            lamination: "$lamination",
            varnish: "$varnish"
          },
          totalOutward: { $sum: "$quantity" }
        }
      }
    ]);

    // 3. Merge inward and outward to calculate available
    const availableBoxes = inward.map(inItem => {
      const outItem = outward.find(
        o => JSON.stringify(o._id) === JSON.stringify(inItem._id)
      );

      const available =
        inItem.totalInward - (outItem ? outItem.totalOutward : 0);

      return {
        ...inItem._id,
        availableBoxes: available
      };
    }).filter(item => item.availableBoxes > 0); // Remove zero stock

    res.status(200).json({
      success: true,
      count: availableBoxes.length,
      data: availableBoxes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching available boxes: " + error.message,
    });
  }
};
