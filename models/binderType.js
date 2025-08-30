const mongoose = require("mongoose");

const binderTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const BinderType = mongoose.model("BinderType", binderTypeSchema);
module.exports = BinderType;
