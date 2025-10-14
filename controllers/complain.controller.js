const mongoose = require('mongoose');
const Complain = require('../models/complain.model');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer Configuration (as defined above)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/complaints');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, PNG, JPG, JPEG allowed.'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter,
});

// Serve uploaded files statically (add to your main app.js or server.js)
const express = require('express');
const app = express();
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Helper function to delete files from the filesystem
const deleteFiles = (filePaths) => {
    filePaths.forEach(filePath => {
        const fullPath = path.join(__dirname, '../', filePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    });
};

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
                    // { path: "address.streetAddress", model: "Market", select: "streetAddress" },
                    { path: "address.landMark", model: "Market", select: "landmark" },
                    { path: "address.area", model: "Market", select: "area" },
                    { path: "address.pincode", model: "Market", select: "pincode" },
                ],
            })
            .populate('assignTo', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 });

        // Transform file paths to URLs
        const transformedComplains = complains.map(complain => ({
            ...complain._doc,
            files: complain.files.map(file => `${req.protocol}://${req.get('host')}/uploads/complaints/${path.basename(file)}`),
        }));

        res.status(200).json({
            success: true,
            count: transformedComplains.length,
            data: transformedComplains,
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
                    // { path: "address.streetAddress", model: "Market", select: "streetAddress" },
                    { path: "address.landMark", model: "Market", select: "landmark" },
                    { path: "address.area", model: "Market", select: "area" },
                    { path: "address.pincode", model: "Market", select: "pincode" },
                ],
            })

        if (!complain) {
            return res.status(404).json({ success: false, message: 'Complain not found' });
        }

        // Transform file paths to URLs
        const transformedComplain = {
            ...complain._doc,
            files: complain.files.map(file => `${req.protocol}://${req.get('host')}/uploads/complaints/${path.basename(file)}`),
        };

        res.status(200).json({ success: true, data: transformedComplain });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ====================== CREATE COMPLAIN WITH POPULATE ======================
exports.createComplain = async (req, res) => {
    try {
        // Apply Multer middleware for file uploads
        upload.array('files', 25)(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }

            try {
                const { subject, details, company, scorder, qporder, party, createdBy, assignTo, status, response } = req.body;

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

                // Get uploaded file paths
                const files = req.files ? req.files.map(file => file.path) : [];

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
                    files,
                });

                await complain.save();

                // Populate after creation
                const populatedComplain = await Complain.findById(complain._id)
                    .populate('company', 'companyName')
                    .populate('scorder', 'orderNumber')
                    .populate('qporder', 'orderNo')
                    .populate('assignTo', 'firstName lastName')
                    .populate('createdBy', 'firstName lastName');

                // Transform file paths to URLs
                const transformedComplain = {
                    ...populatedComplain._doc,
                    files: populatedComplain.files.map(file => `${req.protocol}://${req.get('host')}/uploads/complaints/${path.basename(file)}`),
                };

                res.status(201).json({ success: true, data: transformedComplain });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ====================== UPDATE COMPLAIN ======================
exports.updateComplain = async (req, res) => {
    try {
        // Apply Multer middleware for file uploads
        upload.array('files', 25)(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }

            try {
                const { subject, details, company, scorder, qporder, party, createdBy, assignTo, status, response } = req.body;

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

                // Get new uploaded file paths
                const newFiles = req.files ? req.files.map(file => file.path) : [];

                // Find existing complaint
                const complain = await Complain.findById(req.params.id);
                if (!complain) {
                    return res.status(404).json({ success: false, message: 'Complain not found' });
                }

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
                complain.files = [...complain.files, ...newFiles]; // Append new files

                await complain.save();

                // Populate after update
                const populatedComplain = await Complain.findById(complain._id)
                    .populate('company', 'companyName')
                    .populate('scorder', 'orderNumber')
                    .populate('qporder', 'orderNo')
                    .populate('assignTo', 'firstName lastName')
                    .populate('createdBy', 'firstName lastName');

                // Transform file paths to URLs
                const transformedComplain = {
                    ...populatedComplain._doc,
                    files: populatedComplain.files.map(file => `${req.protocol}://${req.get('host')}/uploads/complaints/${path.basename(file)}`),
                };

                res.status(200).json({ success: true, data: transformedComplain });
            } catch (error) {
                res.status(500).json({ success: false, message: error.message });
            }
        });
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

        // Delete associated files from filesystem
        if (complain.files && complain.files.length) {
            deleteFiles(complain.files);
        }

        await Complain.findByIdAndDelete(req.params.id);
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
            .populate({
                path: "party",
                select: "-__v",
                populate: [
                    { path: "address.marketName", model: "Market", select: "marketName" },
                    // { path: "address.streetAddress", model: "Market", select: "streetAddress" },
                    { path: "address.landMark", model: "Market", select: "landmark" },
                    { path: "address.area", model: "Market", select: "area" },
                    { path: "address.pincode", model: "Market", select: "pincode" },
                ],
            })
            .populate('assignTo', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 });

        // Transform file paths to URLs
        const transformedComplains = complains.map(complain => ({
            ...complain._doc,
            files: complain.files.map(file => `${req.protocol}://${req.get('host')}/uploads/complaints/${path.basename(file)}`),
        }));

        res.status(200).json({
            success: true,
            count: transformedComplains.length,
            data: transformedComplains,
        });
    } catch (error) {
        console.error('Error fetching complains by staff:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching complains by staff: ' + error.message,
        });
    }
};