const mongoose = require('mongoose');
const Complain = require('../models/complain.model');
const Company = require('../models/companyName.model');
const QpData = require("../models/qpOrder.model");
const Party = require('../models/Party.model');
const Staff = require('../models/staff.model');
const Scorder = require('../models/order.model')

// ====================== GET ALL COMPLAINS ======================
// ====================== GET ALL COMPLAINS ======================
exports.getAllComplains = async (req, res) => {
    try {
        const {
            filters = {},
            search = "",
            startDate,
            endDate,
            isPagination = true,
            page = 1,
            pageSize = 10,
            includeCounts = true
        } = req.body;
        console.log("📊 Complains API - Request:", {
            filters,
            search,
            startDate,
            endDate,
            page,
            pageSize,
            isPagination
        });
        // Build query object
        const query = {};
        
        // Helper function to build multi-word search conditions
        const buildMultiWordSearch = (searchStr, fields) => {
            if (!searchStr || !searchStr.trim()) return [];
            const parts = searchStr.trim().split(/\s+/).filter(p => p.length > 0);
            if (parts.length === 0) return [];
            
            const partConditions = parts.map(part => ({
                $or: fields.map(field => ({
                    [field]: { $regex: part, $options: "i" }
                }))
            }));
            
            if (parts.length === 1) {
                return partConditions[0].$or;
            } else {
                return [{ $and: partConditions }];
            }
        };

        // Search functionality
        if (search && search.trim()) {
            const directOr = [
                { subject: { $regex: search, $options: "i" } },
                { details: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } },
                { response: { $regex: search, $options: "i" } },
            ];
            
            // Improved Company search with multi-word support
            const companyFields = ['companyName'];
            const companyConditions = buildMultiWordSearch(search, companyFields);
            if (companyConditions.length > 0) {
                const matchingCompanies = await Company.find({
                    $or: companyConditions
                }).select('_id').lean();
                const companyIds = matchingCompanies.map(c => c._id);
                if (companyIds.length > 0) {
                    directOr.push({ company: { $in: companyIds } });
                }
            }
            
            // Improved Party search with multi-word support
            const partyFields = ['partyName'];
            const partyConditions = buildMultiWordSearch(search, partyFields);
            if (partyConditions.length > 0) {
                const matchingParties = await Party.find({
                    $or: partyConditions
                }).select('_id').lean();
                const partyIds = matchingParties.map(p => p._id);
                if (partyIds.length > 0) {
                    directOr.push({ party: { $in: partyIds } });
                }
            }
            
            // Order number search - FIXED: Handle QP (numeric) and SC (string with prefix)
            const orderNoClean = search.replace(/[^A-Z0-9-]/g, ''); // Keep alphanum and -
            if (orderNoClean && orderNoClean !== '0') {
                // Try as-is for SC (e.g., "SC-108")
                const scOrders = await Scorder.find({ orderNumber: orderNoClean }).select('_id').lean();
                if (scOrders.length > 0) {
                    directOr.push({ scorder: { $in: scOrders.map(o => o._id) } });
                }
                // Extract numeric for QP (e.g., from "QP-108" or "108")
                const numStr = orderNoClean.replace(/[^0-9]/g, '');
                const num = parseInt(numStr, 10);
                if (!isNaN(num) && num > 0) {
                    const qpOrders = await QpData.find({ orderNo: num }).select('_id').lean();
                    if (qpOrders.length > 0) {
                        directOr.push({ qporder: { $in: qpOrders.map(o => o._id) } });
                    }
                }
            }
            
            // Improved Created by search with multi-word support
            const staffFields = ['firstName', 'lastName', 'email'];
            const staffConditions = buildMultiWordSearch(search, staffFields);
            if (staffConditions.length > 0) {
                const matchingStaff = await Staff.find({
                    $or: staffConditions
                }).select('_id').lean();
                const staffIds = matchingStaff.map(s => s._id);
                if (staffIds.length > 0) {
                    directOr.push({ createdBy: { $in: staffIds } });
                }
            }
            
            if (directOr.length > 0) {
                query.$or = directOr;
            }
        }
        
        // Date range filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.createdAt.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }
        
        // Company filter
        if (filters.company && filters.company.length > 0) {
            const companies = await Company.find({
                companyName: { $in: filters.company }
            }).select('_id').lean();
            if (companies.length > 0) {
                query.company = { $in: companies.map(c => c._id) };
            }
        }
        
        // Party filter
        if (filters.party && filters.party.length > 0) {
            const parties = await Party.find({
                partyName: { $in: filters.party }
            }).select('_id').lean();
            if (parties.length > 0) {
                query.party = { $in: parties.map(p => p._id) };
            }
        }
        
        // Status filter
        if (filters.status && filters.status.length > 0) {
            query.status = { $in: filters.status };
        }
        
        // Created by filter - FIXED: Handle array of names properly
        if (filters.createdBy && filters.createdBy.length > 0) {
            // Create regex for each name
            const nameConditions = filters.createdBy.map(name => {
                const parts = name.split(' ');
                if (parts.length === 2) {
                    return {
                        firstName: { $regex: `^${parts[0]}`, $options: "i" },
                        lastName: { $regex: `^${parts[1]}`, $options: "i" }
                    };
                } else {
                    return {
                        $or: [
                            { firstName: { $regex: `^${name}`, $options: "i" } },
                            { lastName: { $regex: `^${name}`, $options: "i" } }
                        ]
                    };
                }
            });
            const matchingStaff = await Staff.find({
                $or: nameConditions
            }).select('_id').lean();
          
            if (matchingStaff.length > 0) {
                query.createdBy = { $in: matchingStaff.map(s => s._id) };
            }
        }
        
        // Order number filter - FIXED: Separate QP (numeric) and SC (string with prefix)
        if (filters.orderNo && filters.orderNo.length > 0) {
            const qpOrderNos = [];
            const scOrderNos = [];
            filters.orderNo.forEach(no => {
                const noStr = String(no).toUpperCase();
                if (noStr.startsWith('QP-')) {
                    const num = parseInt(noStr.replace('QP-', ''), 10);
                    if (!isNaN(num) && num > 0) {
                        qpOrderNos.push(num);
                    }
                } else if (noStr.startsWith('SC-')) {
                    scOrderNos.push(String(no)); // Keep as "SC-108"
                } else {
                    // Fallback: try as QP numeric
                    const num = parseInt(noStr.replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(num) && num > 0) {
                        qpOrderNos.push(num);
                    }
                }
            });

            let orderConditions = [];
            // QP Orders (numeric)
            if (qpOrderNos.length > 0) {
                const qpOrders = await QpData.find({
                    orderNo: { $in: qpOrderNos }
                }).select('_id').lean();
              
                if (qpOrders.length > 0) {
                    orderConditions.push({ qporder: { $in: qpOrders.map(o => o._id) } });
                }
            }
            // SC Orders (string with prefix)
            if (scOrderNos.length > 0) {
                const scOrders = await Scorder.find({
                    orderNumber: { $in: scOrderNos }
                }).select('_id').lean();
              
                if (scOrders.length > 0) {
                    orderConditions.push({ scorder: { $in: scOrders.map(o => o._id) } });
                }
            }
            // Add to query.$or if conditions exist
            if (orderConditions.length > 0) {
                if (query.$or) {
                    query.$or = [...query.$or, ...orderConditions];
                } else {
                    query.$or = orderConditions;
                }
            }
        }
        
        // Subject filter
        if (filters.subject && filters.subject.length > 0) {
            query.subject = { $in: filters.subject };
        }
        
        console.log("📊 Complains - Final query:", JSON.stringify(query, null, 2));
        
        // Get total count
        const totalCount = await Complain.countDocuments(query);
        console.log("📊 Complains - Total count:", totalCount);
        
        // Common populate options
        const commonPopulate = [
            { path: "company", select: "companyName" },
            { path: "scorder", select: "orderNumber" },
            { path: "qporder", select: "orderNo" },
            { path: "assignTo", select: "firstName lastName" },
            { path: "createdBy", select: "firstName lastName" },
            {
                path: "party",
                select: "-__v",
                populate: [
                    { path: "address.marketName", model: "Market", select: "marketName" },
                    { path: "address.landMark", model: "Market", select: "landmark" },
                    { path: "address.area", model: "Market", select: "area" },
                    { path: "address.pincode", model: "Market", select: "pincode" },
                ],
            }
        ];
        
        let complains = [];
        if (isPagination) {
            // PAGINATED: Apply skip/limit
            const skip = (page - 1) * pageSize;
            complains = await Complain.find(query)
                .skip(skip)
                .limit(pageSize)
                .populate(commonPopulate)
                .sort({ createdAt: -1 });
        } else {
            // NON-PAGINATED: Fetch all data
            complains = await Complain.find(query)
                .populate(commonPopulate)
                .sort({ createdAt: -1 });
        }
        
        // Prepare response
        const pagination = isPagination ? {
            currentPage: parseInt(page),
            pageSize: parseInt(pageSize),
            totalCount: totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
            hasNext: page < Math.ceil(totalCount / pageSize),
            hasPrev: page > 1,
        } : null;
        
        res.status(200).json({
            success: true,
            data: complains,
            pagination: pagination,
            totalCount: totalCount,
            message: "Complains fetched successfully"
        });
    } catch (error) {
        console.error("❌ Error fetching complains:", error);
        res.status(500).json({
            success: false,
            message: 'Error fetching complains: ' + error.message,
        });
    }
};

