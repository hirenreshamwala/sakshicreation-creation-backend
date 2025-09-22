const { default: mongoose } = require("mongoose");
const QpData = require("../models/qpOrder.model"); // Adjust path to your model
const Staff = require("../models/staff.model");
const Inventory = require("../models/inventory.model"); // Import Inventory model
const PackagingOption = require("../models/packagingOption.model");
const _ = require("lodash");

// Add a new QP Order
exports.createQpOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { companyName, party, packagingOption, ...orderFields } = req.body;
    const { id } = req.user;

    if (!companyName || !party) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Missing required fields: companyName and party",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(companyName) ||
      !mongoose.Types.ObjectId.isValid(party)
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid ID format for companyName or party",
      });
    }

    if (
      orderFields.kantan &&
      !mongoose.Types.ObjectId.isValid(orderFields.kantan)
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid kantan ID format",
      });
    }

    // Validate packagingOption fields
    const {
      ply,
      length,
      width,
      height,
      deckal,
      paper1GSM,
      paper2GSM,
      paper3GSM,
    } = packagingOption || {};
    if (
      !ply ||
      !length ||
      !width ||
      !height ||
      !deckal ||
      !paper1GSM ||
      !paper2GSM ||
      !paper3GSM
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Missing required packaging option fields",
      });
    }

    // Check if a PackagingOption exists for the provided data
    let packaging = await PackagingOption.findOne({
      party,
      ply,
      length,
      width,
      height,
      deckal,
      paper1GSM,
      paper2GSM,
      paper3GSM,
    }).session(session);

    if (!packaging) {
      // Create new PackagingOption if none exists
      packaging = new PackagingOption({
        party,
        ply,
        length,
        width,
        height,
        deckal,
        paper1GSM,
        paper2GSM,
        paper3GSM,
      });
      await packaging.save({ session });
    }

    // Create QP Order with orderdata reference
    const qpOrderData = {
      companyName,
      party,
      orderdata: packaging._id,
      createdBy: id,
      ...orderFields,
    };

    const qpOrder = new QpData(qpOrderData);
    await qpOrder.save({ session });

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
      .populate(
        "orderdata",
        "party ply length width height deckal paper1GSM paper2GSM paper3GSM"
      )
      .populate("kantan", "kantanName")
      .session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "QP Order created successfully",
      data: getOrder,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
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
      .populate(
        "orderdata",
        "party ply length width height deckal paper1GSM paper2GSM paper3GSM"
      )
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
      .populate(
        "orderdata",
        "party ply length width height deckal paper1GSM paper2GSM paper3GSM"
      )
      .populate("kantan", "kantanName");
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

