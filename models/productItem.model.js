const mongoose = require("mongoose");

const productItemSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
}, { timestamps: true });
productItemSchema.index({
  createdAt: -1,
  itemName: 1
});

const ProductItem = mongoose.model("productItem", productItemSchema);
module.exports = ProductItem;