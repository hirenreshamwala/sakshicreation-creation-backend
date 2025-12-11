const mongoose = require("mongoose");

const packagingOptionSchema = new mongoose.Schema(
  {
    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      required: false
    },
    ply: {
      type: String,
      required: true,
      trim: true,
    },
    uom: {
      type: String,
      enum: ["inch", "cm", "mm"],
      required: true,
      default: "inch",
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
    deckal: {
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
    noOfPieces: {
      type: String,
      required: false,
      trim: true,
    },
    ratePerPiece: {
      type: String,
      required: false,
      trim: true,
    },
    isKantan: {
      type: Boolean,
      default: false
    },
    kantan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kantan",
      default: null
    }
  },
  { timestamps: true }
);

const PackagingOption = mongoose.model("packagingOption", packagingOptionSchema);
module.exports = PackagingOption;