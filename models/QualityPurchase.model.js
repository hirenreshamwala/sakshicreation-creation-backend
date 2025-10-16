const mongoose = require("mongoose");

const PurchaseSchema = new mongoose.Schema(
  {
    vendorName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    billNumber: {
      type: String,
      required: [true, "Bill number is required"],
      unique: true,
    },
    type: {
      type: String,
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
    deckal: {
      type: String,
    },
    gsm: {
      type: String,
    },
    companyName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyName",
      required: [true, "Company is required"],
    },
    reel: {
      type: String,
    },
    paperMil: {
      type: String,
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
    category: {
      type: String,
    },
      bf: {
    type: String,
  }
  },
  { timestamps: true }
);

module.exports = mongoose.model("QualityPurchase", PurchaseSchema);
