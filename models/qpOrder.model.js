const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

const remarkSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    previousValue: {
      type: String,
    },
  },
  { _id: false }
);

const paperAllocationSchema = new mongoose.Schema(
  {
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
    },
    allocatedKg: {
      type: Number,
      required: true,
    },
    paperType: {
      type: String,
      enum: ["paper1", "paper2", "paper3"],
      required: true,
    },
    paperName: String,
    paperMillName: String,
    gsm: String,
    deckal: String,
  },
  { _id: false }
);

// Quality packaging data
const qpDataSchema = new mongoose.Schema(
  {
    orderNo: {
      type: Number,
      unique: true,
    },
    companyName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyName",
      required: true,
    },
    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      required: true,
    },
    date: {
      type: String,
    },
    orderFrom: {
      type: String,
    },
    orderdata: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "packagingOption",
    },
    gsm: {
      type: String,
    },
    deckalCalculation: {
      type: String,
    },
    noOfPieces: {
      type: Number,
    },
    ratePerPiece: {
      type: Number,
    },
    amount: {
      type: String,
    },
    kgPerUnit: {
      type: String,
    },
    totalKg: {
      type: String,
    },
    kantan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kantan",
    },
    kantanPerUnit: {
      type: String,
    },
    totalKantan: {
      reel: {
        type: String,
      },
      inch: {
        type: String,
      },
    },
    kantanDeckal: {
      type: String,
    },
    dyeNumber: {
      type: String,
    },
    dyeSize: {
      type: String,
    },
    glue: {
      type: String,
    },
    wire: {
      type: String,
    },
    typ: {
      type: String,
      default: "New",
    },
    status: {
      type: String,
      default: "Pending",
    },
    dySheetSize: {
      type: String,
    },
    salesRemark: {
      type: String,
    },
    dyeRemark: {
      type: String,
    },
    godownRemark: {
      type: String,
    },
    factoryRemark: {
      type: String,
    },
    delivery: {
      type: String,
    },
    unitNo: {
      type: String,
    },
    startDate: {
      type: String,
    },
    deliveryDate: {
      type: String,
    },
    rsFor: {
      type: String,
    },
    pinning: {
      type: String,
    },
    pasteing: {
      type: String,
    },
    otherStatus: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    operatorNoOfPieces: {
      type: Number,
    },
    operatorNoOfSheet: { type: Number },
    actualNoOfPieces: {
      type: Number,
    },
    actualTotalKg: {
      type: String,
    },
    actualTotalKantan: {
      reel: {
        type: String,
      },
      inch: {
        type: String,
      },
    },
    actualPaperKG: {
      paper1: {
        deckal: { type: String },
        gsm: { type: String },
        totalKg: { type: String },
      },
      paper2: {
        deckal: { type: String },
        gsm: { type: String },
        totalKg: { type: String },
      },
      paper3: {
        deckal: { type: String },
        gsm: { type: String },
        totalKg: { type: String },
      },
    },
    operatorTotalKg: {
      type: String,
    },
    operatorPaperKG: {
      paper1: {
        deckal: { type: String },
        gsm: { type: String },
        totalKg: { type: String },
      },
      paper2: {
        deckal: { type: String },
        gsm: { type: String },
        totalKg: { type: String },
      },
      paper3: {
        deckal: { type: String },
        gsm: { type: String },
        totalKg: { type: String },
      },
    },
    paperKG: {
      paper1: {
        deckal: { type: String },
        gsm: { type: String },
        totalKg: { type: String },
      },
      paper2: {
        deckal: { type: String },
        gsm: { type: String },
        totalKg: { type: String },
      },
      paper3: {
        deckal: { type: String },
        gsm: { type: String },
        totalKg: { type: String },
      },
    },
    remarks: [remarkSchema],
    deliveryStatus: {
      type: String,
    },
    loadingStartDate: {
      type: String,
    },
    deliveryStartTime: {
      type: String,
    },
    deliveryEndTime: {
      type: String,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    kantanStart: { type: Date },
    kantanEnd: { type: Date },
    designer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: false,
    },
    printer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: false,
    },
    binder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: false,
    },
    billPhoto: {
      type: String,
    },
    paperAllocations: [paperAllocationSchema],
    paperUsageSummary: {
      paper1: [{ type: String }],
      paper2: [{ type: String }],
      paper3: [{ type: String }],
    },
    selectedPapers: {
      paper1: [
        {
          inventoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Inventory",
            required: false,
          },
          allocatedKg: {
            type: Number,
            required: true,
          },
        },
      ],
      paper2: [
        {
          inventoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Inventory",
            required: false,
          },
          allocatedKg: {
            type: Number,
            required: true,
          },
        },
      ],
      paper3: [
        {
          inventoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Inventory",
            required: false,
          },
          allocatedKg: {
            type: Number,
            required: true,
          },
        },
      ],
    },
    dispatchPhoto: {
      type: String,
    },
    isPrinterLamination: {
      type: Boolean,
      default: false,
    },
    lastStatusChangeDate: {
      type: Date,
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
      },
    ],
    designDone: {
      type: Boolean,
      default: false,
    },
    printerDone: {
      type: Boolean,
      default: false,
    },
    laminationDone: {
      type: Boolean,
      default: false,
    },
    paperCuttingDone: {
      type: Boolean,
      default: false,
    },
    corrugationDone: {
      type: Boolean,
      default: false,
    },
    pastingDone: {
      type: Boolean,
      default: false,
    },
    rotaryDone: {
      type: Boolean,
      default: false,
    },
    slottingDone: {
      type: Boolean,
      default: false,
    },
    printingDone: {
      type: Boolean,
      default: false,
    },
    manualPastingDone: {
      type: Boolean,
      default: false,
    },
    pinningDone: {
      type: Boolean,
      default: false,
    },
    punchingDone: {
      type: Boolean,
      default: false,
    },
    isBoxFound: {
      type: Boolean,
      default: false,
    },
    lamination: {
      type: Boolean,
      default: false,
    }, // "yes" or "no"
    laminationType: {
      type: String,
    }, // "glossy" or "mate"
    uv: {
      type: Boolean,
      default: false,
    },
    uvType: {
      type: String,
    },
    varnish: {
      type: Boolean,
      default: false,
    },
    isPinning: {
      type: Boolean,
      default: false,
    },
    isPasting: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Add auto-increment plugin
