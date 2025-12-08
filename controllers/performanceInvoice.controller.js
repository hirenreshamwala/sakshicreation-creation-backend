const mongoose = require("mongoose");
const PerformanceInvoice = require("../models/performanceInvoice.model");
const CompanyName = require("../models/companyName.model");
const Party = require("../models/Party.model");
const Order = require("../models/order.model");

exports.createPerformanceInvoice = async (req, res) => {
  console.log("Creating performance invoice with data:", req.body);
  try {
    const {
      orderNumber,
      companyName,
      partyName,
      quantity,
      color,
      size,
      pType,
      assignedTo,
      unitPrice,
      total,
      applyGST,
      finalAmount,
      GSTNo,
      partyAddress,
      servicePerformance,
      daysAfterConfirmation,
      paymentDate, // Add this
      gstPercentage
    } = req.body;

    if (
      !orderNumber ||
      !companyName ||
      !partyName ||
      !quantity ||
      !servicePerformance
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: orderNumber, companyName, partyName, quantity, or servicePerformance",
      });
    }

    const order = await Order.findOne({ orderNumber })
      .populate("companyName")
      .populate(
        "party",
        "partyName contactPerson personWhatsAppNo GSTNo address"
      )
      .populate("productItem", "itemName");
    if (!order) {
      return res.status(400).json({
        success: false,
        message: "Invalid order number",
      });
    }

    const company = await CompanyName.findById(companyName);
    if (!company) {
      return res.status(400).json({
        success: false,
        message: "Invalid companyName ID",
      });
    }

    const party = await Party.findById(partyName);
    if (!party) {
      return res.status(400).json({
        success: false,
        message: "Invalid partyName ID",
      });
    }

    const calculatedTotal = quantity * (unitPrice || 0);
    const calculatedFinalAmount = applyGST
      ? calculatedTotal + (calculatedTotal * (gstPercentage || 18) / 100) // Use gstPercentage
      : calculatedTotal;

    const performanceInvoiceData = {
      orderNumber,
      assignedTo,
      order: order._id,
      companyName,
      party: partyName,
      quantity,
      color: color || order.productItem?.color || "",
      size: size || order.productItem?.size || "",
      pType: pType || "",
      unitPrice: unitPrice,
      total: calculatedTotal,
      applyGST: applyGST || false,
      finalAmount: calculatedFinalAmount,
      GSTNo: GSTNo || order.party?.GSTNo || "",
      partyAddress: partyAddress || order.party?.address || {},
      servicePerformance:
        servicePerformance || order.productItem?.itemName || "",
      daysAfterConfirmation,
      paymentDate, // Add this
      gstPercentage: gstPercentage || 0 // Add this
    };

    const newPerformanceInvoice = await PerformanceInvoice.create(
      performanceInvoiceData
    );

    const populatedInvoice = await PerformanceInvoice.findById(
      newPerformanceInvoice._id
    )
      .populate("companyName")
      .populate("party", "partyName GSTNo address");
    res.status(201).json({
      success: true,
      message: "Performance invoice created successfully",
      data: populatedInvoice,
    });
  } catch (error) {
    console.error("Error creating performance invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create performance invoice",
      error: error.message,
    });
  }
};

exports.getAllPerformanceInvoices = async (req, res) => {
  try {
    const performanceInvoices = await PerformanceInvoice.find()
      .populate("companyName")
      .populate({
        path: "party",
        select: "-__v",
        populate: [
          {
            path: "address.marketName",
            model: "Market",
            select: "marketName", // only marketName
          },
          // {
          //   path: "address.streetAddress",
          //   model: "Market",
          //   select: "streetAddress", // only streetAddress
          // },
          {
            path: "address.landMark",
            model: "Market",
            select: "landmark", // only landMark
          },
          {
            path: "address.area",
            model: "Market",
            select: "area", // only area
          },
          {
            path: "address.pincode",
            model: "Market",
            select: "pincode", // only pincode
          },
        ],
      })
      .populate("order")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: performanceInvoices.length,
      data: performanceInvoices,
    });
  } catch (error) {
    console.error("Error getting performance invoices:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch performance invoices",
      error: error.message,
    });
  }
};

