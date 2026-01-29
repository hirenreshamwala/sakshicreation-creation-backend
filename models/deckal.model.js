const mongoose = require('mongoose');

const DeckalSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('Deckal', DeckalSchema);