qpDataSchema.plugin(AutoIncrement, {
  inc_field: "orderNo",
  start_seq: 1000,
});

// ✅ UPDATED: Enhanced status change detection middleware
qpDataSchema.pre("save", function (next) {
  console.log(
    `🔍 Save Middleware - Status modified: ${this.isModified(
      "status"
    )}, DeliveryStatus modified: ${this.isModified("deliveryStatus")}`
  );

  // Case 1: If deliveryStatus is being changed to "Delivered", set lastStatusChangeDate to null
  if (
    this.isModified("deliveryStatus") &&
    this.deliveryStatus === "Delivered"
  ) {
    this.lastStatusChangeDate = null;
    console.log(
      `✅ DeliveryStatus changed to "Delivered", setting lastStatusChangeDate to null`
    );
  }
  // Case 2: If status is being changed to "Completed" AND deliveryStatus exists but is not "Delivered"
  else if (
    this.isModified("status") &&
    this.status === "Completed" &&
    this.deliveryStatus &&
    this.deliveryStatus !== "Delivered"
  ) {
    this.lastStatusChangeDate = new Date();
    console.log(
      `✅ Status changed to "Completed" and deliveryStatus is not "Delivered", updating lastStatusChangeDate`
    );
  }
  // Case 3: If deliveryStatus is being changed (and it's not "Delivered") after status is "Completed"
  else if (
    this.isModified("deliveryStatus") &&
    this.status === "Completed" &&
    this.deliveryStatus !== "Delivered"
  ) {
    this.lastStatusChangeDate = new Date();
    console.log(
      `✅ DeliveryStatus changed while status is "Completed", updating lastStatusChangeDate`
    );
  }
  // Case 4: Regular status change (when status is not "Completed")
  else if (this.isModified("status") && this.status !== "Completed") {
    const previousStatus = this._originalStatus || this.status;
    const newStatus = this.status;

    if (previousStatus !== newStatus) {
      this.lastStatusChangeDate = new Date();
      console.log(
        `✅ Regular status change: ${previousStatus} -> ${newStatus}, updating lastStatusChangeDate`
      );
    } else {
      console.log(
        `ℹ️ Status same (${newStatus}), not updating lastStatusChangeDate`
      );
    }
  }

  next();
});

