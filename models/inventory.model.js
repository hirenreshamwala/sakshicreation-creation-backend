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
    qpPurchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QualityPurchase",
      required: false,
    },
    companyName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyName",
      required: [true, "Company is required"],
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
    for: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: [true, "Role is required"],
    },
    forCompany: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: [true, "Staff is required"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inventory", InventorySchema);
