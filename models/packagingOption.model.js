const mongoose = require("mongoose");

const packagingOptionSchema = new mongoose.Schema(
  {
    ply: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: String,
      required: true,
      trim: true,
    },
    gsm: {
      type: String,
      required: true,
      trim: true,
    },
    deckal: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const PackagingOption = mongoose.model("packagingOption", packagingOptionSchema);
module.exports = PackagingOption;
