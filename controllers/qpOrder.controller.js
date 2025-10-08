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

  console.log("🔄 Processing paper allocations for order:", qpOrder.orderNo);
  console.log(
    "📦 Incoming selectedPapers:",
    JSON.stringify(updateData.selectedPapers, null, 2)
  );

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

  // 🔍 For debugging
  console.log("✅ Normalized paper allocations:", updateData.selectedPapers);

  // 🧠 First, remove any existing allocations for this order to avoid duplicates
  await Inventory.updateMany(
    { "allocations.qpOrder": qpOrder._id },
    { $pull: { allocations: { qpOrder: qpOrder._id } } },
    { session }
  );
  console.log("🧹 Cleared existing allocations for order:", qpOrder.orderNo);

  // 🧠 Iterate over each paper type and update inventories
  for (const paperType of Object.keys(updateData.selectedPapers || {})) {
    const allocations = updateData.selectedPapers[paperType];

    for (const allocation of allocations) {
      if (!allocation.inventoryId) {
        console.warn(`⚠️ Skipping ${paperType}: missing inventoryId`);
        continue;
      }

      if (allocation.allocatedKg <= 0) {
        console.log(
          `ℹ️ Skipping ${paperType} with zero allocation for inventory:`,
          allocation.inventoryId
        );
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

      console.log(
        `✅ Allocated ${allocation.allocatedKg}KG from ${inventoryItem.paperName} for ${paperType}`
      );
    }
  }

  console.log("✅ Paper allocations updated successfully");
}

// Also, let's update the updateQpOrder function to log the incoming request body
exports.updateQpOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("🔄 Updating QP Order with ID:", req.params.id);
    console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

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

    console.log("📋 Current order:", currentOrder.orderNo);
    console.log("📊 Current selectedPapers:", currentOrder.selectedPapers);

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
    // Remove the condition that was preventing allocations from being processed
    if (
      req.body.selectedPapers &&
      req.body.selectedPapers.paper1.length > 0 &&
      (currentOrder.selectedPapers?.paper1?.length === undefined ||
        currentOrder.selectedPapers?.paper1?.length === null ||
        currentOrder.selectedPapers?.paper1?.length === 0)
    ) {
      console.log("📄 Processing paper allocations from request...");
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

    console.log("💾 Final update data:", JSON.stringify(updateData, null, 2));

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
        message: "QP Order not found after update",
      });
    }

    console.log("✅ Order updated successfully:", qpOrder.orderNo);

    // Check if status changed to "completed"
    const statusChangedToCompleted =
      req.body.status === "Completed" && currentOrder.status !== "Completed";

    console.log(`🔄 Status changed to completed: ${statusChangedToCompleted}`);

    // Create outward inventory entries if status changed to completed
    if (statusChangedToCompleted) {
      console.log(
        "🏭 Creating outward inventory entries for completed order..."
      );
      await createOutwardInventoryEntries(qpOrder, session);
    }

    await session.commitTransaction();
    session.endSession();

    console.log("🎉 Transaction committed successfully");

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
  console.log(
    "🚀 Creating outward inventory entries for order:",
    qpOrder.orderNo
  );

  const actualNoOfPieces = qpOrder.actualNoOfPieces || qpOrder.noOfPieces;
  const actualPaperRequirements = calculateActualPaperRequirements(
    qpOrder.orderdata,
    actualNoOfPieces
  );
  console.log("📊 Actual Paper Requirements:", actualPaperRequirements);

  const papers = ["paper1", "paper2", "paper3"];
  const totalActualUsage = { paper1: 0, paper2: 0, paper3: 0 };

  // 🧹 Step 1: remove old allocations for this order
  await Inventory.updateMany(
    { "allocations.qpOrder": qpOrder._id },
    { $pull: { allocations: { qpOrder: qpOrder._id } } },
    { session }
  );
  console.log(`🧹 Removed old allocations for order ${qpOrder.orderNo}`);

  // 🧾 Step 2: handle paper outwards
  for (const paperType of papers) {
    const allocations = qpOrder.selectedPapers?.[paperType] || [];
    const requiredKg = actualPaperRequirements[paperType];

    if (!allocations.length || requiredKg <= 0) {
      console.log(`⚠️ Skipping ${paperType} — no selection or no requirement.`);
      continue;
    }

    console.log(`🔹 Processing ${paperType} (requirement: ${requiredKg} KG)`);

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

      console.log(
        `📦 Using ${useKg} KG from ${inventoryItem.paperName} (${availableKg} available)`
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
  console.log("✅ Updated QpOrder with actual usage data");

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
    console.log(`📥 Box Inward: ${qpOrder.actualNoOfPieces} boxes`);
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
    console.log(`📤 Box Outward: ${qpOrder.noOfPieces} boxes`);
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
    console.log(`📦 Created ${e.type} outward (${val})`);
  }

  console.log("🎯 Completed outward inventory entries for:", qpOrder.orderNo);
}

