const { default: mongoose } = require("mongoose");
const QpData = require("../models/qpOrder.model"); // Adjust path to your model
const Staff = require("../models/staff.model");

// Add a new QP Order
exports.createQpOrder = async (req, res) => {
  try {
    const { companyName, party } = req.body;
    const { id } = req.user;
    req.body.createdBy = id;

    if (!companyName || !party) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: companyName and party",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(companyName) || !mongoose.Types.ObjectId.isValid(party)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format for companyName or party",
      });
    }

    if (req.body.size && !mongoose.Types.ObjectId.isValid(req.body.size)) {
      return res.status(400).json({
        success: false,
        message: "Invalid size ID format",
      });
    }

    if (req.body.ply && !mongoose.Types.ObjectId.isValid(req.body.ply)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ply ID format",
      });
    }

    if (req.body.kantan && !mongoose.Types.ObjectId.isValid(req.body.kantan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid kantan ID format",
      });
    }

    const qpOrder = new QpData(req.body);
    await qpOrder.save();

    const getOrder = await QpData.findById(qpOrder._id)
      .populate({
        path: "companyName",
        select: "companyName avatar",
      })
      .populate({
        path: "party",
        select:
          "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
      })
      .populate("ply", "ply")
      .populate("name", "name")
      .populate("length", "length")
      .populate("width", "width")
      .populate("height", "height")
      .populate("paperLength", "length")
      .populate("paperWidth", "width")
      .populate("paperName", "name")
      .populate("paperHeight", "height")
      .populate("kantan", "kantanName");
    res.status(201).json({
      success: true,
      message: "QP Order created successfully",
      data: getOrder,
    });
  } catch (error) {
    console.error("❌ Error creating QP order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create QP order",
      error: error.message,
    });
  }
};

// Get all QP Orders
exports.getAllQpOrders = async (req, res) => {
  try {
    const qpOrders = await QpData.find()
      .populate({
        path: "companyName",
        select: "companyName avatar",
      })
      .populate({
        path: "party",
        select:
          "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
      })
      .populate("ply", "ply")
      .populate("name", "name")
      .populate("length", "length")
      .populate("width", "width")
      .populate("height", "height")
      .populate("paperLength", "length")
      .populate("paperWidth", "width")
      .populate("paperName", "name")
      .populate("paperHeight", "height")
      .populate("kantan", "kantanName")
      .sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      message: "QP Orders fetched successfully",
      data: qpOrders,
    });
  } catch (error) {
    console.error("❌ Error fetching QP orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch QP orders",
      error: error.message,
    });
  }
};

// Get single QP Order by ID
exports.getQpOrderById = async (req, res) => {
  try {
    const qpOrder = await QpData.findById(req.params.id)
      .populate({
        path: "companyName",
        select: "companyName avatar",
      })
      .populate({
        path: "party",
        select:
          "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
      })
      .populate("ply", "ply")
      .populate("name", "name")
      .populate("length", "length")
      .populate("width", "width")
      .populate("height", "height")
      .populate("paperLength", "length")
      .populate("paperWidth", "width")
      .populate("paperName", "name")
      .populate("paperHeight", "height")
      .populate("kantan", "kantanName")
    if (!qpOrder) {
      return res.status(404).json({
        success: false,
        message: "QP Order not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "QP Order fetched successfully",
      data: qpOrder,
    });
  } catch (error) {
    console.error("❌ Error fetching QP order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch QP order",
      error: error.message,
    });
  }
};

// Update QP Order
exports.updateQpOrder = async (req, res) => {
  try {
    // const { companyName, party } = req.body;
    // if (!companyName || !party) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Missing required fields: companyName and party are required",
    //   });
    // }

    // Validate ObjectId fields
    // if (!mongoose.Types.ObjectId.isValid(companyName) || !mongoose.Types.ObjectId.isValid(party)) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Invalid ID format for companyName or party",
    //   });
    // }

    if (req.body.size && !mongoose.Types.ObjectId.isValid(req.body.size)) {
      return res.status(400).json({
        success: false,
        message: "Invalid size ID format",
      });
    }

    if (req.body.ply && !mongoose.Types.ObjectId.isValid(req.body.ply)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ply ID format",
      });
    }

    if (req.body.kantan && !mongoose.Types.ObjectId.isValid(req.body.kantan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid kantan ID format",
      });
    }

    const qpOrder = await QpData.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate({
        path: "companyName",
        select: "companyName avatar",
      })
      .populate({
        path: "party",
        select:
          "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
      })
      .populate("ply", "ply")
      .populate("name", "name")
      .populate("length", "length")
      .populate("width", "width")
      .populate("height", "height")
      .populate("paperLength", "length")
      .populate("paperWidth", "width")
      .populate("paperName", "name")
      .populate("paperHeight", "height")
      .populate("kantan", "kantanName");

    if (!qpOrder) {
      return res.status(404).json({
        success: false,
        message: "QP Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "QP Order updated successfully",
      data: qpOrder,
    });
  } catch (error) {
    console.error("❌ Error updating QP order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update QP order",
      error: error.message,
    });
  }
};

// Delete QP Order
exports.deleteQpOrder = async (req, res) => {
  try {
    const qpOrder = await QpData.findByIdAndDelete(req.params.id);

    if (!qpOrder) {
      return res.status(404).json({
        success: false,
        message: "QP Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "QP Order deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting QP order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete QP order",
      error: error.message,
    });
  }
};

exports.getOrdersByStaffId = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id, "id");
    // 1. Validate staffId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID format",
      });
    }

    // 2. Check if staff exists
    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    // 3. Fetch orders created by the staff member
    const orders = await QpData.find({ createdBy: id })
      .populate({
        path: "companyName",
        select: "companyName avatar",
      })
      .populate({
        path: "party",
        select:
          "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
      })
      .populate("ply", "ply")
      .populate("name", "name")
      .populate("name", "name")
      .populate("length", "length")
      .populate("width", "width")
      .populate("height", "height")
      .populate("paperLength", "length")
      .populate("paperWidth", "width")
      .populate("paperName", "name")
      .populate("paperHeight", "height")
      .populate("kantan", "kantanName")
      .sort({ createdAt: -1 });
    console.log("DEBUG : v:", orders);


    // 4. If no orders found, return an empty array with a message
    if (!orders || orders.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No orders found for this staff member",
        count: 0,
        data: [],
      });
    }

    // 5. Return the orders
    res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching orders by staff ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};
