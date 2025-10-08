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
      party: party, // Use the party ID from req.body
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
        party: party, // Explicitly set the party ID
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

exports.getAllQpOrders = async (req, res) => {
  try {
    const { status, companyName, party, staffId, orderNo } = req.body; // filters from body

    const filter = {};
    if (req.body.startDate || req.body.endDate) {
      filter.createdAt = {};
      if (req.body.startDate) {
        filter.createdAt.$gte = new Date(req.body.startDate).setHours(
          0,
          0,
          0,
          0
        );
      }
      if (req.body.endDate) {
        filter.createdAt.$lte = new Date(req.body.endDate).setHours(
          23,
          59,
          59,
          999
        );
      }
    }
    if (status) {
      // Allow array or single status
      if (Array.isArray(status)) {
        filter.status = { $in: status };
      } else {
        filter.status = status;
      }
    }

    if (companyName && mongoose.Types.ObjectId.isValid(companyName)) {
      filter.companyName = companyName;
    }

    if (party && mongoose.Types.ObjectId.isValid(party)) {
      filter.party = party;
    }

    if (staffId && mongoose.Types.ObjectId.isValid(staffId)) {
      filter.createdBy = staffId;
    }

    if (orderNo) {
      filter.orderNo = orderNo;
    }

    const qpOrders = await QpData.find(filter)
      .populate({
        path: "companyName",
        select: "companyName avatar",
      })
      // .populate({
      //   path: "party",
      //   select:
      //     "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
      // })
      .populate({
        path: "party",
        select: "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
        // match: partyMatch,
        populate: [
          { path: "address.marketName", model: "Market", select: "marketName" },
          // { path: "address.streetAddress", model: "Market", select: "streetAddress" },
          { path: "address.landMark", model: "Market", select: "landmark" },
          { path: "address.area", model: "Market", select: "area" },
          { path: "address.pincode", model: "Market", select: "pincode" },
        ]
      })
      .populate(
        "orderdata",
        "party ply length width height deckal paper1GSM paper2GSM paper3GSM"
      )
      .populate("kantan", "kantanName")
      .populate({
        path: "printer",
        select: "firstName lastName", // Add printer name population
      })
      .populate({
        path: "binder",
        select: "firstName lastName", // Add binder name population
      })
      .populate({
        path: "driver",
        select: "firstName lastName email", // Add binder name population
      })
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

exports.getQpOrderById = async (req, res) => {
  try {
    const qpOrder = await QpData.findById(req.params.id)
      .populate({
        path: "companyName",
        select: "companyName avatar",
      })
      // .populate({
      //   path: "party",
      //   select:
      //     "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
      // })
      .populate({
        path: "party",
        select: "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
        // match: partyMatch,
        populate: [
          { path: "address.marketName", model: "Market", select: "marketName" },
          // { path: "address.streetAddress", model: "Market", select: "streetAddress" },
          { path: "address.landMark", model: "Market", select: "landmark" },
          { path: "address.area", model: "Market", select: "area" },
          { path: "address.pincode", model: "Market", select: "pincode" },
        ]
      })
      .populate(
        "orderdata",
        "party ply length width height deckal paper1GSM paper2GSM paper3GSM"
      )
      .populate("kantan", "kantanName")
      .populate({
        path: "printer",
        select: "firstName lastName", // Add printer name population
      })
      .populate({
        path: "binder",
        select: "firstName lastName", // Add binder name population
      });

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
  const totalInches = Number(reels) * 7200 + Number(inches);
  const totalReels = totalInches / 7200;
  return parseFloat(totalReels.toFixed(3));
}

async function handlePaperAllocations(qpOrder, updateData, session) {
  const Inventory = mongoose.model("Inventory");

  // Clear previous allocations if papers are being changed
  if (updateData.selectedPapers && qpOrder.paperAllocations.length > 0) {
    // Remove allocations from inventory items
    for (const allocation of qpOrder.paperAllocations) {
      await Inventory.findByIdAndUpdate(
        allocation.inventoryId,
        {
          $pull: { allocations: { qpOrder: qpOrder._id } },
        },
        { session }
      );
    }

    // Clear allocations from QP order
    qpOrder.paperAllocations = [];
  }

  // Process new paper selections
  if (updateData.selectedPapers) {
    const paperRequirements = {
      paper1: parseFloat(qpOrder.actualPaperKG?.paper1?.totalKg || 0),
      paper2: parseFloat(qpOrder.actualPaperKG?.paper2?.totalKg || 0),
      paper3: parseFloat(qpOrder.actualPaperKG?.paper3?.totalKg || 0),
    };

    for (const [paperType, inventoryId] of Object.entries(
      updateData.selectedPapers
    )) {
      if (inventoryId && paperRequirements[paperType] > 0) {
        const inventoryItem = await Inventory.findById(inventoryId).session(
          session
        );
        if (!inventoryItem) {
          throw new Error(`Inventory item not found for ${paperType}`);
        }

        // Check if sufficient quantity is available
        const currentlyAllocated = inventoryItem.allocations
          .filter(
            (alloc) => alloc.qpOrder.toString() !== qpOrder._id.toString()
          )
          .reduce((sum, alloc) => sum + alloc.allocatedKg, 0);

        const availableKg = (inventoryItem.kg || 0) - currentlyAllocated;

        if (availableKg < paperRequirements[paperType]) {
          throw new Error(
            `Insufficient quantity in inventory for ${paperType}. Available: ${availableKg} KG, Required: ${paperRequirements[paperType]} KG`
          );
        }

        // Add allocation to inventory
        const allocation = {
          qpOrder: qpOrder._id,
          allocatedKg: paperRequirements[paperType],
          paperType: paperType,
          orderNo: qpOrder.orderNo,
          companyName: qpOrder.companyName?.companyName || "Unknown",
          allocatedAt: new Date(),
        };

        await Inventory.findByIdAndUpdate(
          inventoryId,
          {
            $push: { allocations: allocation },
          },
          { session }
        );

        // Add allocation to QP order
        qpOrder.paperAllocations.push({
          inventoryId: inventoryId,
          allocatedKg: paperRequirements[paperType],
          paperType: paperType,
          paperName: inventoryItem.paperName,
          paperMillName: inventoryItem.paperMillName,
          gsm: inventoryItem.gsm,
          deckal: inventoryItem.deckal,
        });
      }
    }
  }

  return qpOrder;
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

    if (
      req.body.selectedPapers &&
      (currentOrder?.selectedPapers?.paper1 === undefined ||
        currentOrder?.selectedPapers?.paper1 === null)
    ) {
      await handlePaperAllocations(currentOrder, req.body, session);
    }

    if (req.body.selectedPapers) {
      currentOrder.selectedPapers = req.body.selectedPapers;
    }

    // Update packaging option if provided
    let packagingOptionId = currentOrder.orderdata;
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

      packagingOptionId = packaging._id;
    }

    // Prepare update data
    const updateData = {
      ...req.body,
      orderdata: packagingOptionId,
    };

    // Remove paperAllocations from updateData as it's handled separately
    delete updateData.paperAllocations;

    // Update the order
    const qpOrder = await QpData.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
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
      .populate({
        path: "printer",
        select: "firstName lastName",
      })
      .populate({
        path: "binder",
        select: "firstName lastName",
      })
      .populate("kantan", "kantanName")
      .populate(
        "paperAllocations.inventoryId",
        "paperName paperMillName gsm deckal kg"
      );

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

    // Create outward inventory entries if status changed to completed
    if (statusChangedToCompleted) {
      await createOutwardInventoryEntries(qpOrder, session);
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
async function createPaperOutwardEntries(qpOrder, session) {
  if (!qpOrder.paperAllocations || qpOrder.paperAllocations.length === 0) {
    console.log("No paper allocations found for outward entries");
    return;
  }

  for (const allocation of qpOrder.paperAllocations) {
    // Only create outward if allocatedKg is greater than 0 and we have inventoryId
    if (allocation.allocatedKg > 0 && allocation.inventoryId) {
      try {
        // Get the source inventory to get paper details
        const sourceInventory = await Inventory.findById(
          allocation.inventoryId
        ).session(session);

        if (!sourceInventory) {
          console.log(
            `Source inventory not found for outward: ${allocation.inventoryId}`
          );
          continue;
        }

        const outwardPaper = new Inventory({
          category: "factory",
          type: "outward",
          inventoryType: "Paper",
          kg: allocation.allocatedKg,
          paperName: sourceInventory.paperName || allocation.paperName,
          paperMillName:
            sourceInventory.paperMillName || allocation.paperMillName,
          gsm: sourceInventory.gsm || allocation.gsm,
          deckal: sourceInventory.deckal || allocation.deckal,
          date: new Date(),
          qpOrder: qpOrder._id,
          qpPurchase: qpOrder._id,
          companyName: qpOrder.companyName,
          for: qpOrder.assignedTo,
          forCompany: qpOrder.createdBy,
          sourceInventory: allocation.inventoryId,
        });

        const savedOutward = await outwardPaper.save({ session });
        console.log(
          `Created outward entry for ${allocation.paperType}:`,
          savedOutward._id
        );
      } catch (error) {
        console.error(
          `Error creating outward entry for ${allocation.paperType}:`,
          error
        );
        // Continue with other allocations even if one fails
        continue;
      }
    }
  }
}
// Helper function to create outward inventory entries
async function createOutwardInventoryEntries(qpOrder, session) {
  const Inventory = mongoose.model("Inventory");
  console.log("function called", qpOrder, qpOrder.operatorPaperKG);
  // 🔹 Paper Outward - Use allocated papers
  if (qpOrder.operatorPaperKG) {
    const papers = ["paper1", "paper2", "paper3"];

    // First, remove old allocations
    await Inventory.updateMany(
      { "allocations.qpOrder": qpOrder._id },
      { $pull: { allocations: { qpOrder: qpOrder._id } } },
      { session }
    );
    console.log(`Removed old allocations for order ${qpOrder.orderNo}`);

    for (const paper of papers) {
      const paperData = qpOrder.operatorPaperKG[paper];
      const selectedPaperId = qpOrder.selectedPapers?.[paper];

      if (!paperData || !paperData.totalKg || !selectedPaperId) {
        console.log(`Skipping ${paper} - missing data or selection`);
        continue;
      }

      const requiredKg = parseFloat(paperData.totalKg);

      // ✅ Update allocation on selected inventory item
      const inventoryItem = await Inventory.findById(selectedPaperId).session(session);
      if (!inventoryItem) {
        console.log(`Inventory not found for ${paper}`);
        continue;
      }

      const newAllocation = {
        qpOrder: qpOrder._id,
        allocatedKg: requiredKg,
        paperType: paper,
        orderNo: qpOrder.orderNo,
        companyName: qpOrder.companyName?.companyName || qpOrder.companyName || "Unknown",
        allocatedAt: new Date(),
      };

      await Inventory.findByIdAndUpdate(
        inventoryItem._id,
        {
          $push: { allocations: newAllocation },
          $inc: { availableKg: -requiredKg }, // reduce stock
        },
        { session }
      );

      console.log(`Allocated ${requiredKg}KG from ${inventoryItem.paperName} for ${paper}`);

      // ✅ Create outward entry for paper usage
      const outwardPaper = new Inventory({
        category: "factory",
        type: "outward",
        inventoryType: "paper",
        paperName: inventoryItem.paperName,
        paperMillName: inventoryItem.paperMillName,
        gsm: inventoryItem.gsm,
        deckal: inventoryItem.deckal,
        kg: requiredKg,
        paperType: paper,
        qpOrder: qpOrder._id,
        qpPurchase: qpOrder._id,
        orderNo: qpOrder.orderNo,
        companyName: qpOrder.companyName,
        for: qpOrder.assignedTo,
        forCompany: qpOrder.createdBy,
        date: new Date(),
      });

      await outwardPaper.save({ session });
      console.log(`Created Paper Outward entry: ${paper} - ${requiredKg}KG`);
    }
  }

  // 🔹 Box Inward (with actualNoOfPieces)
  if (qpOrder.actualNoOfPieces) {
    const inwardBox = new Inventory({
      category: "factory",
      type: "inward",
      inventoryType: "Box",
      quantity: qpOrder.actualNoOfPieces,
      booked: qpOrder.booked || false,
      boxLength: qpOrder.orderdata?.length,
      boxWidth: qpOrder.orderdata?.width,
      boxHeight: qpOrder.orderdata?.height,
      p1gsm: qpOrder.actualPaperKG?.paper1,
      p2gsm: qpOrder.actualPaperKG?.paper2,
      p3gsm: qpOrder.actualPaperKG?.paper3,
      date: new Date(),
      qpPurchase: qpOrder._id,
      qpOrder: qpOrder._id,
      companyName: qpOrder.companyName,
      for: qpOrder.assignedTo,
      forCompany: qpOrder.createdBy,
    });

    await inwardBox.save({ session });
  }

  // 🔹 Box Outward (only noOfPieces)
  if (qpOrder.noOfPieces) {
    const outwardBox = new Inventory({
      category: "factory",
      type: "outward",
      inventoryType: "Box",
      quantity: qpOrder.noOfPieces,
      booked: qpOrder.booked || false,
      boxLength: qpOrder.orderdata?.length,
      boxWidth: qpOrder.orderdata?.width,
      boxHeight: qpOrder.orderdata?.height,
      p1gsm: qpOrder.actualPaperKG?.paper1,
      p2gsm: qpOrder.actualPaperKG?.paper2,
      p3gsm: qpOrder.actualPaperKG?.paper3,
      date: new Date(),
      qpOrder: qpOrder._id,
      qpPurchase: qpOrder._id,
      companyName: qpOrder.companyName,
      for: qpOrder.assignedTo,
      forCompany: qpOrder.createdBy,
    });

    await outwardBox.save({ session });
  }

  // 🔹 Paper Outward - Use allocated papers
  if (qpOrder.operatorPaperKG && qpOrder.operatorPaperKG.paper1 !== "") {
    const papers = ["paper1", "paper2", "paper3"];

    // First, remove all existing allocations for this QP order from all inventory items
    await Inventory.updateMany(
      {
        "allocations.qpOrder": qpOrder._id,
      },
      {
        $pull: { allocations: { qpOrder: qpOrder._id } },
      },
      { session }
    );
    console.log(
      `Removed all existing allocations for order ${qpOrder.orderNo}`
    );

    // Now add new allocations based on selectedPapers and operatorPaperKG
    for (const paper of papers) {
      // Skip if this paper type doesn't exist or has no totalKg
      if (
        !qpOrder.operatorPaperKG[paper] ||
        !qpOrder.operatorPaperKG[paper].totalKg
      ) {
        console.log(`Skipping ${paper} - no data in operatorPaperKG`);
        continue;
      }

      const requiredKg = parseFloat(qpOrder.operatorPaperKG[paper].totalKg);
      const selectedPaperId = qpOrder.selectedPapers?.[paper];

      if (!selectedPaperId) {
        console.log(`No selected paper found for ${paper}`);
        continue;
      }

      // Get the inventory item
      const inventoryItem = await Inventory.findById(selectedPaperId).session(
        session
      );

      if (!inventoryItem) {
        console.log(`Inventory item not found for ${paper}:`, selectedPaperId);
        continue;
      }

      // Create new allocation
      const newAllocation = {
        qpOrder: qpOrder._id,
        allocatedKg: requiredKg,
        paperType: paper,
        orderNo: qpOrder.orderNo,
        companyName:
          qpOrder.companyName?.companyName || qpOrder.companyName || "Unknown",
        allocatedAt: new Date(),
      };

      // Add new allocation to the inventory item
      const updatedAllocations = [...inventoryItem.allocations, newAllocation];
      const totalAllocated = updatedAllocations.reduce(
        (sum, alloc) => sum + alloc.allocatedKg,
        0
      );
      const availableKg = Math.max(0, (inventoryItem.kg || 0) - totalAllocated);

      // Update the inventory item
      await Inventory.findByIdAndUpdate(
        inventoryItem._id,
        {
          allocations: updatedAllocations,
          availableKg: availableKg,
        },
        { session }
      );

      console.log(`Added allocation for ${paper}: ${requiredKg}KG`);
    }

    // Create outward inventory entries
    await createPaperOutwardEntries(qpOrder, session);
  }

  // 🔹 Kantan Outward
  if (qpOrder.kantan && qpOrder.actualTotalKantan?.reel) {
    const outwardKantan = new Inventory({
      category: "factory",
      type: "outward",
      inventoryType: "Kantan",
      reel: convertToReels(
        qpOrder.actualTotalKantan.reel,
        qpOrder.actualTotalKantan.inch
      ),
      kantan: qpOrder.kantan,
      vendor: qpOrder.vendor,
      date: new Date(),
      qpOrder: qpOrder._id,
      qpPurchase: qpOrder._id,
      companyName: qpOrder.companyName,
      for: qpOrder.assignedTo,
      forCompany: qpOrder.createdBy,
    });
    await outwardKantan.save({ session });
  }

  // 🔹 Glue Outward
  if (qpOrder.glue && qpOrder.glue.trim() !== "") {
    const outwardGlue = new Inventory({
      category: "factory",
      type: "outward",
      inventoryType: "Glue",
      kg: qpOrder.glue,
      vendor: qpOrder.vendor,
      date: new Date(),
      qpOrder: qpOrder._id,
      qpPurchase: qpOrder._id,
      companyName: qpOrder.companyName,
      for: qpOrder.assignedTo,
      forCompany: qpOrder.createdBy,
    });
    await outwardGlue.save({ session });
  }

  // 🔹 Wire Outward
  if (qpOrder.wire && qpOrder.wire.trim() !== "") {
    const outwardWire = new Inventory({
      category: "factory",
      type: "outward",
      inventoryType: "Wire",
      kg: qpOrder.wire,
      vendor: qpOrder.vendor,
      date: new Date(),
      qpOrder: qpOrder._id,
      qpPurchase: qpOrder._id,
      companyName: qpOrder.companyName,
      for: qpOrder.assignedTo,
      forCompany: qpOrder.createdBy,
    });
    await outwardWire.save({ session });
  }
}

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
      // .populate({
      //   path: "party",
      //   select:
      //     "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
      // })
      .populate({
        path: "party",
        select: "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
        // match: partyMatch,
        populate: [
          { path: "address.marketName", model: "Market", select: "marketName" },
          // { path: "address.streetAddress", model: "Market", select: "streetAddress" },
          { path: "address.landMark", model: "Market", select: "landmark" },
          { path: "address.area", model: "Market", select: "area" },
          { path: "address.pincode", model: "Market", select: "pincode" },
        ]
      })
      .populate(
        "orderdata",
        "party ply length width height deckal paper1GSM paper2GSM paper3GSM"
      )
      .populate({
        path: "printer",
        select: "firstName lastName", // Add printer name population
      })
      .populate({
        path: "binder",
        select: "firstName lastName", // Add binder name population
      })
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
// exports.updateQpOrderStatus = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { status } = req.body;
//     const { id } = req.params;

//     // Get the current order
//     const currentOrder = await QpData.findById(id).session(session);
//     if (!currentOrder) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({
//         success: false,
//         message: "QP Order not found",
//       });
//     }

//     // Update the status
//     const updatedOrder = await QpData.findByIdAndUpdate(
//       id,
//       { status },
//       {
//         new: true,
//         runValidators: true,
//         session,
//       }
//     )
//       .populate({
//         path: "companyName",
//         select: "companyName avatar",
//       })
//       .populate({
//         path: "party",
//         select:
//           "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
//       })
//       .populate(
//         "orderdata",
//         "party ply length width height deckal paper1GSM paper2GSM paper3GSM"
//       )
//       .populate({
//         path: "printer",
//         select: "firstName lastName", // Add printer name population
//       })
//       .populate({
//         path: "binder",
//         select: "firstName lastName", // Add binder name population
//       })
//       .populate("kantan", "kantanName");

//     // Check if status changed to "completed"
//     const statusChangedToCompleted =
//       status === "Completed" && currentOrder.status !== "Completed";

//     // Create outward inventory entry if status changed to completed
//     if (statusChangedToCompleted) {
//       const outwardInventory = new Inventory({
//         category: "factory", // Adjust category as needed
//         type: "outward",
//         material: updatedOrder.paperName || undefined,
//         quantity: updatedOrder.quantity || 1,
//         kg: updatedOrder.weight || undefined,
//         reel: updatedOrder.reel || undefined,
//         vendor: updatedOrder.vendor || undefined,
//         date: new Date(),
//         qpOrder: updatedOrder._id,
//         companyName: updatedOrder.companyName,
//         kantan: updatedOrder.kantan || undefined,
//         paperName: updatedOrder.paperName || undefined,
//         deckal: updatedOrder.deckal || undefined,
//         gsm: updatedOrder.gsm || undefined,
//         for: updatedOrder.assignedTo || undefined,
//         forCompany: updatedOrder.createdBy || undefined,
//         remarks: `Outward entry for completed QP order ${
//           updatedOrder.orderNumber || updatedOrder._id
//         }`,
//       });

//       await outwardInventory.save({ session });
//     }

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message: "QP Order status updated successfully",
//       data: updatedOrder,
//       outwardCreated: statusChangedToCompleted,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("❌ Error updating QP order status:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update QP order status",
//       error: error.message,
//     });
//   }
// };

exports.updateQPOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { status, deliveryStatus, billPhotos } = req.body;
    const driverId = req.user?.id; // driver from auth middleware
    const currentTime = new Date();

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, message: "Invalid order ID" });
    }

    const currentOrder = await QpData.findById(orderId).session(session);
    if (!currentOrder) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, message: "QP Order not found" });
    }

    const updateData = {};

    // Assign driver if not already assigned
    if (driverId && !currentOrder.driver) updateData.driver = driverId;

    // Handle status
    if (status) {
      const validStatuses = [
        "pending",
        "in_progress",
        "completed",
        "loading",
        "going_to_delivery",
        "delivered",
      ];
      if (!validStatuses.includes(status)) throw new Error("Invalid status");

      switch (status) {
        case "loading":
          updateData.loadingStartDate = currentTime;
          updateData.deliveryStatus = "loading";
          break;
        case "going_to_delivery":
          if (!billPhotos || !billPhotos.length) {
            throw new Error("Bill photo required for dispatch");
          }
          updateData.deliveryStartTime = currentTime;
          // updateData.loadingEndDate = currentTime;
          updateData.deliveryStatus = "in_transit";
          updateData.dispatchTime = currentTime; // capture dispatch time
          updateData.billPhotos = billPhotos.map((p) => ({
            url: p.url,
            filename: p.filename || `bill_${Date.now()}`,
          }));
          break;
        case "delivered":
          updateData.deliveryEndTime = currentTime;
          updateData.deliveredAt = currentTime;
          updateData.deliveryStatus = "delivered";
          break;
      }
    }

    // Handle deliveryStatus override
    if (deliveryStatus) updateData.deliveryStatus = deliveryStatus;

    const updatedOrder = await QpData.findByIdAndUpdate(orderId, updateData, {
      new: true,
      runValidators: true,
      session,
    })
      .populate("companyName", "companyName avatar")
      .populate(
        "party",
        "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo"
      )
      .populate(
        "orderdata",
        "party ply length width height deckal paper1GSM paper2GSM paper3GSM"
      )
      .populate("kantan", "kantanName")
      .populate("driver", "firstName lastName email");

    await session.commitTransaction();
    session.endSession();

    res
      .status(200)
      .json({ success: true, message: "QP Order updated", data: updatedOrder });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to update order",
    });
  }
};

