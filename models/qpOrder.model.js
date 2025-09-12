const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

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
    name: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "packagingOption",
    },
    length: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "packagingOption",
    },
    height: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "packagingOption",
    },
    width: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "packagingOption",
    },
    ply: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "packagingOption",
      // required: true,
    },
    // size: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "packagingOption",
    //   // required: true,
    // },
    gsm: {
      type: String
    },
    deckal: {
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
      }
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

const QpData = mongoose.model("QpOrder", qpDataSchema);

module.exports = QpData;
