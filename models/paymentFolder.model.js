const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Cheque", "NEFT", "UPI", "Other"],
      default: "Cash",
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
  },
  { _id: true }
);

const paymentFolderSchema = new mongoose.Schema(
  {
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
    month: {
      type: String,
    },
    paymentAmount: {
      type: Number,
      required: true,
    },
    area: {
      type: String,
    },
    assignTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssignTask",
      required: true,
    },
    // Remove individual receivedAmount and pendingAmount fields
    payments: [paymentSchema], // Array of payment objects
  },
  { timestamps: true }
);

// Virtual for calculated receivedAmount
paymentFolderSchema.virtual("receivedAmount").get(function () {
  return this.payments.reduce((total, payment) => total + payment.amount, 0);
});

// Virtual for calculated pendingAmount
paymentFolderSchema.virtual("pendingAmount").get(function () {
  return this.paymentAmount - this.receivedAmount;
});

// Ensure virtual fields are serialized
paymentFolderSchema.set("toJSON", { virtuals: true });
paymentFolderSchema.set("toObject", { virtuals: true });

const PaymentFolder = mongoose.model("PaymentFolder", paymentFolderSchema);
module.exports = PaymentFolder;
