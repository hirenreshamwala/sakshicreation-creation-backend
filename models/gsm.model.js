const mongoose = require('mongoose');

const GsmSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Ply name is required'],
    trim: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('Gsm', GsmSchema);