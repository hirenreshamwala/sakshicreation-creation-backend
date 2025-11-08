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
      uom,
      length,
      width,
      height,
      deckal,
      paper1GSM,
      paper2GSM,
      paper3GSM,
      noOfPieces,
      ratePerPiece
    } = packagingOption || {};
    if (
      !ply ||
      !uom ||
      !length ||
      !width ||
      !height ||
      !deckal ||
      !paper1GSM ||
      !paper2GSM ||
      !paper3GSM ||
      !noOfPieces ||
      !ratePerPiece
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Missing required packaging option fields",
      });
    }

    // Validate UOM field
    if (!["inch", "cm", "mm"].includes(uom)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid UOM value. Must be inch, cm, or mm",
      });
    }

    let packaging = await PackagingOption.findOne({
      party: party,
      ply,
      uom,
      length,
      width,
      height,
      deckal,
      paper1GSM,
      paper2GSM,
      paper3GSM,
      noOfPieces,
      ratePerPiece
    }).session(session);

    if (!packaging) {
      packaging = new PackagingOption({
        party,
        ply,
        uom,
        length,
        width,
        height,
        deckal,
        paper1GSM,
        paper2GSM,
        paper3GSM,
        noOfPieces,
        ratePerPiece,
      });
      await packaging.save({ session });
    } else {
      // ✅ packaging exist → update timestamp
      packaging.updatedAt = new Date();
      await packaging.save({ session, timestamps: false });
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
        "party ply uom length width height deckal paper1GSM paper2GSM paper3GSM noOfPieces ratePerPiece"
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
      .populate(
        "orderdata",
        "party ply uom length width height deckal paper1GSM paper2GSM paper3GSM noOfPieces ratePerPiece"
      )
      .populate({
        path: "party",
        select: "-__v",
        populate: [
          {
            path: "address.marketName",
            model: "Market",
            select: "marketName", 
          },
          {
            path: "address.landMark",
            model: "Market",
            select: "landmark", 
          },
          {
            path: "address.area",
            model: "Market",
            select: "area", 
          },
          {
            path: "address.pincode",
            model: "Market",
            select: "pincode", 
          },
        ],
      })
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
      .populate({
        path: "party",
        select:
          "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
      })
      .populate(
        "orderdata",
        "party ply uom length width height deckal paper1GSM paper2GSM paper3GSM noOfPieces ratePerPiece"
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
        orderNo: qpOrder.orderNo,
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
    // 1) Load current order (inside transaction)
    const currentOrder = await QpData.findById(req.params.id).session(session);
    if (!currentOrder) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "QP Order not found",
      });
    }

    let lastStatusChangeDate = currentOrder.lastStatusChangeDate;

    // ✅ CORRECTION: Status change tabhi detect karo jab status different ho
    // if (req.body.status && currentOrder.status !== req.body.status) {
    //   lastStatusChangeDate = new Date();
    // }

    // 2) Validate incoming ObjectId fields early (so we can abort before mutating DB)
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

    // 3) ALWAYS process paper allocations if selectedPapers provided in request
    // (you can change to more specific check if you want)
    if (
      req.body.selectedPapers &&
      req.body.selectedPapers.paper1.length > 0 &&
      currentOrder.selectedPapers?.paper1?.length === 0
    ) {
      // handlePaperAllocations should accept session and use it for any DB writes
      await handlePaperAllocations(currentOrder, req.body, session);
    } else {
      console.log(
        "ℹ️ No selectedPapers in request, skipping allocation processing"
      );
    }

    // 4) If packagingOption is provided, find or create PackagingOption (in same session)
    let packagingOptionId = currentOrder.orderdata;
    if (req.body.packagingOption) {
      const {
        party,
        ply,
        uom,
        length,
        width,
        height,
        deckal,
        paper1GSM,
        paper2GSM,
        paper3GSM,
        noOfPieces,
        ratePerPiece
      } = req.body.packagingOption;

      // if (
      //   !party ||
      //   !ply ||
      //   !uom ||
      //   !length ||
      //   !width ||
      //   !height ||
      //   !deckal ||
      //   !paper1GSM ||
      //   !paper2GSM ||
      //   !paper3GSM
      // ) {
      //   await session.abortTransaction();
      //   session.endSession();
      //   return res.status(400).json({
      //     success: false,
      //     message: "Missing required packaging option fields",
      //   });
      // }

      // Validate UOM field
      if (!["inch", "cm", "mm"].includes(uom)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Invalid UOM value. Must be inch, cm, or mm",
        });
      }

      let packaging = await PackagingOption.findOne({
        party,
        ply,
        uom,
        length,
        width,
        height,
        deckal,
        paper1GSM,
        paper2GSM,
        paper3GSM,
        noOfPieces,
        ratePerPiece
      }).session(session);

      if (!packaging) {
        packaging = new PackagingOption({
          party,
          ply,
          uom,
          length,
          width,
          height,
          deckal,
          paper1GSM,
          paper2GSM,
          paper3GSM,
          noOfPieces,
          ratePerPiece,
        });
        await packaging.save({ session });
      } else {
        // ✅ packaging exist → update timestamp
        packaging.updatedAt = new Date();
        await packaging.save({ session, timestamps: false });
      }

      packagingOptionId = packaging._id;
    }

    // 5) Build the update document — gather flags and status changes
    const now = new Date();

    // Base fields to set (exclude paperAllocations; handled separately)
    delete req.body.statusHistory

    const setFields = {
      ...req.body,
      orderdata: packagingOptionId,
      // lastStatusChangeDate,  
    };

    // Remove fields we don't want to blindly set
    delete setFields.paperAllocations; // handled separately
    // (if you have other fields you should not allow, delete them here)

    // Collect process flags explicitly (only set a flag if provided)
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
        setFields[flag] = req.body[flag];
      } else {
        // if you don't want to overwrite existing flags when not provided, ensure they are not present
        delete setFields[flag];
        
      }
    });

    // Prepare update operators
    const updateOps = { $set: setFields };

    // Push to statusHistory if status provided AND changed
    // if (req.body.status && currentOrder.status !== req.body.status) {
    //   updateOps.$push = {
    //     statusHistory: {
    //       status: req.body.status,
    //       changedAt: now,
    //       changedBy: req.user?._id || null,
    //     },
    //   };
    // }

    // 6) Perform single atomic update (new: true) within session
    const updatedOrder = await QpData.findByIdAndUpdate(
      req.params.id,
      updateOps,
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
      .populate({
        path: "orderdata",
        select:
          "party ply length width height deckal paper1GSM paper2GSM paper3GSM noOfPieces ratePerPiece",
      })
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

    if (!updatedOrder) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "QP Order not found after update",
      });
    }

    // 7) If status changed to "Completed" (and was not completed before), create outward inventory entries
    const statusChangedToCompleted =
      req.body.status === "Completed" && currentOrder.status !== "Completed";

    if (statusChangedToCompleted) {
      // createOutwardInventoryEntries must use the same session
      await createOutwardInventoryEntries(updatedOrder, session);
    }

    // 8) Commit transaction and return the updated order
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "QP Order updated successfully",
      data: updatedOrder,
      outwardCreated: statusChangedToCompleted,
    });
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (e) {
      console.error("Failed to abort transaction:", e);
    }
    session.endSession();

    console.error("❌ Error updating QP order:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update QP order",
      error: error.message,
    });
  }
};

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

