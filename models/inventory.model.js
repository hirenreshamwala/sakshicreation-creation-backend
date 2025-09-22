const mongoose = require("mongoose");

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
    deckal:{
      type:String
    },
    p1gsm: {
      deckal: { type: String },
      gsm: { type: String },
      totalKg: { type: String },
    },
    p2gsm: {
      deckal: { type: String },
      gsm: { type: String },
      totalKg: { type: String },
    },
    p3gsm: {
      deckal: { type: String },
      gsm: { type: String },
      totalKg: { type: String },
    },
    booked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inventory", InventorySchema);