exports.getPerformanceInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid PerformanceInvoice ID",
      });
    }

    const performanceInvoice = await PerformanceInvoice.findById(id)
      .populate("companyName")
      .populate("party", "partyName GSTNo address")
      .populate("assignedTo", "firstName lastName");

    if (!performanceInvoice) {
      return res.status(404).json({
        success: false,
        message: "Performance invoice not found",
      });
    }

    const responseData = {
      _id: performanceInvoice._id,
      orderNumber: performanceInvoice.orderNumber,
      companyName: performanceInvoice.companyName._id.toString(),
      partyName: performanceInvoice.party._id.toString(),
      quantity: performanceInvoice.quantity,
      color: performanceInvoice.color,
      size: performanceInvoice.size,
      pType: performanceInvoice.pType,
      GSTNo: performanceInvoice.GSTNo,
      partyAddress: performanceInvoice.partyAddress,
      servicePerformance: performanceInvoice.servicePerformance,
      unitPrice: performanceInvoice.unitPrice || 0,
      total: performanceInvoice.total || 0,
      applyGST: performanceInvoice.applyGST || false,
      finalAmount: performanceInvoice.finalAmount || 0,
      assignedTo: performanceInvoice.assignedTo,
      companyNameObj: performanceInvoice.companyName,
      partyObj: performanceInvoice.party,
      paymentDate: performanceInvoice.paymentDate,
      gstPercentage: performanceInvoice.gstPercentage || 0,
    };

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching performance invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch performance invoice",
      error: error.message,
    });
  }
};

exports.updatePerformanceInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      orderNumber,
      companyName,
      partyName,
      quantity,
      color,
      size,
      pType,
      assignedTo,
      unitPrice,
      total,
      applyGST,
      finalAmount,
      GSTNo,
      gstPercentage,
      partyAddress,
      servicePerformance,
      daysAfterConfirmation,
      paymentDate
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid PerformanceInvoice ID",
      });
    }

    const performanceInvoice = await PerformanceInvoice.findById(id);
    if (!performanceInvoice) {
      return res.status(400).json({
        success: false,
        message: "Performance invoice not found",
      });
    }

    if (
      !orderNumber ||
      !companyName ||
      !partyName ||
      !quantity ||
      !servicePerformance
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: orderNumber, companyName, partyName, quantity, or servicePerformance",
      });
    }

    const order = await Order.findOne({ orderNumber });
    if (!order) {
      return res.status(400).json({
        success: false,
        message: "Invalid order number",
      });
    }

    const company = await CompanyName.findById(companyName);
    if (!company) {
      return res.status(400).json({
        success: false,
        message: "Invalid companyName ID",
      });
    }

    const party = await Party.findById(partyName);
    if (!party) {
      return res.status(400).json({
        success: false,
        message: "Invalid partyName ID",
      });
    }

    const calculatedTotal = quantity * (unitPrice || 0);
    const calculatedFinalAmount = applyGST
      ? calculatedTotal + (calculatedTotal * (gstPercentage || 18) / 100) // Use gstPercentage
      : calculatedTotal;

    const updatedPerformanceInvoice =
      await PerformanceInvoice.findByIdAndUpdate(
        id,
        {
          orderNumber,
          order: order._id,
          companyName,
          party: partyName,
          quantity,
          color,
          assignedTo,
          size,
          pType,
          unitPrice: unitPrice,
          total: calculatedTotal,
          applyGST: applyGST || false,
          finalAmount: calculatedFinalAmount,
          GSTNo: GSTNo || order.party?.GSTNo || "",
          partyAddress: partyAddress || order.party?.address || {},
          servicePerformance,
          daysAfterConfirmation,
          gstPercentage,
          paymentDate,
        },
        { new: true, runValidators: true }
      )
        .populate("companyName")
        .populate("party")
        .populate("order");

    res.status(200).json({
      success: true,
      message: "Performance invoice updated successfully",
      data: updatedPerformanceInvoice,
    });
  } catch (error) {
    console.error("Error updating performance invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update performance invoice",
      error: error.message,
    });
  }
};

exports.deletePerformanceInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid PerformanceInvoice ID",
      });
    }

    const performanceInvoice = await PerformanceInvoice.findByIdAndDelete(id);
    if (!performanceInvoice) {
      return res.status(404).json({
        success: false,
        message: "Performance invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Performance invoice deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting performance invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete performance invoice",
      error: error.message,
    });
  }
};