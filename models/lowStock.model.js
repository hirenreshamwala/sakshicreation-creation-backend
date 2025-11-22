const mongoose = require('mongoose');

const LowStockSchema = new mongoose.Schema(
  {
    deckal: {
      type: String,
      required: true,
    },
    gsm: {
      type: String,
      required: true,
    },
    bf: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      required: true,
    },
    minKg: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Create compound index to ensure unique combination
LowStockSchema.index({ deckal: 1, gsm: 1, bf: 1, color: 1 }, { unique: true });

module.exports = mongoose.model('LowStock', LowStockSchema);
