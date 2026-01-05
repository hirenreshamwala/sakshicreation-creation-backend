const mongoose = require("mongoose");

const marketSchema = new mongoose.Schema(
  {
    marketName: {
      type: String,
      required: true,
      trim: true,
      set: (v) => v.toUpperCase(),
      index: true,
    },
    area: {
      type: String,
      required: true,
      trim: true,
      set: (v) => v.toUpperCase(),
      index: true,
    },
    landmark: {
      type: String,
      trim: true,
      set: (v) => v.toUpperCase(),
      index: true,
    },
    pincode: {
      type: String,
      required: true,
      match: /^[0-9]{6}$/,
      index: true,
    },
  },
  { timestamps: true }
);
marketSchema.index({ createdAt: -1 });
marketSchema.index({ marketName: 1, area: 1 });

const Market = mongoose.model("Market", marketSchema);
module.exports = Market;
