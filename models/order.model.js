const mongoose = require("mongoose");

const quotationHistory = new mongoose.Schema(
  {
    unitPrice: {
      type: String,
    },
    qty: {
      type: String,
    },
    gst: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const orderSchema = new mongoose.Schema(
  {
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
    productItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "productItem",
      required: true,
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    pType: {
      type: String,
      trim: true,
      default: "",
    },
    binding: {
      type: Boolean,
      default: false,
    },
    bindingType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BinderType",
      required: false,
    },
    filePaths: [
      {
        path: {
          type: String,
          trim: true,
        },
        remark: {
          type: String,
          trim: true,
          default: "",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: [
        "Received",
        "Designer",
        "Printer",
        "Binder",
        "Booklet & Folder Binder",
        "Delivery",
        "Hold",
      ],
      default: "Received",
    },
    orderNumber: {
      type: String,
      trim: true,
      unique: true,
      required: true,
    },
    number: {
      type: String,
      enum: ["Yes", "No"],
      trim: true,
      required: false,
    },
    size: {
      type: String,
      trim: true,
    },
    startNumber: {
      type: String,
      trim: true,
      required: function () {
        return this.number === "Yes";
      },
    },
    endNumber: {
      type: String,
      trim: true,
      required: function () {
        return this.number === "Yes";
      },
    },
    totalNumbering: {
      type: String,
      trim: true,
    },
    numberingAmount: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      enum: ["1", "2", "4", "6"],
      trim: true,
    },
    color1: {
      type: String,
      trim: true,
    },
    color2: {
      type: String,
      trim: true,
    },
    pType: {
      type: String,
      trim: true,
    },
    binding: {
      type: String,
      trim: true,
    },
    subPaper: {
      type: String,
      trim: true,
    },
    usedPaper: {
      type: String,
      trim: true,
    },
    printingrate: {
      type: String,
      trim: true,
    },
    printingratePerUnit: {
      type: String,
      trim: true,
    },
    gsm: {
      type: String,
      trim: true,
    },
    rowPaperSize: {
      type: String,
      trim: true,
    },
    rowPaperUser: {
      type: String,
      trim: true,
    },
    rate: {
      type: Number,
      trim: true,
      min: 0,
    },
    rateType: {
      type: String,
      enum: ["old", "new"],
      trim: true,
    },
    // Staff assignments
    designer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    printer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    binder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    bookletBinder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },

    // Status tracking
    designerStatus: {
      type: String,
      enum: ["Pending", "In Progress", "Done", "Rework", "Approved"],
      default: "Pending",
    },
    printerStatus: {
      type: String,
      enum: ["Pending", "In Progress", "Done"],
      default: "Pending",
    },
    binderStatus: {
      type: String,
      enum: ["Pending", "In Progress", "Done"],
      default: "Pending",
    },
    bookletBinderStatus: {
      type: String,
      enum: ["Pending", "In Progress", "Done"],
      default: "Pending",
    },
    printerWastedSheet: {
      type: Number,
      min: 0,
      default: 0,
    },
    binderWastedSheet: {
      type: Number,
      min: 0,
      default: 0,
    },
    bookletBinderWastedSheet: {
      type: Number,
      min: 0,
      default: 0,
    },
    designerRemarks: {
      type: String,
      trim: true,
      default: "",
    },
    printerRemarks: {
      type: String,
      trim: true,
      default: "",
    },
    binderRemarks: {
      type: String,
      trim: true,
      default: "",
    },
    bookletBinderRemarks: {
      type: String,
      trim: true,
      default: "",
    },
    printerPapers: [
      {
        paperName: {
          type: String,
          required: false,
          trim: true,
        },
        numberOfSheetsUsed: {
          type: String,
          trim: true,
          required: false,
        },
        used: {
          type: String,
        },
        sheetSize: {
          type: String,
          trim: true,
          required: false,
        },
        paperType: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
          required: false,
          set: (v) => (v === "" ? null : v),
        },
        gsm: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
          required: false,
          set: (v) => (v === "" ? null : v),
        },
        materialSize: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
          required: false,
          set: (v) => (v === "" ? null : v),
        },
        wastage: {
          type: String,
          trim: true,
          required: false,
        },
        ratePerUnit: {
          type: String,
          trim: true,
          required: false,
        },
      },
    ],
    binderPapers: [
      {
        paperName: {
          type: String,
          required: false,
          trim: true,
        },
        numberOfSheetsUsed: {
          type: String,
          trim: true,
          required: false,
        },
        sheetSize: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
          required: false,
          set: (v) => (v === "" ? null : v),
        },
        paperType: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
          required: false,
          set: (v) => (v === "" ? null : v), 
        },
        gsm: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
          required: false,
          set: (v) => (v === "" ? null : v), // Added setter to handle empty string
        },
        ratePerUnit: {
          type: String,
          trim: true,
          required: false, // Explicitly set to false
        },
        wastage: {
          type: String,
          trim: true,
          required: false, // Explicitly set to false
        },
      },
    ],
    bookletPapers: [
      {
        paperName: {
          type: String,
          required: true,
          trim: true,
        },
        numberOfSheetsUsed: {
          type: String,
          trim: true,
          required: true,
        },
        sheetSize: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
          required: false,
        },
        paperType: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
          required: false,
        },
        gsm: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
          required: false,
        },
        ratePerUnit: {
          type: String,
          trim: true,
          required: true,
        },
        wastage: {
          type: String,
          trim: true,
        },
      },
    ],

    // File uploads for each stage
    designFiles: [
      {
        path: {
          type: String,
          trim: true,
        },
        remark: {
          type: String,
          trim: true,
          default: "",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    approvedFiles: [{type: String}],
    reworkFiles: [
      {
        path: {
          type: String,
          trim: true,
        },
        remark: {
          type: String,
          trim: true,
          default: "",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    printerFiles: [
      {
        path: {
          type: String,
          trim: true,
        },
        remark: {
          type: String,
          trim: true,
          default: "",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    binderFiles: [
      {
        path: {
          type: String,
          trim: true,
        },
        remark: {
          type: String,
          trim: true,
          default: "",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    bookletBinderFiles: [
      {
        path: {
          type: String,
          trim: true,
        },
        remark: {
          type: String,
          trim: true,
          default: "",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isLamination: {
      type: Boolean,
      default: false,
    },
    laminationType: {
      type: String,
      enum: ["", "Matte", "Gloss"],
      trim: true,
      default: "",
    },
    uv: {
      type: String,
      trim: true,
    },
    paper1: {
      type: String,
      trim: true,
    },
    paper2: {
      type: String,
      trim: true,
    },
    numberOfSheetUsed: {
      type: String,
      trim: true,
    },
    sheetSize: {
      type: String,
      trim: true,
    },
    paperType: {
      type: String,
      trim: true,
    },

    // Process checkboxes for booklet
    isPasting: {
      type: Boolean,
      default: false,
    },
    isCutting: {
      type: Boolean,
      default: false,
    },
    isCreasing: {
      type: Boolean,
      default: false,
    },
    isFoil: {
      type: Boolean,
      default: false,
    },
    isPunching: {
      type: Boolean,
      default: false,
    },
    validproof: [
      {
        path: {
          type: String,
          trim: true,
        },
        remark: {
          type: String,
          trim: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    quotationProof: {
      type: String,
      default: "",
    },
    invoiceValidProof: [
      {
        path: {
          type: String,
          trim: true,
        },
        remark: {
          type: String,
          trim: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reworkHistory: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        remark: {
          type: String,
          trim: true,
        },
        files: [
          {
            path: String,
            remark: String,
          },
        ],
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Staff",
        },
      },
    ],
    issuedDate: {
      type: Date,
    },
    receivedDate: {
      type: Date,
    },
    pagesPerBook: {
      type: Number,
    },
    rateBook: {
      type: String,
      trim: true,
    },
    totalAmount: {
      type: String,
      trim: true,
    },
    ratePerUnit: {
      type: String,
      trim: true,
    },
    bindergst: {
      type: String,
      required: false,
    },
    deliveryDate: {
      type: Date,
    },
    deliveryTime: {
      type: String,
      trim: true,
    },
    deliveryStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    isGst: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    quotation: [quotationHistory],
    
    // ✅ LAST STATUS CHANGE DATE FIELD
    lastStatusChangeDate: {
      type: Date,
      default: Date.now // ✅ DEFAULT VALUE FOR NEW ORDERS
    },
    
    // ✅ STATUS HISTORY TRACKING
    statusHistory: [
      {
        status: { 
          type: String, 
          required: true 
        },
        changedAt: { 
          type: Date, 
          default: Date.now 
        },
        changedBy: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: "Staff" 
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
orderSchema.index({ companyName: 1, party: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ designer: 1 });
orderSchema.index({ printer: 1 });
orderSchema.index({ binder: 1 });
orderSchema.index({ bookletBinder: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ lastStatusChangeDate: -1 });

// ✅ COMPREHENSIVE STATUS CHANGE DETECTION MIDDLEWARE
orderSchema.pre("save", function (next) {
  console.log(`🔍 Order Save Middleware - Status modified: ${this.isModified("status")}, Is New: ${this.isNew}`);
  
  // Always ensure lastStatusChangeDate has a value for new orders
  if (this.isNew && !this.lastStatusChangeDate) {
    this.lastStatusChangeDate = new Date();
    console.log(`✅ New order created, setting lastStatusChangeDate to current date`);
  }
  
  // Handle status changes for existing orders
  if (!this.isNew && this.isModified("status")) {
    const previousStatus = this._originalStatus;
    const newStatus = this.status;
    
    console.log(`🔄 Status Change Detected: ${previousStatus} -> ${newStatus}`);
    
    // Case 1: If status is being changed to "Delivery", set lastStatusChangeDate to null
    if (this.status === "Delivery") {
      this.lastStatusChangeDate = null;
      console.log(`✅ Status changed to "Delivery", setting lastStatusChangeDate to null`);
    }
    // Case 2: Regular status change (when status is not "Delivery")
    else if (this.status !== "Delivery") {
      if (previousStatus !== newStatus) {
        this.lastStatusChangeDate = new Date();
        console.log(`✅ Regular status change: ${previousStatus} -> ${newStatus}, updating lastStatusChangeDate`);
      } else {
        console.log(`ℹ️ Status same (${newStatus}), not updating lastStatusChangeDate`);
      }
    }
  }
  
  next();
});

// ✅ STORE ORIGINAL STATUS BEFORE UPDATE FOR PROPER COMPARISON
orderSchema.pre("save", function (next) {
  if (this.isModified("status") && !this.isNew) {
    // Store the original status before modification for comparison
    if (!this._originalStatus) {
      this._originalStatus = this.status;
    }
  }
  next();
});

// ✅ ENHANCED MIDDLEWARE FOR FINDONEANDUPDATE OPERATIONS
orderSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  const setUpdate = update.$set || {};
  
  console.log(`🔍 Order FindOneAndUpdate - Status Update: ${setUpdate.status}`);
  
  // Get the current document to check current values
  this.model.findOne(this.getQuery()).then((doc) => {
    if (!doc) {
      return next();
    }

    const currentStatus = doc.status;
    const newStatus = setUpdate.status;

    let updateSet = {};

    // Case 1: If status is being changed to "Delivery", set lastStatusChangeDate to null
    if (newStatus === "Delivery") {
      updateSet.lastStatusChangeDate = null;
      console.log(`✅ Status changing to "Delivery", setting lastStatusChangeDate to null`);
    }
    // Case 2: Regular status change (when status is not "Delivery")
    else if (newStatus && newStatus !== "Delivery" && currentStatus !== newStatus) {
      updateSet.lastStatusChangeDate = new Date();
      console.log(`✅ Regular status change: ${currentStatus} -> ${newStatus}, updating lastStatusChangeDate`);
    }
    // Case 3: For new documents being created via findOneAndUpdate (though rare)
    else if (!doc.lastStatusChangeDate && newStatus && newStatus !== "Delivery") {
      updateSet.lastStatusChangeDate = new Date();
      console.log(`✅ Setting initial lastStatusChangeDate for order`);
    }

    // Update the $set object with our changes only if there are updates
    if (Object.keys(updateSet).length > 0) {
      if (update.$set) {
        update.$set = { ...update.$set, ...updateSet };
      } else {
        update.$set = updateSet;
      }
      console.log(`🔄 Final Update Object:`, update);
    }

    next();
  }).catch(next);
});

// ✅ ADD STATUS HISTORY TRACKING
orderSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    const statusChange = {
      status: this.status,
      changedAt: new Date()
    };
    
    if (!this.statusHistory) {
      this.statusHistory = [];
    }
    
    this.statusHistory.push(statusChange);
    console.log(`📝 Added to statusHistory: ${JSON.stringify(statusChange)}`);
  }
  next();
});

// ✅ EXISTING PARTY TAG UPDATE MIDDLEWARE
orderSchema.pre("save", async function (next) {
  try {
    // Only proceed if this is a new order (not an update)
    if (this.isNew) {
      const Party = mongoose.model("Party");

      // Find the party associated with this order
      const party = await Party.findById(this.party);

      if (party && party.partyTag === "NEW") {
        // Update the party tag to "Customer"
        party.partyTag = "CUSTOMER";
        await party.save();
        console.log(`✅ Updated party tag from NEW to CUSTOMER`);
      }
    }
    next();
  } catch (error) {
    console.error("Error updating party tag:", error);
    next(error);
  }
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;