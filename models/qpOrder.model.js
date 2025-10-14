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
      // type: String,
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
    // extra data add by manager
    unitNo: {
      type: String,
    },
    startDate: {
      type: String,
    },
    deliveryDate: {
      type: String,
    },
    // kantan: {
    //   type: String,
    // },
    // kantanDeckal: {
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
      // type: String,
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
    // loadingEndDate: {
    //   type: String,
    // },
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
      required: false
    },
    printer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: false
    },
    binder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: false
    },
    billPhoto: {
      type: String
    },
    paperAllocations: [paperAllocationSchema],

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
      default: false
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
    designDone:{
      type: Boolean,
      default: false
    },
    printerDone:{
      type: Boolean,
      default: false
    },
    laminationDone:{
      type: Boolean,
      default: false
    },
    paperCuttingDone: {
      type: Boolean,
      default: false
    },
    corrugationDone: {
      type: Boolean,
      default: false
    },
    pastingDone: {
      type: Boolean,
      default: false
    },
    rotaryDone: {
      type: Boolean,
      default: false
    },
    slottingDone: {
      type: Boolean,
      default: false
    },
    printingDone: {
      type: Boolean,
      default: false
    },
    manualPastingDone: {
      type: Boolean,
      default: false
    },
    pinningDone: {
      type: Boolean,
      default: false
    },
    punchingDone: {
      type: Boolean,
      default: false
    },
    isBoxFound: {
      type: Boolean,
      default: false
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
