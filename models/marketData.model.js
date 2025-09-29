const mongoose = require("mongoose");

const marketSchema = new mongoose.Schema(
  {
    marketName: {
      type: String,
      required: true,
      trim: true,
      set: (v) => v.toUpperCase(), 
    },
    area: {
      type: String,
      required: true,
      trim: true,
      set: (v) => v.toUpperCase(), 
    },
    // streetAddress: {
    //   type: String,
    //   trim: true,
    // },
    landmark: {
      type: String,
      trim: true,
      set: (v) => v.toUpperCase(), 
    },
    pincode: {
      type: String,
      required: true,
      match: /^[0-9]{6}$/, // ✅ Indian pincode (6 digits)
    },
  },
  { timestamps: true }
);
marketSchema.index({ createdAt: -1 });

const Market = mongoose.model("Market", marketSchema);
module.exports = Market;