// ====================== GET COMPLAIN FILTER OPTIONS ======================
exports.getComplainFilterOptions = async (req, res) => {
    try {
        const { field } = req.params;
        const filters = req.body || {};
        const { search = "", ...otherFilters } = filters;
        if (!field) {
            return res.status(400).json({
                success: false,
                message: "Field parameter is required"
            });
        }
        console.log("Complain Filter Options - Field:", field, "Filters:", otherFilters);
        const validFields = ['company', 'party', 'status', 'orderNo', 'subject', 'createdBy'];
      
        if (!validFields.includes(field)) {
            return res.status(400).json({
                success: false,
                message: `Invalid field parameter. Valid fields are: ${validFields.join(', ')}`
            });
        }
        
        // Build main query - SAME AS getAllComplains
        const query = {};
        
        // Apply filters from request
        if (otherFilters.company && otherFilters.company.length > 0) {
            const companies = await Company.find({
                companyName: { $in: otherFilters.company }
            }).select('_id').lean();
            if (companies.length > 0) {
                query.company = { $in: companies.map(c => c._id) };
            }
        }
        if (otherFilters.status && otherFilters.status.length > 0) {
            query.status = { $in: otherFilters.status };
        }
        if (otherFilters.staffId) {
            query.createdBy = otherFilters.staffId;
        }
        // Date range filter
        if (otherFilters.startDate || otherFilters.endDate) {
            query.createdAt = {};
            if (otherFilters.startDate) {
                const start = new Date(otherFilters.startDate);
                start.setHours(0, 0, 0, 0);
                query.createdAt.$gte = start;
            }
            if (otherFilters.endDate) {
                const end = new Date(otherFilters.endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }
        // Party filter
        if (otherFilters.party && otherFilters.party.length > 0) {
            const parties = await Party.find({
                partyName: { $in: otherFilters.party }
            }).select('_id').lean();
            if (parties.length > 0) {
                query.party = { $in: parties.map(p => p._id) };
            }
        }
        // Subject filter
        if (otherFilters.subject && otherFilters.subject.length > 0) {
            query.subject = { $in: otherFilters.subject };
        }
        // Order number filter - FIXED: Separate QP (numeric) and SC (string with prefix) for recursive filtering
        if (otherFilters.orderNo && otherFilters.orderNo.length > 0) {
            const qpOrderNos = [];
            const scOrderNos = [];
            otherFilters.orderNo.forEach(no => {
                const noStr = String(no).toUpperCase();
                if (noStr.startsWith('QP-')) {
                    const num = parseInt(noStr.replace('QP-', ''), 10);
                    if (!isNaN(num) && num > 0) {
                        qpOrderNos.push(num);
                    }
                } else if (noStr.startsWith('SC-')) {
                    scOrderNos.push(String(no));
                } else {
                    const num = parseInt(noStr.replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(num) && num > 0) {
                        qpOrderNos.push(num);
                    }
                }
            });

            let orderConditions = [];
            if (qpOrderNos.length > 0) {
                const qpOrders = await QpData.find({
                    orderNo: { $in: qpOrderNos }
                }).select('_id').lean();
                if (qpOrders.length > 0) {
                    orderConditions.push({ qporder: { $in: qpOrders.map(o => o._id) } });
                }
            }
            if (scOrderNos.length > 0) {
                const scOrdersFilter = await Scorder.find({
                    orderNumber: { $in: scOrderNos }
                }).select('_id').lean();
                if (scOrdersFilter.length > 0) {
                    orderConditions.push({ scorder: { $in: scOrdersFilter.map(o => o._id) } });
                }
            }
            if (orderConditions.length > 0) {
                if (query.$or) {
                    query.$or = [...query.$or, ...orderConditions];
                } else {
                    query.$or = orderConditions;
                }
            }
        }
        
        let uniqueValues = [];
        // Field-specific queries
        switch (field) {
            case "company":
                const companyIds = await Complain.distinct("company", query);
                const companies = await Company.find(
                    { _id: { $in: companyIds } },
                    "companyName"
                ).lean();
                uniqueValues = companies.map(c => c.companyName).filter(Boolean);
                break;
            case "party":
                const partyIds = await Complain.distinct("party", query);
                const parties = await Party.find(
                    { _id: { $in: partyIds } },
                    "partyName"
                ).lean();
                uniqueValues = parties.map(p => p.partyName).filter(Boolean);
                break;
            case "status":
                uniqueValues = await Complain.distinct("status", query);
                uniqueValues = uniqueValues.filter(val => val && String(val).trim() !== "");
                break;
            case "orderNo":
                // Get QP orders from complains that have qporder
                const qpOrderIds = await Complain.distinct("qporder", query);
                // Filter out null/undefined
                const validQpOrderIds = qpOrderIds.filter(id => id && mongoose.Types.ObjectId.isValid(id));
              
                let qpOrders = [];
                if (validQpOrderIds.length > 0) {
                    qpOrders = await QpData.find(
                        { _id: { $in: validQpOrderIds } },
                        "orderNo"
                    ).lean();
                }
              
                // Get SC orders from complains that have scorder
                const scOrderIds = await Complain.distinct("scorder", query);
                const validScOrderIds = scOrderIds.filter(id => id && mongoose.Types.ObjectId.isValid(id));
              
                let scOrders = [];
                if (validScOrderIds.length > 0) {
                    scOrders = await Scorder.find(
                        { _id: { $in: validScOrderIds } },
                        "orderNumber"
                    ).lean();
                }
              
                // Combine and process - FIXED: Format consistently with prefixes
                uniqueValues = [
                    ...qpOrders.map(o => `QP-${o.orderNo}`),
                    ...scOrders.map(o => String(o.orderNumber))
                ]
                    .filter(val => val && val.trim() !== "")
                    .filter(val => !val.endsWith("0") && parseInt(val.replace(/[^0-9]/g, ''), 10) > 0) // Exclude 0 and invalid
                    .filter((v, i, self) => self.indexOf(v) === i) // Remove duplicates
                    .sort((a, b) => {
                        const aNum = parseInt(a.replace(/[^0-9]/g, ''), 10);
                        const bNum = parseInt(b.replace(/[^0-9]/g, ''), 10);
                        return aNum - bNum;
                    }); // Sort numerically by extracted number
                break;
            case "createdBy":
                const createdByIds = await Complain.distinct("createdBy", query);
                const staffMembers = await Staff.find(
                    { _id: { $in: createdByIds } },
                    "firstName lastName"
                ).lean();
                uniqueValues = staffMembers.map(s => `${s.firstName || ""} ${s.lastName || ""}`.trim())
                    .filter(name => name !== "");
                break;
            case "subject":
                uniqueValues = await Complain.distinct("subject", query);
                uniqueValues = uniqueValues.filter(val => val && String(val).trim() !== "");
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid field parameter"
                });
        }
        
        // Apply search filter
        if (search && search.trim()) {
            const regex = new RegExp(search, 'i');
            uniqueValues = uniqueValues.filter(val => regex.test(String(val)));
        }
        
        // Remove duplicates and sort (for non-orderNo fields)
        if (field !== 'orderNo') {
            uniqueValues = uniqueValues
                .map(v => String(v))
                .filter(Boolean)
                .filter((v, i, self) => self.indexOf(v) === i)
                .sort((a, b) => a.localeCompare(b))
                .slice(0, 100); // Limit for safety
        } else {
            uniqueValues = uniqueValues.slice(0, 100); // Limit for safety
        }
        
        console.log(`✅ Complain Filter options for ${field}:`, uniqueValues.length, "items");
        res.status(200).json({
            success: true,
            data: uniqueValues,
            count: uniqueValues.length
        });
    } catch (err) {
        console.error("❌ Error loading complain filter options:", err);
        res.status(500).json({
            success: false,
            message: "Error loading filter options",
            error: err.message
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