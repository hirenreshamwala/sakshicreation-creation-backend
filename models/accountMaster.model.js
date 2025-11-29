// models/AccountMaster.js
const mongoose = require("mongoose");

const accountMasterSchema = new mongoose.Schema(
  {
    companyName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyName",
      required: true,
      index: true,       // Single field index
    },
    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      required: false,
      index: true,       // Single field index
    },
    reasonToVisit: {
      type: String,
      required: false,
      index: true,       // Helps in text search / filters
    },
    reference: {
      type: String,
      required: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

accountMasterSchema.index({ companyName: 1, createdAt: -1 });
accountMasterSchema.index({ createdBy: 1, createdAt: -1 });
accountMasterSchema.index({ party: 1, createdAt: -1 });
accountMasterSchema.index({ reasonToVisit: "text", reference: "text" });

const AccountMaster = mongoose.model("AccountMaster", accountMasterSchema);
module.exports = AccountMaster;