// Controller for bulk status updates
exports.bulkUpdateQPOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderIds, deliveryStatus, billPhotos, dispatchPhotos, dispatchTime, deliveryTime } = req.body;
    const driverId = req.user?.id;
    const currentTime = new Date();

    if (!orderIds || !orderIds.length) throw new Error("Order IDs required");

    // Check conflicting driver assignments
    const conflictingOrders = await QpData.find({
      _id: { $in: orderIds },
      driver: { $exists: true, $ne: null, $ne: driverId },
    }).session(session);

    if (conflictingOrders.length > 0)
      throw new Error("Some orders are assigned to another driver");

    const updateData = {};
    if (driverId) updateData.driver = driverId;


    const driver = await Staff.findById(driverId).session(session);
    if (!driver) throw new Error("Driver not found");

    // Status handling
    if (deliveryStatus) {
      switch (deliveryStatus) {
        case "loading":
          if (driver.isDisptach) {
            throw new Error("You already have an ongoing dispatch. Complete delivery before loading new orders.");
          }
          const driverData = await Staff.findById(driverId).session(session);
          if (driverData) {
            const updatedOrders = [...driverData.orders, ...orderIds];
            await Staff.findByIdAndUpdate(
              driverId,
              { orders: updatedOrders },
              { session }
            );
          }
          updateData.loadingStartDate = currentTime;
          updateData.deliveryStatus = "loading";
          break;
        case "in_transit":
          if (!dispatchPhotos || !dispatchPhotos.length)
            throw new Error("Dispatch photos required for dispatch");
          updateData.deliveryStartTime = currentTime;
          updateData.loadingEndDate = currentTime;
          updateData.deliveryStatus = "in_transit";
          updateData.dispatchTime = dispatchTime || currentTime;
          // Store dispatch photo
          updateData.dispatchPhoto = dispatchPhotos[0];
          await Staff.findByIdAndUpdate(driverId, { isDisptach: true }, { session });
          break;
        case "delivered":
          if (!billPhotos || !billPhotos.length)
            throw new Error("Bill photos required for delivery");
          updateData.deliveryEndTime = currentTime;
          updateData.deliveredAt = currentTime;
          updateData.deliveryStatus = "delivered";
          updateData.deliveryTime = deliveryTime || currentTime;
          // Store bill photo
          updateData.billPhoto = billPhotos[0];
          // const remainingInTransit = await QpData.countDocuments({
          //   driver: driverId,
          //   deliveryStatus: "in_transit",
          //   _id: { $nin: orderIds },
          // }).session(session);
          // console.log("DEBUG : remainingInTransit:", remainingInTransit);


          // if (remainingInTransit === 0) {
          //   await Staff.findByIdAndUpdate(driverId, { isDisptach: false }, { session });
          // }
          break;
      }
    }

    // DeliveryStatus override
    if (deliveryStatus) updateData.deliveryStatus = deliveryStatus;

    // Bulk update
    await QpData.updateMany({ _id: { $in: orderIds } }, updateData, {
      session,
    });

    const updatedOrders = await QpData.find({ _id: { $in: orderIds } })
      .populate("companyName", "companyName avatar")
      .populate("party", "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo")
      .populate("orderdata", "party ply length width height deckal paper1GSM paper2GSM paper3GSM")
      .populate("kantan", "kantanName")
      .populate("driver", "firstName lastName email isDisptach")
      .session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: `Updated ${updatedOrders.length} orders successfully`,
      data: updatedOrders,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to update orders",
    });
  }
};

