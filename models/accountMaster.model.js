const mongoose = require("mongoose");

const accountMasterSchema = new mongoose.Schema(
  {
    companyName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyName",
      required: true,
    },
    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
    },
    reasonToVisit: {
      type: String,
    },
    reference: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
  },
  { timestamps: true }
);

accountMasterSchema.index({ companyName: 1 });
accountMasterSchema.index({ party: 1 });
accountMasterSchema.index({ createdBy: 1 });
accountMasterSchema.index({ companyName: 1, createdBy: 1 });
accountMasterSchema.index({ companyName: 1, createdAt: -1 });
accountMasterSchema.index({ party: 1, createdAt: -1 });
accountMasterSchema.index({ createdBy: 1, createdAt: -1 });

accountMasterSchema.index({ reasonToVisit: "text", reference: "text" });

module.exports = mongoose.model("AccountMaster", accountMasterSchema);