function getPaperKGDifferences(paperKG, actualPaperKG) {
  const result = [];
  const papers = ["paper1", "paper2", "paper3"];

  for (const paper of papers) {
    const planned = paperKG?.[paper]?.totalKg
      ? Number(paperKG[paper].totalKg)
      : 0;
    const actual = actualPaperKG?.[paper]?.totalKg
      ? Number(actualPaperKG[paper].totalKg)
      : 0;
    const differenceKg = (actual - planned).toFixed(2);

    result.push({
      paper,
      deckal: actualPaperKG?.[paper]?.deckal || paperKG?.[paper]?.deckal,
      gsm: actualPaperKG?.[paper]?.gsm || paperKG?.[paper]?.gsm,
      differenceKg: parseFloat(differenceKg),
    });
  }

  return result;
}

// 🏭 Main function: create outward inventory entries
async function createOutwardInventoryEntries(qpOrder, session) {
  const Inventory = mongoose.model("Inventory");

  console.log("🚀 START: createOutwardInventoryEntries function called");
  console.log("📦 Order Details:", {
    orderNo: qpOrder.orderNo,
    orderId: qpOrder._id,
    company: qpOrder.companyName,
    actualNoOfPieces: qpOrder.actualNoOfPieces,
    noOfPieces: qpOrder.noOfPieces,
  });

  const actualNoOfPieces = qpOrder.actualNoOfPieces || qpOrder.noOfPieces;
  console.log("🔢 Actual No of Pieces calculated:", actualNoOfPieces);

  console.log("📄 Calculating actual paper requirements...");
  const actualPaperRequirements = calculateActualPaperRequirements(
    qpOrder.orderdata,
    actualNoOfPieces
  );
  console.log(
    "✅ Actual paper requirements calculated:",
    actualPaperRequirements
  );

  const papers = ["paper1", "paper2", "paper3"];
  console.log("📋 Papers to process:", papers);

  // 🧮 Step 1: Get paper usage differences
  console.log("🧮 STEP 1: Getting paper usage differences...");
  console.log("📊 Planned paper KG:", qpOrder.paperKG);
  console.log("📊 Actual paper KG:", qpOrder.actualPaperKG);

  const differences = getPaperKGDifferences(
    qpOrder.paperKG,
    qpOrder.actualPaperKG
  );

  console.log("📈 Differences calculated:", differences);
  console.log("🔍 Differences array length:", differences?.length);

  if (differences && differences.length > 0) {
    console.log("🔄 STEP 1A: Processing paper differences...");

    // 🧾 Process each difference properly
    for (const [index, diff] of differences.entries()) {
      console.log(
        `\n📄 Processing difference ${index + 1}/${differences.length}:`,
        diff
      );

      const { paper, differenceKg } = diff;

      // Skip if no meaningful difference
      if (!differenceKg || differenceKg === 0) {
        console.log(
          `⏭️ Skipping ${paper} - no difference (differenceKg: ${differenceKg})`
        );
        continue;
      }

      console.log(`🔍 Checking selected papers for ${paper}...`);

      // Check if selectedPapers exists and has data for this paper
      if (
        !qpOrder.selectedPapers ||
        !qpOrder.selectedPapers[paper] ||
        !qpOrder.selectedPapers[paper].length
      ) {
        console.warn(`⚠️ No selected papers data found for ${paper}`);
        continue;
      }

      // Get the last selected paper object
      const lastSelectedPaper =
        qpOrder.selectedPapers[paper][qpOrder.selectedPapers[paper].length - 1];
      console.log(`📄 Last selected paper for ${paper}:`, lastSelectedPaper);

      // ✅ Get the inventoryId from selectedPapers
      const inventoryId = lastSelectedPaper.inventoryId;

      if (!inventoryId) {
        console.warn(`❌ No inventoryId found in selected papers for ${paper}`);
        continue;
      }

      console.log(`🎯 Inventory ID for ${paper}:`, inventoryId);

      try {
        // ✅ Find inventory item directly by inventoryId WITH session
        const inventoryItem = await Inventory.findById(inventoryId).session(
          session
        );

        if (!inventoryItem) {
          console.warn(
            `❌ Inventory not found for ID: ${inventoryId} of ${paper}`
          );
          continue;
        }

        console.log(`✅ Found inventory item for ${paper}:`, {
          inventoryId: inventoryItem._id,
          paperType: inventoryItem.paperType,
          availableKg: inventoryItem.availableKg,
          currentAllocations: inventoryItem.allocations?.length || 0,
          deckal: inventoryItem.deckal,
          gsm: inventoryItem.gsm,
        });

        // Calculate extras if needed
        console.log(`🧮 Calculating extras for ${paper}...`);
        let extraKg = 0;
        if (paper === "paper1") {
          // Only apply extras to primary paper
          const kantan = parseFloat(qpOrder.kantan || 0);
          const glue = parseFloat(qpOrder.glue || 0);
          const wire = parseFloat(qpOrder.wire || 0);
          extraKg = kantan + glue + wire;
          console.log(`📦 Extras calculated for paper1:`, {
            kantan,
            glue,
            wire,
            totalExtra: extraKg,
          });
        }

        const totalAllocatedKg = differenceKg + extraKg;
        console.log(`📊 Total allocation calculation:`, {
          differenceKg,
          extraKg,
          totalAllocatedKg,
        });

        // ✅ Create new allocation
        const newAlloc = {
          qpOrder: qpOrder._id,
          paperType: paper,
          allocatedKg: totalAllocatedKg,
          orderNo: qpOrder.orderNo,
          companyName: qpOrder.companyName || "Unknown",
          allocatedAt: new Date(),
          note: `Difference Adjustment ${differenceKg > 0 ? "+" : ""
            }${differenceKg} KG${extraKg > 0 ? ` + Extras ${extraKg} KG` : ""}`,
        };

        console.log(`📝 New allocation object:`, newAlloc);

        // Update allocations array
        const currentAllocations = inventoryItem.allocations || [];
        const updatedAllocations = [newAlloc, ...currentAllocations];

        console.log(`🔄 Updating allocations:`, {
          currentAllocationsCount: currentAllocations.length,
          updatedAllocationsCount: updatedAllocations.length,
        });

        console.log(
          `💾 Saving allocation update for inventory ${inventoryItem._id}...`
        );

        const res = await Inventory.findByIdAndUpdate(
          inventoryItem._id,
          {
            allocations: updatedAllocations,
            $inc: { availableKg: -totalAllocatedKg },
          },
          { session, new: true }
        );

        console.log(`✅ Allocation updated for ${paper}:`, {
          inventoryId: inventoryItem._id,
          allocated: totalAllocatedKg,
          difference: differenceKg,
          extras: extraKg,
          remainingAllocations: res.allocations.length,
          newAvailableKg: res.availableKg,
        });
      } catch (error) {
        console.error(`❌ Error processing ${paper}:`, error);
        console.error(`🔍 Error details:`, {
          message: error.message,
          stack: error.stack,
        });
        continue;
      }
    }
  } else {
    console.log(
      "ℹ️ No differences found to process or differences array is empty"
    );
  }

  // ... rest of the function remains same for outward entries, box entries, etc.
  // 🧾 Step 2: Create outward entry for actual used paper
  console.log(
    "\n🧾 STEP 2: Creating outward entries for actual paper usage..."
  );
  for (const paperType of papers) {
    console.log(`\n📄 Processing outward entry for ${paperType}...`);
    const actualPaper = qpOrder.actualPaperKG?.[paperType];
    console.log(`📊 Actual paper data for ${paperType}:`, actualPaper);

    if (!actualPaper || Number(actualPaper.totalKg) <= 0) {
      console.log(
        `⏭️ Skipping outward for ${paperType} - no actual paper data or zero quantity`
      );
      continue;
    }

    try {
      console.log(`💾 Creating outward inventory entry for ${paperType}...`);
      const outwardEntry = {
        category: "factory",
        type: "outward",
        inventoryType: "paper",
        paperType,
        deckal: actualPaper.deckal,
        gsm: actualPaper.gsm,
        kg: Number(actualPaper.totalKg),
        qpOrder: qpOrder._id,
        qpPurchase: qpOrder._id,
        orderNo: qpOrder.orderNo,
        companyName: qpOrder.companyName,
        for: qpOrder.assignedTo,
        forCompany: qpOrder.createdBy,
        date: new Date(),
        note: "Actual Paper Usage Outward",
      };

      console.log(`📝 Outward entry data:`, outwardEntry);

      await new Inventory(outwardEntry).save({ session });

      console.log(
        `✅ Outward entry created for ${paperType}: ${actualPaper.totalKg} KG`
      );
    } catch (error) {
      console.error(`❌ Error creating outward entry for ${paperType}:`, error);
      console.error(`🔍 Error details:`, error.message);
    }
  }

  // 📦 Step 3: Box Inward / Outward
  console.log("\n📦 STEP 3: Processing box inward/outward entries...");
  try {
    console.log(`🔍 Checking actualNoOfPieces:`, qpOrder.actualNoOfPieces);
    if (qpOrder.actualNoOfPieces) {
      console.log(`💾 Creating box inward entry...`);
      const boxInward = {
        category: "factory",
        type: "inward",
        inventoryType: "Box",
        lamination: qpOrder.lamination,
        laminationType: qpOrder.laminationType,
        uv: qpOrder.uv,
        uvType: qpOrder.uvType,
        varnish: qpOrder.varnish,
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
        // usedBox: qpOrder.noOfPieces,
        ply: getOrderdata.ply,
        uom: getOrderdata.uom,
        length: getOrderdata.length,
        width: getOrderdata.width,
        height: getOrderdata.height,
        deckal: getOrderdata.deckal,
        paper1GSM: getOrderdata.paper1GSM,
        paper2GSM: getOrderdata.paper2GSM,
        paper3GSM: getOrderdata.paper3GSM,
        isKantan: qpOrder.isKantan,
        printType: qpOrder.printType,
      };

      console.log(`📝 Box inward data:`, boxInward);
      await new Inventory(boxInward).save({ session });
      console.log(`✅ Box inward created: ${qpOrder.actualNoOfPieces} pieces`);
    } else {
      console.log(`⏭️ Skipping box inward - no actualNoOfPieces`);
    }

    console.log(`🔍 Checking noOfPieces:`, qpOrder.noOfPieces);
    if (qpOrder.noOfPieces) {
      console.log(`💾 Creating box outward entry...`);
      // const boxOutward = {
      //   category: "factory",
      //   type: "outward",
      //   inventoryType: "Box",
      //   lamination: qpOrder.lamination,
      //   laminationType: qpOrder.laminationType,
      //   uv: qpOrder.uv,
      //   uvType: qpOrder.uvType,
      //   varnish: qpOrder.varnish,
      //   quantity: qpOrder.noOfPieces,
      //   boxLength: qpOrder.orderdata.length,
      //   boxWidth: qpOrder.orderdata.width,
      //   boxHeight: qpOrder.orderdata.height,
      //   date: new Date(),
      //   qpOrder: qpOrder._id,
      //   qpPurchase: qpOrder._id,
      //   companyName: qpOrder.companyName,
      //   for: qpOrder.assignedTo,
      //   forCompany: qpOrder.createdBy,
      //   ply: getOrderdata.ply,
      //   uom: getOrderdata.uom,
      //   length: getOrderdata.length,
      //   width: getOrderdata.width,
      //   height: getOrderdata.height,
      //   deckal: getOrderdata.deckal,
      //   paper1GSM: getOrderdata.paper1GSM,
      //   paper2GSM: getOrderdata.paper2GSM,
      //   paper3GSM: getOrderdata.paper3GSM,
      //   isKantan: qpOrder.isKantan,
      //   printType: qpOrder.printType,
      // };

      // console.log(`📝 Box outward data:`, boxOutward);
      // await new Inventory(boxOutward).save({ session });

      const changeQty = await Inventory.find({
        qpOrder: qpOrder._id,
        type: "inward",
        inventoryType: "Box",
      }).session(session);

      if (changeQty.length > 0) {
        console.log(`Found ${changeQty.length} matching inward boxes.`);
        for (const inward of changeQty) {
          const updated = await Inventory.findByIdAndUpdate(
            inward._id,
            { usedBox: qpOrder.noOfPieces },
            { session, new: true }
          );
          console.log("✅ Updated usedBox for:", updated._id);
        }
      } else {
        console.warn("⚠️ No inward box found for qpOrder:", qpOrder._id);
      }
      console.log(`✅ Box outward created: ${qpOrder.noOfPieces} pieces`);
    } else {
      console.log(`⏭️ Skipping box outward - no noOfPieces`);
    }
  } catch (error) {
    console.error("❌ Error processing box entries:", error);
    console.error("🔍 Error details:", error.message);
  }

  // 🧪 Step 4: Kantan, Glue, Wire outward
  console.log("\n🧪 STEP 4: Processing extras (Kantan, Glue, Wire)...");
  const extras = [
    { key: "kantan", type: "Kantan", field: "reel" },
    { key: "glue", type: "Glue", field: "kg" },
    { key: "wire", type: "Wire", field: "kg" },
  ];

  for (const e of extras) {
    console.log(`\n🔍 Processing ${e.type}...`);
    const val = qpOrder[e.key];
    console.log(`📊 Value for ${e.key}:`, val);

    if (!val) {
      console.log(`⏭️ Skipping ${e.type} - no value`);
      continue;
    }

    try {
      console.log(`💾 Creating outward entry for ${e.type}...`);
      const outward = {
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
      };

      console.log(`📝 ${e.type} outward data:`, outward);
      await new Inventory(outward).save({ session });
      console.log(`✅ ${e.type} outward created: ${val} ${e.field}`);
    } catch (error) {
      console.error(`❌ Error creating ${e.type} outward:`, error);
      console.error(`🔍 Error details:`, error.message);
    }
  }

  console.log("\n🎉 ✅ Outward Inventory Processing Completed Successfully");
  console.log("🏁 END: createOutwardInventoryEntries function completed");
}

