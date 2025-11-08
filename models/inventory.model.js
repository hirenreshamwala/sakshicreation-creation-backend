const mongoose = require("mongoose");

const allocationSchema = new mongoose.Schema(
  {
    qpOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QpOrder",
      required: true,
    },
    // orderNo: { type: Number },
    allocatedKg: {
      type: Number,
      required: true,
    },
    paperType: {
      type: String,
      enum: ["paper1", "paper2", "paper3"],
      required: true,
    },
    orderNo: Number,
    companyName: String,
    allocatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const InventorySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["printer", "binder", "booklet", "factory", "godown"],
      required: [true, "Inventory category is required"],
    },
    type: {
      type: String,
      enum: ["inward", "outward"],
      required: [true, "Inventory type is required"],
    },
    reel: {
      type: String,
    },
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: false,
      // required: [true, 'Material is required'],
    },
    quantity: {
      type: Number,
      // required: [true, "Quantity is required"],
      // min: [0, "Quantity cannot be negative"],
    },
    kg: {
      type: Number,
      // required: [true, 'KG is required'],
      // min: [0, 'KG cannot be negative'],
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: false,
      // required: [true, 'Vendor is required for inward records'],
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
      default: Date.now,
    },
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
      required: false,
    },
    qpOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QpOrder",
      required: false,
    },
    qpPurchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QualityPurchase",
      required: false,
    },
    companyName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyName",
      required: false,
    },
    kantan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kantan",
      required: false,
    },
    kg: {
      type: Number,
      required: false,
    },
    paperName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaperGSM",
      required: false,
    },
    height: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaperGSM",
      required: false,
    },
    width: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaperGSM",
      required: false,
    },
    length: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaperGSM",
      required: false,
    },
    inventoryType: {
      type: String,
    },
    for: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: [false, "Role is required"],
    },
    forCompany: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: [false, "Staff is required"],
    },
    boxLength: {
      type: String,
    },
    boxWidth: {
      type: String,
    },
    boxHeight: {
      type: String,
    },
    deckal: {
      type: String,
    },
    gsm: {
      type: String,
    },
    paper: {
      deckal: { type: String },
      gsm: { type: String },
      totalKg: { type: String },
    },
    booked: {
      type: Boolean,
      default: false,
    },
    allocations: [allocationSchema],
    bf: {
      type: String,
    },
    color: {
      type: String,
    },
    reelBatchNo: {
      type: String,
    },
    // Calculated available quantity
    availableKg: {
      type: Number,
      default: function () {
        return this.kg || 0;
      },
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
    ply: {
      type: String,
    },
    uom: {
      type: String,
    },
    length: {
      type: String,
    },
    width: {
      type: String,
    },
    height: {
      type: String,
    },
    paper1GSM: {
      type: String,
    },
    paper2GSM: {
      type: String,
    },
    paper3GSM: {
      type: String,
    },
    usedBox: {
      type: Number,
    },
    sendTo: {
      type: String,
    },
    isKantan: {
      type: Boolean,
    },
    printType: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inventory", InventorySchema);
