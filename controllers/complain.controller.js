const mongoose = require('mongoose');
const Complain = require('../models/complain.model');


// ====================== GET ALL COMPLAINS ======================
exports.getAllComplains = async (req, res) => {
    try {
        const complains = await Complain.find()
            .populate('company', 'companyName')
            .populate('scorder', 'orderNumber')
            .populate('qporder', 'orderNo')
            .populate('assignTo', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: complains.length,
            data: complains,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching complains: ' + error.message,
        });
    }
};

// ====================== GET SINGLE COMPLAIN ======================
exports.getComplain = async (req, res) => {
    try {
        const complain = await Complain.findById(req.params.id)
            .populate('company', 'companyName')
            .populate('scorder', 'orderNumber')
            .populate('qporder', 'orderNo')
            .populate('assignTo', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')

        if (!complain) {
            return res.status(404).json({ success: false, message: 'Complain not found' });
        }

        res.status(200).json({ success: true, data: complain });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ====================== CREATE COMPLAIN WITH POPULATE ======================
exports.createComplain = async (req, res) => {
    try {
        const complain = new Complain(req.body);
        await complain.save();

        // Populate after creation
        const populatedComplain = await Complain.findById(complain._id)
           .populate('company', 'companyName')
            .populate('scorder', 'orderNumber')
            .populate('qporder', 'orderNo')
            .populate('assignTo', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')

        res.status(201).json({ success: true, data: populatedComplain });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ====================== UPDATE COMPLAIN ======================
exports.updateComplain = async (req, res) => {
  try {
    console.log("DEBUG : req.body:", req.body);
    console.log("DEBUG : req.params.id:", req.params.id);

    // Exclude createdBy from the update payload
    const { createdBy, ...updateData } = req.body;

    const complain = await Complain.findByIdAndUpdate(
      req.params.id,
      updateData, // Use filtered data without createdBy
      { new: true }
    )
      .populate("company", "companyName")
      .populate("scorder", "orderNumber")
      .populate("qporder", "orderNo")
      .populate("assignTo", "firstName lastName")
      .populate("createdBy", "firstName lastName");

    if (!complain) {
      return res.status(404).json({ success: false, message: "Complain not found" });
    }

    res.status(200).json({ success: true, data: complain });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ====================== DELETE COMPLAIN ======================
exports.deleteComplain = async (req, res) => {
    try {
        const complain = await Complain.findByIdAndDelete(req.params.id);
        if (!complain) {
            return res.status(404).json({ success: false, message: 'Complain not found' });
        }
        res.status(200).json({ success: true, message: 'Complain deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getComplainsByStaff = async (req, res) => {
    try {
        const staffId = req.params.staffId; // get staff ID from request params

        if (!mongoose.Types.ObjectId.isValid(staffId)) {
            return res.status(400).json({ success: false, message: 'Invalid staff ID' });
        }

        const complains = await Complain.find({ createdBy: staffId })
            .populate('company', 'companyName')
            .populate('scorder', 'orderNumber')
            .populate('qporder', 'orderNo')
            .populate('assignTo', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: complains.length,
            data: complains,
        });
    } catch (error) {
        console.error('Error fetching complains by staff:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching complains by staff: ' + error.message,
        });
    }
};