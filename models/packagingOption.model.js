const mongoose = require("mongoose");

const packagingOptionSchema = new mongoose.Schema(
  {
    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
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
    deckal:{
      type: String,
      required: true,
      trim: true,
    },
    paper1GSM: {
      type: String,
      required: true,
    },
    paper2GSM: {
      type: String,
      required: true,
    },
    paper3GSM: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const PackagingOption = mongoose.model("packagingOption", packagingOptionSchema);
module.exports = PackagingOption;