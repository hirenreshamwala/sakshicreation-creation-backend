const mongoose = require("mongoose");

const paperGSMSchema = new mongoose.Schema(
  {
    // name: {
    //   type: String,
    //   trim: true,
    // },
    deckal: {
      type: String,
      trim: true,
    },
    gsm: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const PaperGSM = mongoose.model("PaperGSM", paperGSMSchema);
module.exports = PaperGSM;