// function calculateActualPaperRequirements(orderData, actualNoOfPieces) {
//   if (!orderData) {
//     console.warn("⚠️ No order data provided for paper calculation");
//     return { paper1: 0, paper2: 0, paper3: 0 };
//   }

//   const length = parseFloat(orderData.length) || 0;
//   const width = parseFloat(orderData.width) || 0;
//   const height = parseFloat(orderData.height) || 0;
//   const deckal = parseFloat(orderData.deckal) || 0;
//   const paper1GSM = parseFloat(orderData.paper1GSM) || 0;
//   const paper2GSM = parseFloat(orderData.paper2GSM) || 0;
//   const paper3GSM = parseFloat(orderData.paper3GSM) || 0;

//   if (length === 0 || width === 0 || height === 0 || deckal === 0) {
//     console.warn("⚠️ Invalid dimensions for paper calculation");
//     return { paper1: 0, paper2: 0, paper3: 0 };
//   }

//   // Calculate total surface area in cm²
//   const surfaceAreaPerBox =
//     2 * (length * width + length * height + width * height);
//   const totalSurfaceArea = surfaceAreaPerBox * actualNoOfPieces;

//   // Convert deckal to cm² (1 deckal = 1000 cm²)
//   const deckalArea = deckal * 1000;

//   // Calculate number of deckal sheets required
//   const deckalSheets = totalSurfaceArea / deckalArea;

//   // Calculate paper requirements in kg
//   // Formula: (Area in m² × GSM) / 1000
//   const areaInM2 = (deckalSheets * deckalArea) / 10000; // Convert cm² to m²

//   const paper1Weight = (areaInM2 * paper1GSM) / 1000;
//   const paper2Weight = (areaInM2 * paper2GSM) / 1000;
//   const paper3Weight = (areaInM2 * paper3GSM) / 1000;

//   const result = {
//     paper1: parseFloat(paper1Weight.toFixed(2)),
//     paper2: parseFloat(paper2Weight.toFixed(2)),
//     paper3: parseFloat(paper3Weight.toFixed(2)),
//   };

//   console.log("📊 Calculated paper requirements:", result);
//   return result;
// }

// // Main function to create outward inventory entries
// async function createOutwardInventoryEntries(qpOrder, session) {
//   const Inventory = mongoose.model("Inventory");

//   console.log("Creating outward inventory entries for order:", qpOrder.orderNo);

//   // Calculate actual paper requirements based on actual production
//   const actualNoOfPieces = qpOrder.actualNoOfPieces || qpOrder.noOfPieces;
//   const actualPaperRequirements = calculateActualPaperRequirements(
//     qpOrder.orderdata,
//     actualNoOfPieces
//   );

//   console.log("Actual paper requirements:", actualPaperRequirements);

//   // 🔹 Paper Outward - Use allocated papers with actual usage
//   if (
//     qpOrder.selectedPapers &&
//     (qpOrder.status === "Completed" || qpOrder.actualNoOfPieces)
//   ) {
//     const papers = ["paper1", "paper2", "paper3"];

