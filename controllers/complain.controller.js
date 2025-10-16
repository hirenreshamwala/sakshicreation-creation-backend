const mongoose = require('mongoose');
const Complain = require('../models/complain.model');

// ====================== GET ALL COMPLAINS ======================
exports.getAllComplains = async (req, res) => {
    try {
        const complains = await Complain.find()
            .populate('company', 'companyName')
            .populate('scorder', 'orderNumber')
            .populate('qporder', 'orderNo')
            .populate({
                path: "party",
                select: "-__v",
                populate: [
                    { path: "address.marketName", model: "Market", select: "marketName" },
                    { path: "address.landMark", model: "Market", select: "landmark" },
                    { path: "address.area", model: "Market", select: "area" },
                    { path: "address.pincode", model: "Market", select: "pincode" },
                ],
            })
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
            .populate({
                path: "party",
                select: "-__v",
                populate: [
                    { path: "address.marketName", model: "Market", select: "marketName" },
                    { path: "address.landMark", model: "Market", select: "landmark" },
                    { path: "address.area", model: "Market", select: "area" },
                    { path: "address.pincode", model: "Market", select: "pincode" },
                ],
            });

        if (!complain) {
            return res.status(404).json({ success: false, message: 'Complain not found' });
        }

        res.status(200).json({ success: true, data: complain });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ====================== CREATE COMPLAIN ======================
exports.createComplain = async (req, res) => {
    try {
        const { 
            subject, 
            details, 
            company, 
            scorder, 
            qporder, 
            party, 
            createdBy, 
            assignTo, 
            status, 
            response,
            filePaths 
        } = req.body;

        // Parse assignTo if sent as a string or array
        let assignToArray = [];
        if (typeof assignTo === 'string') {
            try {
                assignToArray = JSON.parse(assignTo);
            } catch (e) {
                assignToArray = [assignTo];
            }
        } else if (Array.isArray(assignTo)) {
            assignToArray = assignTo;
        }

        // Handle filePaths - ensure it's an array
        const filePathsArray = Array.isArray(filePaths) ? filePaths : [];

        const complain = new Complain({
            subject,
            details,
            company,
            scorder: scorder || null,
            qporder: qporder || null,
            party,
            status: status || 'Pending',
            response: response || '',
            createdBy,
            assignTo: assignToArray,
            filePaths: filePathsArray,
        });

        await complain.save();

        // Populate after creation
        const populatedComplain = await Complain.findById(complain._id)
            .populate('company', 'companyName')
            .populate('scorder', 'orderNumber')
            .populate('qporder', 'orderNo')
            .populate('assignTo', 'firstName lastName')
            .populate('createdBy', 'firstName lastName');

        res.status(201).json({ success: true, data: populatedComplain });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ====================== UPDATE COMPLAIN ======================
exports.updateComplain = async (req, res) => {
    try {
        const { 
            subject, 
            details, 
            company, 
            scorder, 
            qporder, 
            party, 
            createdBy, 
            assignTo, 
            status, 
            response,
            filePaths 
        } = req.body;

        // Parse assignTo if sent as a string or array
        let assignToArray = [];
        if (typeof assignTo === 'string') {
            try {
                assignToArray = JSON.parse(assignTo);
            } catch (e) {
                assignToArray = [assignTo];
            }
        } else if (Array.isArray(assignTo)) {
            assignToArray = assignTo;
        }

        // Find existing complaint
        const complain = await Complain.findById(req.params.id);
        if (!complain) {
            return res.status(404).json({ success: false, message: 'Complain not found' });
        }

        // Handle filePaths - append new filePaths to existing ones
        const existingFilePaths = Array.isArray(complain.filePaths) ? complain.filePaths : [];
        const newFilePaths = Array.isArray(filePaths) ? filePaths : [];
        const allFilePaths = [...existingFilePaths, ...newFilePaths];

        // Update fields
        complain.subject = subject || complain.subject;
        complain.details = details || complain.details;
        complain.company = company || complain.company;
        complain.scorder = scorder || complain.scorder;
        complain.qporder = qporder || complain.qporder;
        complain.party = party || complain.party;
        complain.status = status || complain.status;
        complain.response = response || complain.response;
        complain.assignTo = assignToArray.length ? assignToArray : complain.assignTo;
        complain.filePaths = allFilePaths;

        await complain.save();

        // Populate after update
        const populatedComplain = await Complain.findById(complain._id)
            .populate('company', 'companyName')
            .populate('scorder', 'orderNumber')
            .populate('qporder', 'orderNo')
            .populate('assignTo', 'firstName lastName')
            .populate('createdBy', 'firstName lastName');

        res.status(200).json({ success: true, data: populatedComplain });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ====================== DELETE COMPLAIN ======================
exports.deleteComplain = async (req, res) => {
    try {
        const complain = await Complain.findById(req.params.id);
        if (!complain) {
            return res.status(404).json({ success: false, message: 'Complain not found' });
        }

        await Complain.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Complain deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ====================== GET COMPLAINS BY STAFF ======================
exports.getComplainsByStaff = async (req, res) => {
    try {
        const staffId = req.params.staffId;

        if (!mongoose.Types.ObjectId.isValid(staffId)) {
            return res.status(400).json({ success: false, message: 'Invalid staff ID' });
        }

        const complains = await Complain.find({ createdBy: staffId })
            .populate('company', 'companyName')
            .populate('scorder', 'orderNumber')
            .populate('qporder', 'orderNo')
            .populate({
                path: "party",
                select: "-__v",
                populate: [
                    { path: "address.marketName", model: "Market", select: "marketName" },
                    { path: "address.landMark", model: "Market", select: "landmark" },
                    { path: "address.area", model: "Market", select: "area" },
                    { path: "address.pincode", model: "Market", select: "pincode" },
                ],
            })
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