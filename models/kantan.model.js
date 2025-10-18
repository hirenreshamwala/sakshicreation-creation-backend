const mongoose = require("mongoose");

const kantanSchema = new mongoose.Schema(
  {
    kantanName: {
      type: String,
      required: true,
    },
    deckal: {  // 👈 Naya field add karein
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);
kantanSchema.index({ createdAt: -1 });

const Kantan = mongoose.model("Kantan", kantanSchema);
module.exports = Kantan;