//     // First, remove old allocations for this order
//     await Inventory.updateMany(
//       { "allocations.qpOrder": qpOrder._id },
//       { $pull: { allocations: { qpOrder: qpOrder._id } } },
//       { session }
//     );
//     console.log(`Removed old allocations for order ${qpOrder.orderNo}`);

//     // Track total actual usage per paper type
//     const totalActualUsage = {
//       paper1: 0,
//       paper2: 0,
//       paper3: 0,
//     };

//     // Process each paper type
//     for (const paperType of papers) {
//       const allocations = qpOrder.selectedPapers[paperType];
//       const actualRequirement = actualPaperRequirements[paperType];

//       if (!allocations || allocations.length === 0 || actualRequirement <= 0) {
//         console.log(`Skipping ${paperType} - no allocations or no requirement`);
//         continue;
//       }

//       console.log(
//         `Processing ${paperType} - Requirement: ${actualRequirement}KG`
//       );
//       console.log(
//         `Allocations for ${paperType}:`,
//         JSON.stringify(allocations, null, 2)
//       );

//       // Sort allocations by allocatedKg (ascending) to use smallest allocations first
//       const sortedAllocations = [...allocations].sort((a, b) => {
//         return (a.allocatedKg || 0) - (b.allocatedKg || 0);
//       });

//       let remainingRequirement = actualRequirement;

//       // Process each allocation
//       for (const allocation of sortedAllocations) {
//         console.log(`Processing allocation:`, allocation);

//         const inventoryItem = await Inventory.findById(
//           allocation.inventoryId
//         ).session(session);
//         if (!inventoryItem) {
//           console.log(
//             `Inventory not found for ${paperType}:`,
//             allocation.inventoryId
//           );
//           // Create outward entry with 0 kg to track all selected papers
//           const outwardPaper = new Inventory({
//             category: "factory",
//             type: "outward",
//             inventoryType: "paper",
//             paperName: "Unknown",
//             paperMillName: "Unknown",
//             gsm: 0,
//             deckal: 0,
//             kg: 0,
//             paperType: paperType,
//             qpOrder: qpOrder._id,
//             qpPurchase: qpOrder._id,
//             orderNo: qpOrder.orderNo,
//             companyName: qpOrder.companyName,
//             for: qpOrder.assignedTo,
//             forCompany: qpOrder.createdBy,
//             date: new Date(),
//             note: "Inventory item not found",
//           });

//           await outwardPaper.save({ session });
//           console.log(
//             `Created Paper Outward entry with 0 KG for missing inventory: ${paperType} - ${allocation.inventoryId}`
//           );
//           continue;
//         }

//         // Calculate available quantity for this inventory item
//         const currentlyAllocated = inventoryItem.allocations
//           .filter(
//             (alloc) => alloc.qpOrder.toString() !== qpOrder._id.toString()
//           )
//           .reduce((sum, alloc) => sum + alloc.allocatedKg, 0);

//         const availableKg = (inventoryItem.kg || 0) - currentlyAllocated;

//         // Use the allocatedKg from the selection, but don't exceed available quantity or remaining requirement
//         const allocatedKg = allocation.allocatedKg || 0;
//         const usageFromThisItem = Math.min(
//           allocatedKg,
//           availableKg,
//           remainingRequirement
//         );

//         console.log(
//           `Using ${usageFromThisItem}KG from ${inventoryItem.paperName} for ${paperType} (allocated: ${allocatedKg}, available: ${availableKg}, remaining: ${remainingRequirement})`
//         );