// Helper function to get available papers with allocations
exports.getAvailablePapers = async (req, res) => {
  try {
    const Inventory = mongoose.model("Inventory");
    const { gsm, deckal, requiredKg } = req.query;

    const papers = await Inventory.find({
      inventoryType: "Paper",
      type: "inward",
      gsm: gsm,
      deckal: deckal,
      $or: [{ qpOrder: { $exists: false } }, { qpOrder: null }],
    }).populate("allocations.qpOrder", "orderNo companyName");

    const availablePapers = papers.map((paper) => {
      const totalAllocated = paper.allocations.reduce(
        (sum, alloc) => sum + alloc.allocatedKg,
        0
      );
      const availableKg = (paper.kg || 0) - totalAllocated;

      return {
        _id: paper._id,
        paperName: paper.paperName,
        paperMillName: paper.paperMillName,
        gsm: paper.gsm,
        deckal: paper.deckal,
        totalKg: paper.kg,
        allocatedKg: totalAllocated,
        availableKg: availableKg,
        isSufficient: availableKg >= parseFloat(requiredKg || 0),
        allocations: paper.allocations.map((alloc) => ({
          orderNo: alloc.qpOrder?.orderNo,
          companyName: alloc.qpOrder?.companyName,
          allocatedKg: alloc.allocatedKg,
          paperType: alloc.paperType,
          allocatedAt: alloc.allocatedAt,
        })),
      };
    });

    res.status(200).json({
      success: true,
      data: availablePapers,
    });
  } catch (error) {
    console.error("Error fetching available papers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available papers",
      error: error.message,
    });
  }
};