function convertToReels(reels = 0, inches = 0) {
  const totalInches = reels * 7200 + inches; // convert everything to inches
  const totalReels = totalInches / 7200; // convert back to reels
  return parseFloat(totalReels.toFixed(3)); // round to 3 decimals (optional)
}
// Update QP Order with inventory outward creation on completion
exports.updateQpOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get the current order before update
    const currentOrder = await QpData.findById(req.params.id).session(session);
    if (!currentOrder) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "QP Order not found",
      });
    }

    // Validate ObjectId fields
    if (req.body.size && !mongoose.Types.ObjectId.isValid(req.body.size)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid size ID format",
      });
    }

    if (req.body.kantan && !mongoose.Types.ObjectId.isValid(req.body.kantan)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid kantan ID format",
      });
    }

    // Update the order
    let packagingOptionId = currentOrder.orderdata; // Default to existing orderdata
    if (req.body.packagingOption) {
      const {
        party,
        ply,
        length,
        width,
        height,
        deckal,
        paper1GSM,
        paper2GSM,
        paper3GSM,
      } = req.body.packagingOption;

      // Validate packagingOption fields
      if (
        !party ||
        !ply ||
        !length ||
        !width ||
        !height ||
        !deckal ||
        !paper1GSM ||
        !paper2GSM ||
        !paper3GSM
      ) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Missing required packaging option fields",
        });
      }

      // Check if a PackagingOption exists for the provided data
      let packaging = await PackagingOption.findOne({
        party,
        ply,
        length,
        width,
        height,
        deckal,
        paper1GSM,
        paper2GSM,
        paper3GSM,
      }).session(session);

      if (!packaging) {
        // Create new PackagingOption if none exists
        packaging = new PackagingOption({
          party,
          ply,
          length,
          width,
          height,
          deckal,
          paper1GSM,
          paper2GSM,
          paper3GSM,
        });
        await packaging.save({ session });
      }

      packagingOptionId = packaging._id; // Update the packagingOptionId to the new or existing PackagingOption
    }

    // Prepare update data
    const updateData = {
      ...req.body,
      orderdata: packagingOptionId, // Update orderdata with the new or existing PackagingOption ID
    };

    // Update the order
    const qpOrder = await QpData.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
      session,
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
      .populate(
        "orderdata",
        "party ply length width height deckal paper1GSM paper2GSM paper3GSM"
      )
      .populate("kantan", "kantanName");

    if (!qpOrder) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "QP Order not found",
      });
    }

    // Check if status changed to "completed"
    const statusChangedToCompleted =
      req.body.status === "Completed" && currentOrder.status !== "Completed";

    const getRole = await Staff.findById(qpOrder);

    // Create outward inventory entry if status changed to completed
    // inside updateQpOrder after statusChangedToCompleted check

    if (statusChangedToCompleted) {
      // 🔹 Box Inward (with actualNoOfPieces)
      if (qpOrder.actualNoOfPieces) {
        const inwardBox = new Inventory({
          category: "factory",
          type: "inward",
          inventoryType: "Box",
          quantity: qpOrder.actualNoOfPieces || undefined,
          booked: qpOrder.booked || false,
          boxLength: qpOrder.orderdata?.length || undefined,
          boxWidth: qpOrder.orderdata?.width || undefined,
          boxHeight: qpOrder.orderdata?.height || undefined,
          p1gsm: qpOrder.actualPaperKG?.paper1 || undefined,
          p2gsm: qpOrder.actualPaperKG?.paper2 || undefined,
          p3gsm: qpOrder.actualPaperKG?.paper3 || undefined,
          date: new Date(),
          qpPurchase: qpOrder._id,
          qpOrder: qpOrder._id,
          companyName: qpOrder.companyName,
          for: qpOrder.assignedTo || undefined,
          forCompany: qpOrder.createdBy || undefined,
        });

        if (qpOrder.actualNoOfPieces) {
          inwardBox.actualNoOfPieces = qpOrder.actualNoOfPieces;
        }

        await inwardBox.save({ session });
      }

      // 🔹 Box Outward (only noOfPieces)
      if (qpOrder.noOfPieces) {
        const outwardBox = new Inventory({
          category: "factory",
          type: "outward",
          inventoryType: "Box",
          quantity: qpOrder.noOfPieces || undefined,
          booked: qpOrder.booked || false,
          boxLength: qpOrder.orderdata?.length || undefined,
          boxWidth: qpOrder.orderdata?.width || undefined,
          boxHeight: qpOrder.orderdata?.height || undefined,
          p1gsm: qpOrder.actualPaperKG?.paper1 || undefined,
          p2gsm: qpOrder.actualPaperKG?.paper2 || undefined,
          p3gsm: qpOrder.actualPaperKG?.paper3 || undefined,
          date: new Date(),
          qpOrder: qpOrder._id,
          qpPurchase: qpOrder._id,
          companyName: qpOrder.companyName,
          for: qpOrder.assignedTo || undefined,
          forCompany: qpOrder.createdBy || undefined,
        });

        await outwardBox.save({ session });
      }
      if (qpOrder.actualPaperKG) {
        // for paper1
        const outwardPaper1 = new Inventory({
          category: "factory",
          type: "outward",
          inventoryType: "Paper",
          p1gsm: qpOrder.actualPaperKG?.paper1 || undefined,
          p2gsm: qpOrder.actualPaperKG?.paper1 || undefined,
          p3gsm: qpOrder.actualPaperKG?.paper1 || undefined,
          date: new Date(),
          qpOrder: qpOrder._id,
          qpPurchase: qpOrder._id,
          companyName: qpOrder.companyName,
          for: qpOrder.assignedTo || undefined,
          forCompany: qpOrder.createdBy || undefined,
        });

        await outwardPaper1.save({ session });

        // for paper 2
        if (
          !_.isEqual(qpOrder.actualPaperKG.paper1, qpOrder.actualPaperKG.paper2)
        ) {
          const outwardPaper2 = new Inventory({
            category: "factory",
            type: "outward",
            inventoryType: "Paper",
            p1gsm: qpOrder.actualPaperKG?.paper2 || undefined,
            p2gsm: qpOrder.actualPaperKG?.paper2 || undefined,
            p3gsm: qpOrder.actualPaperKG?.paper2 || undefined,
            date: new Date(),
            qpOrder: qpOrder._id,
            qpPurchase: qpOrder._id,
            companyName: qpOrder.companyName,
            for: qpOrder.assignedTo || undefined,
            forCompany: qpOrder.createdBy || undefined,
          });

          await outwardPaper2.save({ session });
        }

        if (
          !_.isEqual(qpOrder.actualPaperKG.paper1, qpOrder.actualPaperKG.paper2)
        ) {
          const outwardPaper2 = new Inventory({
            category: "factory",
            type: "outward",
            inventoryType: "Paper",
            p1gsm: qpOrder.actualPaperKG?.paper3 || undefined,
            p2gsm: qpOrder.actualPaperKG?.paper3 || undefined,
            p3gsm: qpOrder.actualPaperKG?.paper3 || undefined,
            date: new Date(),
            qpOrder: qpOrder._id,
            qpPurchase: qpOrder._id,
            companyName: qpOrder.companyName,
            for: qpOrder.assignedTo || undefined,
            forCompany: qpOrder.createdBy || undefined,
          });

          await outwardPaper2.save({ session });
        }

        if (
          !_.isEqual(
            qpOrder.actualPaperKG.paper3,
            qpOrder.actualPaperKG.paper1
          ) &&
          !_.isEqual(qpOrder.actualPaperKG.paper3, qpOrder.actualPaperKG.paper2)
        ) {
          const outwardPaper3 = new Inventory({
            category: "factory",
            type: "outward",
            inventoryType: "Paper",
            p3gsm: qpOrder.actualPaperKG.paper3 || undefined,
            date: new Date(),
            qpOrder: qpOrder._id,
            qpPurchase: qpOrder._id,
            companyName: qpOrder.companyName,
            for: qpOrder.assignedTo || undefined,
            forCompany: qpOrder.createdBy || undefined,
          });

          await outwardPaper3.save({ session });
        }
      }
      // 🔹 Kantan Outward
      if (qpOrder.kantan && qpOrder.actualTotalKantan?.reel) {
        const outwardKantan = new Inventory({
          category: "factory",
          type: "outward",
          inventoryType: "Kantan",
          reel:
            convertToReels(
              qpOrder.actualTotalKantan.reel,
              qpOrder.actualTotalKantan.inch
            ) || undefined,
          kantan: qpOrder.kantan || undefined,
          vendor: qpOrder.vendor || undefined,
          date: new Date(),
          qpOrder: qpOrder._id,
          qpPurchase: qpOrder._id,
          companyName: qpOrder.companyName,
          for: qpOrder.assignedTo || undefined,
          forCompany: qpOrder.createdBy || undefined,
        });
        await outwardKantan.save({ session });
      }

      // 🔹 Glue Outward
      if (qpOrder.glue && qpOrder.glue.trim() !== "") {
        const outwardGlue = new Inventory({
          category: "factory",
          type: "outward",
          inventoryType: "Glue",
          kg: qpOrder.glue || undefined,
          vendor: qpOrder.vendor || undefined,
          date: new Date(),
          qpOrder: qpOrder._id,
          qpPurchase: qpOrder._id,
          companyName: qpOrder.companyName,
          for: qpOrder.assignedTo || undefined,
          forCompany: qpOrder.createdBy || undefined,
        });
        await outwardGlue.save({ session });
      }

      // 🔹 Wire Outward
      if (qpOrder.wire && qpOrder.wire.trim() !== "") {
        const outwardWire = new Inventory({
          category: "factory",
          type: "outward",
          inventoryType: "Wire",
          kg: qpOrder.wire || undefined,
          vendor: qpOrder.vendor || undefined,
          date: new Date(),
          qpOrder: qpOrder._id,
          qpPurchase: qpOrder._id,
          companyName: qpOrder.companyName,
          for: qpOrder.assignedTo || undefined,
          forCompany: qpOrder.createdBy || undefined,
        });
        await outwardWire.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "QP Order updated successfully",
      data: qpOrder,
      outwardCreated: statusChangedToCompleted,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
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

// Get orders by staff ID
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
      .populate(
        "orderdata",
        "party ply length width height deckal paper1GSM paper2GSM paper3GSM"
      )
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

// Dedicated endpoint to update order status only
exports.updateQpOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status } = req.body;
    const { id } = req.params;

    // Get the current order
    const currentOrder = await QpData.findById(id).session(session);
    if (!currentOrder) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "QP Order not found",
      });
    }

    // Update the status
    const updatedOrder = await QpData.findByIdAndUpdate(
      id,
      { status },
      {
        new: true,
        runValidators: true,
        session,
      }
    )
      .populate({
        path: "companyName",
        select: "companyName avatar",
      })
      .populate({
        path: "party",
        select:
          "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
      })
      .populate(
        "orderdata",
        "party ply length width height deckal paper1GSM paper2GSM paper3GSM"
      )
      .populate("kantan", "kantanName");

    // Check if status changed to "completed"
    const statusChangedToCompleted =
      status === "Completed" && currentOrder.status !== "Completed";

    // Create outward inventory entry if status changed to completed
    if (statusChangedToCompleted) {
      const outwardInventory = new Inventory({
        category: "factory", // Adjust category as needed
        type: "outward",
        material: updatedOrder.paperName || undefined,
        quantity: updatedOrder.quantity || 1,
        kg: updatedOrder.weight || undefined,
        reel: updatedOrder.reel || undefined,
        vendor: updatedOrder.vendor || undefined,
        date: new Date(),
        qpOrder: updatedOrder._id,
        companyName: updatedOrder.companyName,
        kantan: updatedOrder.kantan || undefined,
        paperName: updatedOrder.paperName || undefined,
        deckal: updatedOrder.deckal || undefined,
        gsm: updatedOrder.gsm || undefined,
        for: updatedOrder.assignedTo || undefined,
        forCompany: updatedOrder.createdBy || undefined,
        remarks: `Outward entry for completed QP order ${
          updatedOrder.orderNumber || updatedOrder._id
        }`,
      });

      await outwardInventory.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "QP Order status updated successfully",
      data: updatedOrder,
      outwardCreated: statusChangedToCompleted,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Error updating QP order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update QP order status",
      error: error.message,
    });
  }
};
