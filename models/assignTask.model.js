const mongoose = require("mongoose");

const assignTaskSchema = new mongoose.Schema({
  companyName: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CompanyName",
    required: true
  },
  partyName: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Party",
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: String,
  reasonForVisit: {
    type: String,
    required: true
  },
  remarks: String,
  assignTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    required: true
  },
  status: {
    type: String,
    enum: ["Pending", "Rescheduled", "Completed", "Cancelled"],
    default: "Pending"
  },
  visitDate: Date,
  visitTime: String,
  feedback: String,
  rescheduleDate: Date,
  isRescheduledTask: {
    type: Boolean,
    default: false
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order"
  },
  originalTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AssignTask",
    default: null,
    required: false
  },
  
}, { timestamps: true });

assignTaskSchema.index({ date: 1 });
assignTaskSchema.index({ status: 1 });
assignTaskSchema.index({ companyName: 1 });
assignTaskSchema.index({ assignTo: 1 });
assignTaskSchema.index({ isRescheduledTask: 1 });
assignTaskSchema.index({ date: 1, status: 1, assignTo: 1 }) // Compound index
assignTaskSchema.index({ "partyName.address.marketName": 1 })
assignTaskSchema.index({ "partyName.address.area": 1 })

module.exports = mongoose.model("AssignTask", assignTaskSchema);