function getPaperKGDifferences(paperKG, actualPaperKG) {
  console.log("\n🧮 getPaperKGDifferences function called");
  console.log("📊 Input - paperKG:", paperKG);
  console.log("📊 Input - actualPaperKG:", actualPaperKG);

  const result = [];
  const papers = ["paper1", "paper2", "paper3"];

  for (const paper of papers) {
    console.log(`\n📄 Calculating difference for ${paper}...`);

    const planned = paperKG?.[paper]?.totalKg
      ? Number(paperKG[paper].totalKg)
      : 0;
    const actual = actualPaperKG?.[paper]?.totalKg
      ? Number(actualPaperKG[paper].totalKg)
      : 0;
    const differenceKg = (actual - planned).toFixed(2);

    console.log(`📊 ${paper} calculations:`, {
      planned,
      actual,
      differenceKg,
    });

    const differenceEntry = {
      paper,
      deckal: actualPaperKG?.[paper]?.deckal || paperKG?.[paper]?.deckal,
      gsm: actualPaperKG?.[paper]?.gsm || paperKG?.[paper]?.gsm,
      differenceKg: parseFloat(differenceKg),
    };

    console.log(`✅ ${paper} difference entry:`, differenceEntry);
    result.push(differenceEntry);
  }

  console.log("📈 Final differences result:", result);
  return result;
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
      .populate({
        path: "party",
        select:
          "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo",
      })
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
        "party ply uom length width height deckal paper1GSM paper2GSM paper3GSM noOfPieces ratePerPiece"
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
        "Completed",
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
    if (deliveryStatus) {
      updateData.deliveryStatus = deliveryStatus;
    }

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
        "party ply uom length width height deckal paper1GSM paper2GSM paper3GSM noOfPieces ratePerPiece"
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

exports.sendBoxFromGodownOrFactory = async (req, res) => {
  try {
    if (req.body.step === 4) {
      const updatedOrder = await QpData.findByIdAndUpdate(
        req.params.id,
        { step: 4 },
        { new: true }
      )
        .populate("companyName", "companyName avatar")
        .populate(
          "party",
          "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo"
        )
        .populate(
          "orderdata",
          "party ply uom length width height deckal paper1GSM paper2GSM paper3GSM"
        )
        .populate("kantan", "kantanName")
        .populate("driver", "firstName lastName email");

      return res.status(200).json({
        success: true,
        message: "Step 4 updated successfully.",
        data: updatedOrder,
      });
    }
    const inventory = await Inventory.findById(req.body.inventory);

    // Prevent exceeding available stock
    const available = inventory.quantity - (inventory.usedBox || 0);
    if (req.body.qty > available) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock in inventory ${inventory.boxName}. Only ${available} left.`,
      });
    }

    inventory.usedBox = (inventory.usedBox || 0) + req.body.qty;
    await inventory.save();

    // ✅ Update QP Order with inventory usage
    const updatedOrder = await QpData.findByIdAndUpdate(
      req.params.id,
      {
        inventory: req.body.inventory,
        step: req.body.step,
        status: "Completed",
      },
      { new: true }
    )
      .populate("companyName", "companyName avatar")
      .populate(
        "party",
        "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo"
      )
      .populate(
        "orderdata",
        "party ply uom length width height deckal paper1GSM paper2GSM paper3GSM noOfPieces ratePerPiece"
      )
      .populate("kantan", "kantanName")
      .populate("driver", "firstName lastName email");

    res.status(200).json({
      success: true,
      message: "Boxes successfully assigned from inventory.",
      data: updatedOrder,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to update orders",
    });
  }
};

// Controller for bulk status updates
exports.bulkUpdateQPOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    console.log("Bulk update request body:", req.body);

    const {
      orderIds,
      deliveryStatus,
      billPhotos,
      dispatchPhotos,
      dispatchTime,
      deliveryTime,
      billNumber,
      step, // ✅ added for godown logic
    } = req.body;

    const driverId = req.user?.id;
    const currentTime = new Date();

    if (!orderIds || !orderIds.length) throw new Error("Order IDs required");

    // Check conflicting driver assignments
    const conflictingOrders = await QpData.find({
      _id: { $in: orderIds },
      driver: { $nin: [null, driverId] },
    }).session(session);

    if (conflictingOrders.length > 0)
      throw new Error("Some orders are assigned to another driver");

    const updateData = {};
    if (driverId) updateData.driver = driverId;

    const driver = await Staff.findById(driverId).session(session);
    if (!driver) throw new Error("Driver not found");

    if (billNumber) {
      updateData.billNumber = billNumber;
    } else {
      console.warn("⚠️ No bill number provided for delivery update");
    }

    // --- STATUS HANDLING ---
    if (deliveryStatus) {
      switch (deliveryStatus) {
        // ---------------- LOADING ----------------
        case "loading": {
          if (driver.isDisptach) {
            throw new Error(
              "You already have an ongoing dispatch. Complete delivery before loading new orders."
            );
          }
          const driverData = await Staff.findById(driverId).session(session);
          if (driverData) {
            const updatedOrders = [...(driverData.orders || []), ...orderIds];
            await Staff.findByIdAndUpdate(
              driverId,
              { orders: updatedOrders },
              { session }
            );
          }
          updateData.loadingStartDate = currentTime;
          updateData.deliveryStatus = "loading";
          break;
        }

        // ---------------- IN TRANSIT ----------------
        case "in_transit": {
          if (!dispatchPhotos || !dispatchPhotos.length)
            throw new Error("Dispatch photos required for dispatch");
          updateData.deliveryStartTime = currentTime;
          updateData.loadingEndDate = currentTime;
          updateData.deliveryStatus = "in_transit";
          updateData.dispatchTime = dispatchTime || currentTime;
          updateData.dispatchPhoto = dispatchPhotos[0];

          await Staff.findByIdAndUpdate(
            driverId,
            { isDisptach: true },
            { session }
          );
          break;
        }

        // ---------------- DELIVERED ----------------
        case "delivered": {
          if (!billPhotos || !billPhotos.length)
            throw new Error("Bill photos required for delivery");

          updateData.deliveryEndTime = currentTime;
          updateData.deliveredAt = currentTime;
          updateData.deliveryStatus = "delivered";
          updateData.deliveryTime = deliveryTime || currentTime;
          updateData.billPhoto = billPhotos[0];

          // Fetch delivered orders
          const deliveredOrders = await QpData.find({
            _id: { $in: orderIds },
          })
            .populate("orderdata")
            .session(session);

          // Create outward entries for each order
          for (const currentOrder of deliveredOrders) {
            console.log(
              currentOrder,
              "jhgkbghsdjkfhbsdjkhfjk-----------------------------"
            );
            console.log(currentOrder.step, "current order step ");
            if (currentOrder.step === 4 || currentOrder.step === 3) {
              const boxOutward = {
                category: "factory",
                type: "outward",
                inventoryType: "Box",
                lamination: currentOrder.lamination,
                laminationType: currentOrder.laminationType,
                uv: currentOrder.uv,
                uvType: currentOrder.uvType,
                varnish: currentOrder.varnish,
                quantity: currentOrder.noOfPieces,
                boxLength: currentOrder.orderdata?.length,
                boxWidth: currentOrder.orderdata?.width,
                boxHeight: currentOrder.orderdata?.height,
                date: new Date(),
                qpOrder: currentOrder._id,
                qpPurchase: currentOrder._id,
                companyName: currentOrder.companyName,
                for: currentOrder.assignedTo,
                forCompany: currentOrder.createdBy,
                ply: currentOrder.orderdata.ply,
                uom: currentOrder.orderdata.uom,
                length: currentOrder.orderdata.length,
                width: currentOrder.orderdata.width,
                height: currentOrder.orderdata.height,
                deckal: currentOrder.orderdata.deckal,
                paper1GSM: currentOrder.orderdata.paper1GSM,
                paper2GSM: currentOrder.orderdata.paper2GSM,
                paper3GSM: currentOrder.orderdata.paper3GSM,
                isKantan: currentOrder.isKantan,
                printType: currentOrder.printType,
                sendTo: currentOrder.deliverTo,
              };

              console.log(
                `📝 Creating Box outward for order ${currentOrder._id}`
              );
              const inventory = await new Inventory(boxOutward).save({
                session,
              });

              // ✅ If step === 2 → move to godown (create inward)
              if (currentOrder.deliverTo === "godown") {
                const godownInward = {
                  ...boxOutward,
                  _id: undefined, // new document
                  category: "godown",
                  type: "inward",
                  date: new Date(),
                  // sendTo: "godown",
                  // status: "in_stock",
                };

                console.log(
                  `📦 Moving order ${currentOrder._id} boxes from factory to godown`
                );

                await Inventory.create([godownInward], { session });

                // Update the factory outward entry as sent
                await Inventory.findByIdAndUpdate(
                  inventory._id,
                  { sendTo: "godown" },
                  { session }
                );
              }
            } else if (currentOrder.step === 2) {
              const boxOutward = {
                category: "godown",
                type: "outward",
                inventoryType: "Box",
                lamination: currentOrder.lamination,
                laminationType: currentOrder.laminationType,
                uv: currentOrder.uv,
                uvType: currentOrder.uvType,
                varnish: currentOrder.varnish,
                quantity: currentOrder.noOfPieces,
                boxLength: currentOrder.orderdata?.length,
                boxWidth: currentOrder.orderdata?.width,
                boxHeight: currentOrder.orderdata?.height,
                date: new Date(),
                qpOrder: currentOrder._id,
                qpPurchase: currentOrder._id,
                companyName: currentOrder.companyName,
                for: currentOrder.assignedTo,
                forCompany: currentOrder.createdBy,
                ply: currentOrder.orderdata.ply,
                uom: currentOrder.orderdata.uom,
                length: currentOrder.orderdata.length,
                width: currentOrder.orderdata.width,
                height: currentOrder.orderdata.height,
                deckal: currentOrder.orderdata.deckal,
                paper1GSM: currentOrder.orderdata.paper1GSM,
                paper2GSM: currentOrder.orderdata.paper2GSM,
                paper3GSM: currentOrder.orderdata.paper3GSM,
                isKantan: currentOrder.isKantan,
                printType: currentOrder.printType,
                status: "used",
              };

              console.log(
                `📝 Creating Box outward for order ${currentOrder._id}`
              );
              const inventory = await new Inventory(boxOutward).save({
                session,
              });
            }
          }
          break;
        }
      }
    }

    if (deliveryStatus) updateData.deliveryStatus = deliveryStatus;

    // Bulk update orders
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
        "party ply uom length width height deckal paper1GSM paper2GSM paper3GSM noOfPieces ratePerPiece"
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
    console.error("❌ Bulk update failed:", err);
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

exports.driverSelectionAndInventoryManage = async (req, res) => {
  try {
    const inventory = await Inventory.findById(req.body.inventory).lean();

    if (inventory) {
      const { _id, ...inventoryData } = inventory;

      // here box will be outward

      // await Inventory.create({
      //   ...inventoryData,
      //   quantity: req.body.noOfPieces,
      //   type: "outward",
      // });

      if (req.body.step === 2) {
        await Inventory.create({
          ...inventoryData,
          quantity: req.body.noOfPieces,
          category: "godown",
          type: "inward",
        });

        await Inventory.findByIdAndUpdate(
          inventory._id,
          { sendTo: "godown" },
          { new: true }
        );
      }
    }

    const updatedOrder = await QpData.findByIdAndUpdate(
      req.params.id,
      {
        driver: req.body.driverId,
        deliverTo: req.body.deliverTo,
      },
      { new: true }
    )
      .populate("companyName", "companyName avatar")
      .populate(
        "party",
        "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo"
      )
      .populate(
        "orderdata",
        "party ply uom length width height deckal paper1GSM paper2GSM paper3GSM noOfPieces ratePerPiece"
      )
      .populate("kantan", "kantanName")
      .populate("driver", "firstName lastName email");

    res.status(200).json({
      success: true,
      message: "Boxes successfully assigned from inventory.",
      data: updatedOrder,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to update orders",
    });
  }
};

exports.updateMarkUrgent = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { isUrgent } = req.body; 

    // ✅ Update QP Order with urgent status
    const updatedOrder = await QpData.findByIdAndUpdate(
      orderId,
      {
        isUrgent: isUrgent, 
      },
      { new: true }
    )
      .populate("companyName", "companyName avatar")
      .populate(
        "party",
        "partyName address contactPerson personMobileNo personWhatsAppNo GSTNo"
      )
      .populate(
        "orderdata",
        "party ply uom length width height deckal paper1GSM paper2GSM paper3GSM noOfPieces ratePerPiece"
      )
      .populate("kantan", "kantanName")
      .populate("driver", "firstName lastName email");

    res.status(200).json({
      success: true,
      message: `Order successfully ${isUrgent ? 'marked as urgent' : 'unmarked as urgent'}.`,
      data: updatedOrder,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to update order urgent status",
    });
  }
};
