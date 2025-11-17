const mongoose = require("mongoose");

const paymentFolderSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CompanyName",
    required: true,
  },
  party: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Party",
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    required: true,
  },
  assignedDate: {
    type: Date,
  },
  remarks: {
    type: String,
    default: "",
  },
  paymentType: {
    type: String,
  },
  month:{
    type: String,
  },
  paymentAmount: {
    type: Number,
  },
  area: {
    type: String,
  },
  receivedAmount: {
    type: Number,
  },
  pendingAmount: {
    type: Number,
  },
}, { timestamps: true });


const paymentFolder = mongoose.model("paymentFolder", paymentFolderSchema);
module.exports = paymentFolder;