//         // Create outward entry for paper usage (always create an entry for each selected paper)
//         const outwardPaper = new Inventory({
//           category: "factory",
//           type: "outward",
//           inventoryType: "paper",
//           paperName: inventoryItem.paperName,
//           paperMillName: inventoryItem.paperMillName,
//           gsm: inventoryItem.gsm,
//           deckal: inventoryItem.deckal,
//           kg: usageFromThisItem, // Use the calculated usage
//           paperType: paperType,
//           qpOrder: qpOrder._id,
//           qpPurchase: qpOrder._id,
//           orderNo: qpOrder.orderNo,
//           companyName: qpOrder.companyName,
//           for: qpOrder.assignedTo,
//           forCompany: qpOrder.createdBy,
//           date: new Date(),
//           note:
//             usageFromThisItem === 0
//               ? "Selected but not used due to insufficient quantity or requirement already met"
//               : undefined,
//         });

//         await outwardPaper.save({ session });
//         console.log(
//           `Created Paper Outward entry: ${paperType} - ${usageFromThisItem}KG from ${inventoryItem.paperName}`
//         );

//         // If we're actually using some paper, update the inventory and tracking
//         if (usageFromThisItem > 0) {
//           // Create allocation in inventory
//           const newAllocation = {
//             qpOrder: qpOrder._id,
//             allocatedKg: usageFromThisItem,
//             paperType: paperType,
//             orderNo: qpOrder.orderNo,
//             companyName:
//               qpOrder.companyName?.companyName ||
//               qpOrder.companyName ||
//               "Unknown",
//             allocatedAt: new Date(),
//           };

//           await Inventory.findByIdAndUpdate(
//             allocation.inventoryId,
//             {
//               $push: { allocations: newAllocation },
//               $inc: { availableKg: -usageFromThisItem }, // reduce stock
//             },
//             { session }
//           );

//           // Update tracking
//           remainingRequirement -= usageFromThisItem;
//           totalActualUsage[paperType] += usageFromThisItem;
//         }
//       }

//       // If we couldn't fulfill the requirement, log a warning
//       if (remainingRequirement > 0) {
//         console.warn(
//           `Could not fulfill entire requirement for ${paperType}. Shortage: ${remainingRequirement}KG`
//         );
//       }
//     }

//     // Update the QpOrder with actual usage data
//     await QpData.findByIdAndUpdate(
//       qpOrder._id,
//       {
//         $set: {
//           actualPaperKG: {
//             paper1: {
//               deckal: qpOrder.orderdata.deckal,
//               gsm: qpOrder.orderdata.paper1GSM,
//               totalKg: totalActualUsage.paper1.toFixed(2),
//             },
//             paper2: {
//               deckal: qpOrder.orderdata.deckal,
//               gsm: qpOrder.orderdata.paper2GSM,
//               totalKg: totalActualUsage.paper2.toFixed(2),
//             },
//             paper3: {
//               deckal: qpOrder.orderdata.deckal,
//               gsm: qpOrder.orderdata.paper3GSM,
//               totalKg: totalActualUsage.paper3.toFixed(2),
//             },
//           },
//           actualTotalKg: (
//             totalActualUsage.paper1 +
//             totalActualUsage.paper2 +
//             totalActualUsage.paper3
//           ).toFixed(2),
//         },
//       },
//       { session }
//     );

//     console.log("Updated QpOrder with actual usage data");
//   }

//   // 🔹 Box Inward (with actualNoOfPieces)
//   if (qpOrder.actualNoOfPieces) {
//     const inwardBox = new Inventory({
//       category: "factory",
//       type: "inward",
//       inventoryType: "Box",
//       quantity: qpOrder.actualNoOfPieces,
//       booked: qpOrder.booked || false,
//       boxLength: qpOrder.orderdata?.length,
//       boxWidth: qpOrder.orderdata?.width,
//       boxHeight: qpOrder.orderdata?.height,
//       p1gsm: qpOrder.actualPaperKG?.paper1,
//       p2gsm: qpOrder.actualPaperKG?.paper2,
//       p3gsm: qpOrder.actualPaperKG?.paper3,
//       date: new Date(),
//       qpPurchase: qpOrder._id,
//       qpOrder: qpOrder._id,
//       companyName: qpOrder.companyName,
//       for: qpOrder.assignedTo,
//       forCompany: qpOrder.createdBy,
//     });

