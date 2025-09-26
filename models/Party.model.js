// models/Party.js
const mongoose = require("mongoose");

const partySchema = new mongoose.Schema(
  {
    companyName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyName",
      required: true,
    },
    partyName: { type: String },
    ownerName: { type: String },
    ownerMobileNo: { type: String },
    ownerWhatsAppNo: { type: String, required: true },
    ownerEmail: { type: String, trim: true },
    contactPerson: { type: String },
    personMobileNo: { type: String },
    personWhatsAppNo: { type: String },
    contactPersonEmail: { type: String, trim: true },
    contactForPayment: { type: String },
    contactMobileNo: { type: String },
    contactWhatsAppNo: { type: String },
    contactForPaymentEmail: { type: String, trim: true },
    GSTNo: { type: String },
    address: {
      unitNo: { type: String },
      marketName: { type: mongoose.Schema.Types.ObjectId, ref: "Market" },
      // streetAddress: { type: mongoose.Schema.Types.ObjectId, ref: "Market" },
      landMark: { type: mongoose.Schema.Types.ObjectId, ref: "Market" },
      area: { type: mongoose.Schema.Types.ObjectId, ref: "Market" },
      pincode: { type: mongoose.Schema.Types.ObjectId, ref: "Market" },
    },
    partyTag: {
      type: String,
      // enum: ["New", "Customer"],
      default: "NEW",
    },
    statusApproval: {
      type: String,
      // enum: ["Pending", "APPROVED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

// Middleware to make all string fields uppercase
partySchema.pre("save", function (next) {
  const doc = this;

  function convertToUpper(obj, schemaObj) {
    for (let key in schemaObj) {
      const fieldType = schemaObj[key]?.instance;

      if (fieldType === "String" && typeof obj[key] === "string") {
        obj[key] = obj[key].toUpperCase();
      }

      // If field is a nested schema (object)
      if (schemaObj[key]?.instance === undefined && typeof obj[key] === "object" && obj[key] !== null) {
        convertToUpper(obj[key], schemaObj[key].schema?.paths || {});
      }
    }
  }

  convertToUpper(doc, this.schema.paths);
  next();
});


// Update partyTag based on Orders collection
partySchema.pre("save", async function (next) {
  if (this.isNew || this.isModified("partyName")) {
    const Order = mongoose.model("Order");
    const orderExists = await Order.findOne({ partyName: this.partyName });
    if (orderExists) {
      this.partyTag = "CUSTOMER";
    }
  }
  next();
});

const Party = mongoose.model("Party", partySchema);
module.exports = Party;
