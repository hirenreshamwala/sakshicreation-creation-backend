const mongoose = require("mongoose");

const PurchaseSchema = new mongoose.Schema(
  {
    vendorName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: [false, "Vendor is required"],
    },
    billNumber: {
      type: String,
      required: [false, "Bill number is required"],
      unique: false,
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
      required: [false, "KG is required"],
    },
    companyName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyName",
      required: false,
    },
    for: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: false,
    },
    forCompany: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: false,
    },
  },
  { timestamps: false }
);

module.exports = mongoose.model("QualityPurchase", PurchaseSchema);
