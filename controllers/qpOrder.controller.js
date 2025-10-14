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
        select:
          "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
        // match: partyMatch,
        populate: [
          { path: "address.marketName", model: "Market", select: "marketName" },
          // { path: "address.streetAddress", model: "Market", select: "streetAddress" },
          { path: "address.landMark", model: "Market", select: "landmark" },
          { path: "address.area", model: "Market", select: "area" },
          { path: "address.pincode", model: "Market", select: "pincode" },
        ],
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
        path: "designer",
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
        select:
          "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
        // match: partyMatch,
        populate: [
          { path: "address.marketName", model: "Market", select: "marketName" },
          // { path: "address.streetAddress", model: "Market", select: "streetAddress" },
          { path: "address.landMark", model: "Market", select: "landmark" },
          { path: "address.area", model: "Market", select: "area" },
          { path: "address.pincode", model: "Market", select: "pincode" },
        ],
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
        path: "designer",
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

  // 🩹 Normalize and clean up selectedPapers input
  if (updateData.selectedPapers) {
    for (const paperType of Object.keys(updateData.selectedPapers)) {
      // Convert frontend paperId to inventoryId and ensure proper format
      updateData.selectedPapers[paperType] = updateData.selectedPapers[
        paperType
      ]
        .map((alloc) => ({
          inventoryId: alloc.inventoryId || alloc.paperId, // support both
          allocatedKg: Number(alloc.allocatedKg) || 0,
          paperType: paperType, // Add paperType for clarity
        }))
        .filter((alloc) => alloc.inventoryId); // Only keep valid allocations with inventoryId
    }
  }

  // 🧠 First, remove any existing allocations for this order to avoid duplicates
  await Inventory.updateMany(
    { "allocations.qpOrder": qpOrder._id },
    { $pull: { allocations: { qpOrder: qpOrder._id } } },
    { session }
  );

  // 🧠 Iterate over each paper type and update inventories
  for (const paperType of Object.keys(updateData.selectedPapers || {})) {
    const allocations = updateData.selectedPapers[paperType];

    for (const allocation of allocations) {
      if (!allocation.inventoryId) {
        console.warn(`⚠️ Skipping ${paperType}: missing inventoryId`);
        continue;
      }

      if (allocation.allocatedKg <= 0) {
        continue;
      }

      const inventoryItem = await Inventory.findOne({
        inventoryType: "paper",
        _id: allocation.inventoryId,
      }).session(session);

      if (!inventoryItem) {
        console.warn(`⚠️ Inventory not found for ${allocation.inventoryId}`);
        continue;
      }

      // Check if there's enough available quantity
      const currentlyAllocated = inventoryItem.allocations
        .filter((alloc) => alloc.qpOrder.toString() !== qpOrder._id.toString())
        .reduce((sum, alloc) => sum + alloc.allocatedKg, 0);

      const availableKg = (inventoryItem.kg || 0) - currentlyAllocated;

      if (availableKg < allocation.allocatedKg) {
        console.warn(
          `⚠️ Insufficient quantity in ${inventoryItem.paperName}. Available: ${availableKg}KG, Required: ${allocation.allocatedKg}KG`
        );
        // You might want to adjust the allocation or throw an error here
        continue;
      }

      // ➕ Add new allocation
      const newAllocation = {
        qpOrder: qpOrder._id,
        paperType: paperType,
        allocatedKg: allocation.allocatedKg,
        allocatedAt: new Date(),
      };

      await Inventory.findByIdAndUpdate(
        allocation.inventoryId,
        {
          $push: { allocations: newAllocation },
        },
        { session }
      );

    }
  }
}

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

    // Handle status update and process completion flags
    if (
      req.body.status ||
      req.body.paperCuttingDone !== undefined ||
      req.body.corrugationDone !== undefined ||
      req.body.pastingDone !== undefined ||
      req.body.rotaryDone !== undefined ||
      req.body.slottingDone !== undefined ||
      req.body.printingDone !== undefined ||
      req.body.manualPastingDone !== undefined ||
      req.body.pinningDone !== undefined ||
      req.body.punchingDone !== undefined
    ) {
      const now = new Date();

      // Build update object
      const updateData = {
        ...req.body,
        lastStatusChangeDate: now,
      };

      // Add status if provided
      if (req.body.status) {
        updateData.status = req.body.status;

        // Add to status history
        updateData.$push = {
          statusHistory: {
            status: req.body.status,
            changedAt: now,
            changedBy: req.user?._id || null,
          },
        };
      }

      // Add all process completion flags if provided
      const processFlags = [
        "paperCuttingDone",
        "corrugationDone",
        "pastingDone",
        "rotaryDone",
        "slottingDone",
        "printingDone",
        "manualPastingDone",
        "pinningDone",
        "punchingDone",
      ];

      processFlags.forEach((flag) => {
        if (req.body[flag] !== undefined) {
          updateData[flag] = req.body[flag];
        }
      });

      console.log(updateData,'uiguiguguiguig')
      const updatedOrder = await QpData.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, session }
      ).populate([
        {
          path: "companyName",
          select: "companyName avatar",
        },
        {
          path: "party",
          select:
            "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
        },
        {
          path: "orderdata",
          select:
            "party ply length width height deckal paper1GSM paper2GSM paper3GSM",
        },
        {
          path: "printer",
          select: "firstName lastName",
        },
        {
          path: "designer",
          select: "firstName lastName",
        },
        {
          path: "binder",
          select: "firstName lastName",
        },
        {
          path: "kantan",
          select: "kantanName",
        },
        {
          path: "paperAllocations.inventoryId",
          select: "paperName paperMillName gsm deckal kg",
        },
      ]);

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: "Order updated successfully",
        data: updatedOrder,
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

    // 🟢 ALWAYS process paper allocations if selectedPapers is provided in the request
    if (
      req.body.selectedPapers &&
      req.body.selectedPapers.paper1.length > 0 &&
      (currentOrder.selectedPapers?.paper1?.length === undefined ||
        currentOrder.selectedPapers?.paper1?.length === null ||
        currentOrder.selectedPapers?.paper1?.length === 0)
    ) {
      await handlePaperAllocations(currentOrder, req.body, session);
    } else {
      console.log(
        "ℹ️ No selectedPapers in request, skipping allocation processing"
      );
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
    console.log(updateData,'updateData')
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
        path: "designer",
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
        message: "QP Order not found after update",
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

// Helper function to convert reels to inches
function convertToReels(reels = 0, inches = 0) {
  const totalInches = Number(reels) * 7200 + Number(inches);
  const totalReels = totalInches / 7200;
  return parseFloat(totalReels.toFixed(3));
}

// 🧮 Helper: calculate paper requirements
function calculateActualPaperRequirements(orderData, actualNoOfPieces) {
  if (!orderData) return { paper1: 0, paper2: 0, paper3: 0 };

  const length = parseFloat(orderData.length) || 0;
  const width = parseFloat(orderData.width) || 0;
  const height = parseFloat(orderData.height) || 0;
  const deckal = parseFloat(orderData.deckal) || 0;
  const p1 = parseFloat(orderData.paper1GSM) || 0;
  const p2 = parseFloat(orderData.paper2GSM) || 0;
  const p3 = parseFloat(orderData.paper3GSM) || 0;

  if (!length || !width || !height || !deckal)
    return { paper1: 0, paper2: 0, paper3: 0 };

  const surfaceArea = 2 * (length * width + length * height + width * height);
  const totalArea = surfaceArea * actualNoOfPieces;
  const deckalArea = deckal * 1000;
  const deckalSheets = totalArea / deckalArea;
  const areaM2 = (deckalSheets * deckalArea) / 10000;

  return {
    paper1: parseFloat(((areaM2 * p1) / 1000).toFixed(2)),
    paper2: parseFloat(((areaM2 * p2) / 1000).toFixed(2)),
    paper3: parseFloat(((areaM2 * p3) / 1000).toFixed(2)),
  };
}

// 🏭 Main function: create outward inventory entries
async function createOutwardInventoryEntries(qpOrder, session) {
  const Inventory = mongoose.model("Inventory");

  const actualNoOfPieces = qpOrder.actualNoOfPieces || qpOrder.noOfPieces;
  const actualPaperRequirements = calculateActualPaperRequirements(
    qpOrder.orderdata,
    actualNoOfPieces
  );

  const papers = ["paper1", "paper2", "paper3"];
  const totalActualUsage = { paper1: 0, paper2: 0, paper3: 0 };

  // 🧹 Step 1: remove old allocations for this order
  await Inventory.updateMany(
    { "allocations.qpOrder": qpOrder._id },
    { $pull: { allocations: { qpOrder: qpOrder._id } } },
    { session }
  );

  // 🧾 Step 2: handle paper outwards
  for (const paperType of papers) {
    const allocations = qpOrder.selectedPapers?.[paperType] || [];
    const requiredKg = actualPaperRequirements[paperType];

    if (!allocations.length || requiredKg <= 0) {
      continue;
    }

    const sorted = allocations.sort(
      (a, b) => (a.allocatedKg || 0) - (b.allocatedKg || 0)
    );
    let remaining = requiredKg;

    for (const allocation of sorted) {
      const inventoryItem = await Inventory.findById(
        allocation.paperId
      ).session(session);

      if (!inventoryItem) {
        console.warn(
          `❌ Inventory item not found for ${paperType} (${allocation.paperId})`
        );
        await new Inventory({
          category: "factory",
          type: "outward",
          inventoryType: "paper",
          paperType,
          qpOrder: qpOrder._id,
          orderNo: qpOrder.orderNo,
          companyName: qpOrder.companyName,
          for: qpOrder.assignedTo,
          forCompany: qpOrder.createdBy,
          kg: allocation.allocatedKg,
          date: new Date(),
          note: "Inventory not found for outward",
        }).save({ session });
        continue;
      }

      const alreadyAllocated = inventoryItem.allocations
        .filter((a) => a.qpOrder.toString() !== qpOrder._id.toString())
        .reduce((sum, a) => sum + (a.allocatedKg || 0), 0);

      const availableKg = (inventoryItem.kg || 0) - alreadyAllocated;
      const useKg = Math.min(
        allocation.allocatedKg || 0,
        availableKg,
        remaining
      );

      // Save outward entry
      await new Inventory({
        category: "factory",
        type: "outward",
        inventoryType: "paper",
        paperType,
        paperName: inventoryItem.paperName,
        paperMillName: inventoryItem.paperMillName,
        gsm: inventoryItem.gsm,
        deckal: inventoryItem.deckal,
        kg: useKg,
        qpOrder: qpOrder._id,
        qpPurchase: qpOrder._id,
        orderNo: qpOrder.orderNo,
        companyName: qpOrder.companyName,
        for: qpOrder.assignedTo,
        forCompany: qpOrder.createdBy,
        date: new Date(),
        note: useKg ? undefined : "Selected but not used",
      }).save({ session });

      if (useKg > 0) {
        const newAlloc = {
          qpOrder: qpOrder._id,
          allocatedKg: useKg,
          paperType,
          orderNo: qpOrder.orderNo,
          companyName:
            qpOrder.companyName?.companyName ||
            qpOrder.companyName ||
            "Unknown",
          allocatedAt: new Date(),
        };

        await Inventory.findByIdAndUpdate(
          inventoryItem._id,
          { $push: { allocations: newAlloc }, $inc: { availableKg: -useKg } },
          { session }
        );

        remaining -= useKg;
        totalActualUsage[paperType] += useKg;
      }
    }

    if (remaining > 0)
      console.warn(`⚠️ ${paperType} shortage: ${remaining} KG`);
  }

  // 🧾 Step 3: update QP order with usage data
  await QpData.findByIdAndUpdate(
    qpOrder._id,
    {
      $set: {
        actualPaperKG: {
          paper1: {
            deckal: qpOrder.orderdata.deckal,
            gsm: qpOrder.orderdata.paper1GSM,
            totalKg: totalActualUsage.paper1.toFixed(2),
          },
          paper2: {
            deckal: qpOrder.orderdata.deckal,
            gsm: qpOrder.orderdata.paper2GSM,
            totalKg: totalActualUsage.paper2.toFixed(2),
          },
          paper3: {
            deckal: qpOrder.orderdata.deckal,
            gsm: qpOrder.orderdata.paper3GSM,
            totalKg: totalActualUsage.paper3.toFixed(2),
          },
        },
        actualTotalKg: (
          totalActualUsage.paper1 +
          totalActualUsage.paper2 +
          totalActualUsage.paper3
        ).toFixed(2),
      },
    },
    { session }
  );

  // 🧱 Step 4: Box inward
  if (qpOrder.actualNoOfPieces) {
    await new Inventory({
      category: "factory",
      type: "inward",
      inventoryType: "Box",
      quantity: qpOrder.actualNoOfPieces,
      boxLength: qpOrder.orderdata.length,
      boxWidth: qpOrder.orderdata.width,
      boxHeight: qpOrder.orderdata.height,
      date: new Date(),
      qpOrder: qpOrder._id,
      qpPurchase: qpOrder._id,
      companyName: qpOrder.companyName,
      for: qpOrder.assignedTo,
      forCompany: qpOrder.createdBy,
    }).save({ session });
  }

  // 📦 Step 5: Box outward
  if (qpOrder.noOfPieces) {
    await new Inventory({
      category: "factory",
      type: "outward",
      inventoryType: "Box",
      quantity: qpOrder.noOfPieces,
      boxLength: qpOrder.orderdata.length,
      boxWidth: qpOrder.orderdata.width,
      boxHeight: qpOrder.orderdata.height,
      date: new Date(),
      qpOrder: qpOrder._id,
      qpPurchase: qpOrder._id,
      companyName: qpOrder.companyName,
      for: qpOrder.assignedTo,
      forCompany: qpOrder.createdBy,
    }).save({ session });
  }

  // 🧪 Step 6: Kantan, Glue, Wire outward
  const extras = [
    { key: "kantan", type: "Kantan", field: "reel" },
    { key: "glue", type: "Glue", field: "kg" },
    { key: "wire", type: "Wire", field: "kg" },
  ];

  for (const e of extras) {
    const val = qpOrder[e.key];
    if (!val) continue;

    const outward = new Inventory({
      category: "factory",
      type: "outward",
      inventoryType: e.type,
      [e.field]: parseFloat(val) || 0,
      date: new Date(),
      qpOrder: qpOrder._id,
      qpPurchase: qpOrder._id,
      companyName: qpOrder.companyName,
      for: qpOrder.assignedTo,
      forCompany: qpOrder.createdBy,
    });
    await outward.save({ session });
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
        select:
          "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
        // match: partyMatch,
        populate: [
          { path: "address.marketName", model: "Market", select: "marketName" },
          // { path: "address.streetAddress", model: "Market", select: "streetAddress" },
          { path: "address.landMark", model: "Market", select: "landmark" },
          { path: "address.area", model: "Market", select: "area" },
          { path: "address.pincode", model: "Market", select: "pincode" },
        ],
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
        path: "designer",
        select: "firstName lastName", // Add printer name population
      })
      .populate({
        path: "binder",
        select: "firstName lastName", // Add binder name population
      })
      .populate("kantan", "kantanName")
      .sort({ createdAt: -1 });

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
    const {
      orderIds,
      deliveryStatus,
      billPhotos,
      dispatchPhotos,
      dispatchTime,
      deliveryTime,
    } = req.body;
    const driverId = req.user?.id;
    const currentTime = new Date();

    if (!orderIds || !orderIds.length) throw new Error("Order IDs required");

    // Check conflicting driver assignments
    const conflictingOrders = await QpData.find({
      _id: { $in: orderIds },
      driver: {
        $nin: [null, driverId], // driver should not be null AND not be current driverId
      },
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
            throw new Error(
              "You already have an ongoing dispatch. Complete delivery before loading new orders."
            );
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
          await Staff.findByIdAndUpdate(
            driverId,
            { isDisptach: true },
            { session }
          );
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
      .populate(
        "party",
        "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo"
      )
      .populate(
        "orderdata",
        "party ply length width height deckal paper1GSM paper2GSM paper3GSM"
      )
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

exports.removeLoadingOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.body;
    const driverId = req.user?.id;

    if (!orderId) {
      throw new Error("Order ID is required");
    }
    if (!driverId) {
      throw new Error("Driver not authenticated");
    }

    // Find driver
    const driver = await Staff.findById(driverId).session(session);
    if (!driver) throw new Error("Driver not found");

    // Remove order from driver's assigned orders
    const updatedOrders = driver.orders.filter(
      (id) => id.toString() !== orderId
    );
    await Staff.findByIdAndUpdate(
      driverId,
      { orders: updatedOrders },
      { session }
    );

    // Reset order details
    await QpData.findByIdAndUpdate(
      orderId,
      {
        $set: {
          driver: null,
          deliveryStatus: "not_started",
          loadingStartDate: null,
          loadingEndDate: null,
        },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Order removed from loading successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Remove loading error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to remove loading",
    });
  }
};
