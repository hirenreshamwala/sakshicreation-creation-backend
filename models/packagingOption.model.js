const mongoose = require("mongoose");

const packagingOptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      // required: true,
      trim: true,
    },
    ply: {
      type: String,
      required: true,
      trim: true,
    },
    length: {
      type: String,
      required: true,
      trim: true,
    },
    width: {
      type: String,
      required: true,
      trim: true,
    },
    height: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const PackagingOption = mongoose.model("packagingOption", packagingOptionSchema);
module.exports = PackagingOption;