//     await inwardBox.save({ session });
//     console.log(`Created Box Inward entry: ${qpOrder.actualNoOfPieces} boxes`);
//   }

//   // 🔹 Box Outward (only noOfPieces)
//   if (qpOrder.noOfPieces) {
//     const outwardBox = new Inventory({
//       category: "factory",
//       type: "outward",
//       inventoryType: "Box",
//       quantity: qpOrder.noOfPieces,
//       booked: qpOrder.booked || false,
//       boxLength: qpOrder.orderdata?.length,
//       boxWidth: qpOrder.orderdata?.width,
//       boxHeight: qpOrder.orderdata?.height,
//       p1gsm: qpOrder.actualPaperKG?.paper1,
//       p2gsm: qpOrder.actualPaperKG?.paper2,
//       p3gsm: qpOrder.actualPaperKG?.paper3,
//       date: new Date(),
//       qpOrder: qpOrder._id,
//       qpPurchase: qpOrder._id,
//       companyName: qpOrder.companyName,
//       for: qpOrder.assignedTo,
//       forCompany: qpOrder.createdBy,
//     });

//     await outwardBox.save({ session });
//     console.log(`Created Box Outward entry: ${qpOrder.noOfPieces} boxes`);
//   }

//   // 🔹 Kantan Outward
//   if (qpOrder.kantan && qpOrder.actualTotalKantan?.reel) {
//     const outwardKantan = new Inventory({
//       category: "factory",
//       type: "outward",
//       inventoryType: "Kantan",
//       reel: convertToReels(
//         qpOrder.actualTotalKantan.reel,
//         qpOrder.actualTotalKantan.inch
//       ),
//       kantan: qpOrder.kantan,
//       vendor: qpOrder.vendor,
//       date: new Date(),
//       qpOrder: qpOrder._id,
//       qpPurchase: qpOrder._id,
//       companyName: qpOrder.companyName,
//       for: qpOrder.assignedTo,
//       forCompany: qpOrder.createdBy,
//     });
//     await outwardKantan.save({ session });
//     console.log("Created Kantan Outward entry");
//   }

//   // 🔹 Glue Outward
//   if (qpOrder.glue && qpOrder.glue.trim() !== "") {
//     const outwardGlue = new Inventory({
//       category: "factory",
//       type: "outward",
//       inventoryType: "Glue",
//       kg: parseFloat(qpOrder.glue),
//       vendor: qpOrder.vendor,
//       date: new Date(),
//       qpOrder: qpOrder._id,
//       qpPurchase: qpOrder._id,
//       companyName: qpOrder.companyName,
//       for: qpOrder.assignedTo,
//       forCompany: qpOrder.createdBy,
//     });
//     await outwardGlue.save({ session });
//     console.log("Created Glue Outward entry");
//   }

//   // 🔹 Wire Outward
//   if (qpOrder.wire && qpOrder.wire.trim() !== "") {
//     const outwardWire = new Inventory({
//       category: "factory",
//       type: "outward",
//       inventoryType: "Wire",
//       kg: parseFloat(qpOrder.wire),
//       vendor: qpOrder.vendor,
//       date: new Date(),
//       qpOrder: qpOrder._id,
//       qpPurchase: qpOrder._id,
//       companyName: qpOrder.companyName,
//       for: qpOrder.assignedTo,
//       forCompany: qpOrder.createdBy,
//     });
//     await outwardWire.save({ session });
//     console.log("Created Wire Outward entry");
//   }

//   console.log("Completed creating outward inventory entries");
// }

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
    const {
      orderIds,
      status,
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
      driver: { $exists: true, $ne: null, $ne: driverId },
    }).session(session);

    if (conflictingOrders.length > 0)
      throw new Error("Some orders assigned to another driver");

    const updateData = {};
    if (driverId) updateData.driver = driverId;

    // Status handling
    if (deliveryStatus) {
      switch (deliveryStatus) {
        case "loading":
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
      .populate("driver", "firstName lastName email")
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
