const mongoose = require('mongoose');

const complainSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CompanyName"
    },
    scorder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order"
    },
    party:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Party"
    },
    qporder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "QpOrder"
    },
    subject: {
        type: String,
    },
    details: {
        type: String,
    },
    status: {
        type: String,
    },
    response: {
        type: String,
    },
    assignTo: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Staff",
    }], 
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Staff",
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('Complain', complainSchema);