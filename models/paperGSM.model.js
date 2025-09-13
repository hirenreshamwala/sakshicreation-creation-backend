const mongoose = require("mongoose");

const paperGSMSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    length: {
      type: String,
      trim: true,
    },
    width: {
      type: String,
      trim: true,
    },
    height: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const PaperGSM = mongoose.model("PaperGSM", paperGSMSchema);
module.exports = PaperGSM;