// ✅ Store original status before update for proper comparison
qpDataSchema.pre("save", function (next) {
  if (
    (this.isModified("status") || this.isModified("deliveryStatus")) &&
    !this.isNew
  ) {
    // Store the original values before modification for comparison
    if (!this._originalStatus) {
      this._originalStatus = this.status;
    }
    if (!this._originalDeliveryStatus) {
      this._originalDeliveryStatus = this.deliveryStatus;
    }
  }
  next();
});

// ✅ UPDATED: Enhanced middleware for findOneAndUpdate operations
qpDataSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  const setUpdate = update.$set || {};

  console.log(`🔍 FindOneAndUpdate - Update:`, setUpdate);

  // Get the current document to check current values
  this.model
    .findOne(this.getQuery())
    .then((doc) => {
      if (!doc) {
        return next();
      }

      const currentStatus = doc.status;
      const currentDeliveryStatus = doc.deliveryStatus;
      const newStatus = setUpdate.status;
      const newDeliveryStatus = setUpdate.deliveryStatus;

      let shouldUpdateLastStatusChangeDate = false;
      let updateSet = setUpdate;

      // Case 1: If deliveryStatus is being changed to "Delivered", set lastStatusChangeDate to null
      if (newDeliveryStatus === "Delivered") {
        updateSet.lastStatusChangeDate = null;
        console.log(
          `✅ DeliveryStatus changing to "Delivered", setting lastStatusChangeDate to null`
        );
      }
      // Case 2: If status is being changed to "Completed" AND deliveryStatus exists but is not "Delivered"
      else if (
        newStatus === "Completed" &&
        (newDeliveryStatus || currentDeliveryStatus) &&
        newDeliveryStatus !== "Delivered"
      ) {
        updateSet.lastStatusChangeDate = new Date();
        console.log(
          `✅ Status changing to "Completed" and deliveryStatus is not "Delivered", updating lastStatusChangeDate`
        );
      }
      // Case 3: If deliveryStatus is being changed (and it's not "Delivered") after status is "Completed"
      else if (
        newDeliveryStatus &&
        currentStatus === "Completed" &&
        newDeliveryStatus !== "Delivered"
      ) {
        updateSet.lastStatusChangeDate = new Date();
        console.log(
          `✅ DeliveryStatus changing while status is "Completed", updating lastStatusChangeDate`
        );
      }
      // Case 4: Regular status change (when status is not "Completed")
      else if (
        newStatus &&
        newStatus !== "Completed" &&
        currentStatus !== newStatus
      ) {
        updateSet.lastStatusChangeDate = new Date();
        console.log(
          `✅ Regular status change: ${currentStatus} -> ${newStatus}, updating lastStatusChangeDate`
        );
      }

      // Update the $set object with our changes
      if (update.$set) {
        update.$set = { ...update.$set, ...updateSet };
      } else {
        update.$set = updateSet;
      }

      next();
    })
    .catch(next);
});

// Add status history tracking
qpDataSchema.pre("save", function (next) {
  if (this.isModified("status") || this.isModified("deliveryStatus")) {
    const statusChange = {
      status: this.status,
      deliveryStatus: this.deliveryStatus,
      changedAt: new Date(),
    };

    if (!this.statusHistory) {
      this.statusHistory = [];
    }

    this.statusHistory.push(statusChange);
    console.log(`📝 Added to statusHistory: ${JSON.stringify(statusChange)}`);
  }
  next();
});

qpDataSchema.pre("save", async function (next) {
  try {
    // Only proceed if this is a new QpData (not an update)
    if (this.isNew) {
      const Party = mongoose.model("Party");

      // Find the party associated with this QpData
      const party = await Party.findById(this.party);

      if (party && party.partyTag === "NEW") {
        // Update the party tag to "CUSTOMER"
        party.partyTag = "CUSTOMER";
        await party.save();
      }
    }
    next();
  } catch (error) {
    console.error("Error updating party tag in QpData:", error);
    next(error);
  }
});

const QpData = mongoose.model("QpOrder", qpDataSchema);

module.exports = QpData;
