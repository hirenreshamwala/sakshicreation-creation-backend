const mongoose = require("mongoose");

const FactoryReturnSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "QpData", required: true }],
  factoryPhotos: [{ type: String }],
  factoryArrivalTime: { type: Date, default: Date.now },
}, { timestamps: true });

// export default mongoose.models.FactoryReturn || mongoose.model("FactoryReturn", FactoryReturnSchema);

const FactoryReturn = mongoose.model("FactoryReturn", FactoryReturnSchema);

module.exports = FactoryReturn;
