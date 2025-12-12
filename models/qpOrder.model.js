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

// ✅ FIXED: Enhanced status history schema with proper defaults
const statusHistorySchema = new mongoose.Schema(
  {
    previousStatus: {
      type: String,
      required: true,
    },
    newStatus: {
      type: String,
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    reason: {
      type: String, // Optional field for change reason
    },
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
    // deliveryDate: {
    //   type: String,
    // },
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
    billNumber: {
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
    // ✅ UPDATED: Enhanced status history with previous status tracking
    statusHistory: [statusHistorySchema],
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
    },
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
    isPunching: {
      type: Boolean,
      default: false,
    },
    noOfSheetCut: {
    type: String,
    default: null
    },
    cuttingLength: {
        type: String,
        default: null
    },
    noOfLinear: {
        type: String,
        default: null
    },
    linear: {
        type: String,
        default: null
    },
    step: {
      type: Number,
      default: 0,
    },
    unitType: {
      type: String,
    },
    isKantan: {
      type: Boolean,
    },
    printType: {
      type: String,
    },
    inventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: false,
    },
    deliverTo: {
      type: String,
    },
    operatorCuttingLength: {
      type: String,
    },

    deductFrom: {
      type: String,
    },
    deductQty: {
      type: String,
    },
    isUrgent: {
      type: Boolean,
      default: false,
    },
    printerRemark: {
      type: String,
    },
    designerRemark: {
      type: String,
    },
    laminationRemark: {
      type: String,
    },
    designerFiles: [
      {
        type: String,
      },
    ],
    designFiles: [
      {
        type: String,
      },
    ],
    approveDesign: {
      type: Boolean,
    },
    reworkDesignerFiles: [
      {
        type: String,
      },
    ],
    reworkDesignFiles: [
      {
        type: String,
      },
    ],
    printerFiles: [
      {
        type: String,
      },
    ],
    paperQty: {
      type: String,
    },
    paperGsm: {
      type: String,
    },
    paperQuality: {
      type: String,
    },
    paperSize: {
      type: String,
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

// ✅ UPDATED: Store original status before any modification
qpDataSchema.pre("save", function (next) {
  if (this.isModified("status") && !this.isNew) {
    if (!this._originalStatus) {
      this._originalStatus = this.status;
    }
  }
  next();
});

// ✅ UPDATED: Enhanced status change detection middleware with proper history tracking
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

// ✅ UPDATED: Enhanced status history tracking with previous status
qpDataSchema.pre("save", function (next) {
  if (this.isModified("status") && !this.isNew) {
    const previousStatus = this._originalStatus;
    const newStatus = this.status;

    // Only add to history if status actually changed and both values are present
    if (previousStatus && newStatus && previousStatus !== newStatus) {
      const statusChange = {
        previousStatus: previousStatus,
        newStatus: newStatus,
        changedAt: new Date(),
        changedBy: this.updatedBy || this.createdBy, // Use updatedBy if available, else createdBy
      };

      if (!this.statusHistory) {
        this.statusHistory = [];
      }

      this.statusHistory.push(statusChange);
      console.log(
        `📝 Status History: ${previousStatus} -> ${newStatus} at ${statusChange.changedAt}`
      );
    }

    // Reset the original status
    delete this._originalStatus;
  }
  next();
});

// ✅ UPDATED: Enhanced middleware for findOneAndUpdate operations with status history
qpDataSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  const setUpdate = update.$set || {};

  console.log(`🔍 FindOneAndUpdate - Update:`, setUpdate);

  // Only proceed if status is being modified
  if (!setUpdate.status) {
    return next();
  }

  // Get the current document to know the previous status
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

      // ✅ FIXED: ADD STATUS HISTORY ONLY WHEN BOTH STATUSES ARE PRESENT AND DIFFERENT
      if (currentStatus && newStatus && currentStatus !== newStatus) {
        const statusChange = {
          previousStatus: currentStatus,
          newStatus: newStatus,
          changedAt: new Date(),
          changedBy: setUpdate.updatedBy || doc.createdBy,
        };

        // Initialize $push if it doesn't exist
        if (!update.$push) {
          update.$push = {};
        }

        update.$push.statusHistory = statusChange;
        console.log(
          `📝 Update Status History: ${currentStatus} -> ${newStatus} at ${statusChange.changedAt}`
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
    .catch((error) => {
      console.error("Error in findOneAndUpdate middleware:", error);
      next(error);
    });
});

// ✅ FIXED: Store original values for proper comparison
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

const QpData = mongoose.model("QpOrder", qpDataSchema);

module.exports = QpData;