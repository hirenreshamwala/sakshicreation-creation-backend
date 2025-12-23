const ExcelJS = require('exceljs');
const { getAllAccountMasters } = require('./accountMaster.controller'); // Assuming the original function is in this file
const { getAllAssignTasksForExcel } = require('./assignTask.controller');
const assignTaskModel = require('../models/assignTask.model');
const mongoose = require('mongoose');
const Lead = require('../models/lead.model');
const { getAllOrdersPagination } = require('./order.controller');
const { getAllQpOrdersForDriver } = require('./qpOrder.controller');

const Order = require("../models/order.model");
const CompanyName = require("../models/companyName.model");
// const Lead = require("../models/lead.model");
const Role = require("../models/role.model");
const Staff = require("../models/staff.model");
const moment = require("moment");
const Complain = require('../models/complain.model'); 
const Party = require("../models/Party.model");
const QpData = require("../models/qpOrder.model");
const PaymentFolder = require('../models/paymentFolder.model');

exports.exportAccountMastersToExcel = async (req, res) => {
    try {
        // Create a mock request object with pagination disabled
        const mockReq = {
            body: {
                ...req.body,
                isPagination: false,
                includeCounts: false
            }
        };

        // Create a mock response object to capture the data
        let responseData;
        const mockRes = {
            status: () => ({
                json: (data) => {
                    responseData = data;
                }
            })
        };

        // Reuse the existing controller logic to get filtered data
        await getAllAccountMasters(mockReq, mockRes);

        if (!responseData || !responseData.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch account masters for export"
            });
        }

        // Create a new Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Account Masters');

        // Define columns
        worksheet.columns = [
            { header: 'Sr No', key: 'srNo', width: 10 },
            // { header: 'Company', key: 'company', width: 20 },
            { header: 'Created Date', key: 'createdDate', width: 20 },
            { header: 'Party Name', key: 'party', width: 30 },
            { header: 'Unit No', key: 'unitNo', width: 15 },
            { header: 'Market', key: 'market', width: 20 },
            { header: 'Area', key: 'area', width: 15 },
            { header: 'Contact Person', key: 'contactPerson', width: 20 },
            { header: 'Mobile No.', key: 'mobileNo', width: 15 },
            { header: 'Party Tag', key: 'partyTag', width: 15 },
            // { header: 'Reason to Visit', key: 'reasonToVisit', width: 20 },
            // { header: 'Remarks', key: 'remarks', width: 20 },
            // { header: 'Status', key: 'status', width: 15 },
            { header: 'Created By', key: 'createdBy', width: 20 },
            // { header: 'Assign', key: 'assign', width: 20 }
        ];

        // Format and add data rows
        responseData.data.forEach((account, index) => {
            console.log("DEBUG : account:", account);

            worksheet.addRow({
                srNo: index + 1,
                company: account.companyName?.companyName || '',
                createdDate: new Date(account.createdAt).toLocaleDateString(),
                party: account.party?.partyName || '',
                contactPerson: account.party?.contactPerson || '',
                partyTag: account.party?.partyTag || '',
                mobileNo: account.party?.personMobileNo || account.party?.ownerMobileNo || '',
                reasonToVisit: account.reasonToVisit || '',
                unitNo: account.party?.address?.unitNo || '',
                market: account.party?.address?.marketName || '',
                area: account.party?.address?.area || '',
                remarks: account.latestTask?.remarks || '',
                status: account.party?.statusApproval || '',
                createdBy: `${account.createdBy?.firstName || ''} ${account.createdBy?.lastName || ''}`.trim(),
                assign: `${account.latestTask?.assignTo?.firstName || ''} ${account.latestTask?.assignTo?.lastName || ''}`.trim()
            });
        });
        console.log("DEBUG : responseData:", responseData);


        // Style the header row
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' }
            };
        });

        // Set response headers for Excel download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=AccountMasters.xlsx');

        // Write the Excel file to the response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Error exporting account masters to Excel:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export account masters to Excel",
            error: error.message,
        });
    }
};

const getTasksDataForExcel = async (req) => {
    try {
        const {
            staffId,
            startDate,
            endDate,
            status,
            companyName,
            partyName,
            reason,
            priority,
            date,
            unitNo,
            marketName,
            mobile,
            createdBy,
            assignToFilter,
            party,
            area,
            search,
        } = req.body;

        // Build match conditions
        const matchConditions = {};

        /* ================================
           DATE RANGE FILTER - Updated as per getAllAssignTasks
        ================================ */
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            matchConditions.date = {
                $gte: startOfDay,
                $lte: endOfDay,
            };
        } else if (startDate && endDate) {
            matchConditions.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        /* ================================
           SEARCH FUNCTIONALITY
        ================================ */
        if (search && search.trim() !== '') {
            const searchRegex = { $regex: search, $options: 'i' };

            // Create a separate search condition object
            const searchCondition = {
                $or: [
                    { "companyData.companyName": searchRegex },
                    { "partyData.partyName": searchRegex },
                    { "assignToData.firstName": searchRegex },
                    { "assignToData.lastName": searchRegex },
                    { "partyData.ownerMobileNo": searchRegex },
                    { "partyData.personMobileNo": searchRegex },
                    { "partyData.contactMobileNo": searchRegex },
                    { "partyData.ownerWhatsAppNo": searchRegex },
                    { "partyData.personWhatsAppNo": searchRegex },
                    { "partyData.contactWhatsAppNo": searchRegex },
                    { "partyData.address.unitNo": searchRegex },
                    { "marketNameData.marketName": searchRegex },
                    { "areaData.area": searchRegex },
                    { reasonForVisit: searchRegex },
                    { status: searchRegex },
                    { remarks: searchRegex },
                    { feedback: searchRegex },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $concat: ["$assignToData.firstName", " ", "$assignToData.lastName"] },
                                regex: search,
                                options: "i"
                            }
                        }
                    },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $concat: ["$accountData.createdByData.firstName", " ", "$accountData.createdByData.lastName"] },
                                regex: search,
                                options: "i"
                            }
                        }
                    }
                ]
            };

            // If there are existing conditions, combine with $and
            if (Object.keys(matchConditions).length > 0) {
                // Create a new object to avoid circular references
                const combinedConditions = {
                    $and: [
                        { ...matchConditions }, // Spread existing conditions
                        searchCondition
                    ]
                };

                // Replace matchConditions with the new combined conditions
                Object.keys(matchConditions).forEach(key => delete matchConditions[key]);
                Object.assign(matchConditions, combinedConditions);
            } else {
                // No existing conditions, just use the search condition
                Object.assign(matchConditions, searchCondition);
            }
        }

        /* ================================
           COMPANY FILTER
        ================================ */
        if (companyName) {
            if (mongoose.Types.ObjectId.isValid(companyName)) {
                matchConditions.companyName = new mongoose.Types.ObjectId(companyName);
            } else {
                matchConditions["companyData.companyName"] = {
                    $regex: companyName,
                    $options: "i",
                };
            }
        }

        /* ================================
           STATUS FILTER
        ================================ */
        if (status && status.length > 0) {
            const statusArray = Array.isArray(status) ? status : status.split(",");
            matchConditions.status = {
                $in: statusArray.map((s) => new RegExp(`^${s}$`, "i")),
            };
        }

        /* ================================
           PRIORITY FILTER
        ================================ */
        if (priority) {
            matchConditions.priority = new RegExp(`^${priority}$`, "i");
        }

        /* ================================
           ASSIGN TO FILTER (staffId parameter)
        ================================ */
        if (staffId) {
            if (mongoose.Types.ObjectId.isValid(staffId)) {
                matchConditions.assignTo = new mongoose.Types.ObjectId(staffId);
            } else {
                const staffs = await mongoose.model("Staff").find({
                    $or: [
                        { firstName: { $regex: staffId, $options: "i" } },
                        { lastName: { $regex: staffId, $options: "i" } },
                        {
                            $expr: {
                                $regexMatch: {
                                    input: { $concat: ["$firstName", " ", "$lastName"] },
                                    regex: staffId,
                                    options: "i"
                                }
                            }
                        }
                    ]
                }).select("_id");

                if (staffs.length > 0) {
                    const staffIds = staffs.map(staff => staff._id);
                    matchConditions.assignTo = { $in: staffIds };
                } else {
                    return {
                        success: true,
                        data: [],
                        count: 0,
                    };
                }
            }
        }

        /* ================================
           PARTY NAME FILTER
        ================================ */
        if (partyName) {
            if (mongoose.Types.ObjectId.isValid(partyName)) {
                matchConditions.partyName = new mongoose.Types.ObjectId(partyName);
            } else {
                const parties = await mongoose.model("Party").find({
                    partyName: { $regex: partyName, $options: "i" }
                }).select("_id");

                if (parties.length > 0) {
                    const partyIds = parties.map(party => party._id);
                    matchConditions.partyName = { $in: partyIds };
                } else {
                    return {
                        success: true,
                        data: [],
                        count: 0,
                    };
                }
            }
        }

        /* ================================
           UNIT NO FILTER
        ================================ */
        if (unitNo) {
            const unitNos = unitNo.split(',').map(u => u.trim()).filter(u => u);
            if (unitNos.length > 0) {
                matchConditions["partyData.address.unitNo"] = {
                    $in: unitNos.map(unit => new RegExp(`^${unit}$`, "i"))
                };
            }
        }

        /* ================================
           MARKET NAME FILTER
        ================================ */
        if (marketName) {
            const marketNames = marketName.split(',').map(m => m.trim()).filter(m => m);
            if (marketNames.length > 0) {
                matchConditions["marketNameData.marketName"] = {
                    $in: marketNames.map(name => new RegExp(name, "i"))
                };
            }
        }

        /* ================================
           MOBILE NUMBER FILTER
        ================================ */
        if (mobile) {
            matchConditions.$or = matchConditions.$or || [];
            matchConditions.$or.push(
                { "partyData.ownerMobileNo": { $regex: mobile, $options: "i" } },
                { "partyData.personMobileNo": { $regex: mobile, $options: "i" } },
                { "partyData.contactMobileNo": { $regex: mobile, $options: "i" } },
                { "partyData.ownerWhatsAppNo": { $regex: mobile, $options: "i" } },
                { "partyData.personWhatsAppNo": { $regex: mobile, $options: "i" } },
                { "partyData.contactWhatsAppNo": { $regex: mobile, $options: "i" } }
            );
        }

        /* ================================
           REASON FOR VISIT FILTER
        ================================ */
        if (reason) {
            const reasons = reason.split(',').map(r => r.trim()).filter(r => r);
            if (reasons.length > 0) {
                matchConditions.reasonForVisit = {
                    $in: reasons.map(r => new RegExp(r, "i"))
                };
            }
        }

        /* ================================
           CREATED BY FILTER
        ================================ */
        if (createdBy) {
            const createdByNames = createdBy.split(',').map(name => name.trim()).filter(name => name);
            const createdByConditions = [];

            createdByNames.forEach(name => {
                const parts = name.split(' ').filter(Boolean);
                const firstNamePart = parts[0] || "";
                const lastNamePart = parts.slice(1).join(" ") || "";

                const nameCondition = {
                    $or: []
                };

                if (firstNamePart) {
                    nameCondition.$or.push(
                        { "accountData.createdByData.firstName": { $regex: firstNamePart, $options: "i" } }
                    );
                }

                if (lastNamePart) {
                    nameCondition.$or.push(
                        { "accountData.createdByData.lastName": { $regex: lastNamePart, $options: "i" } }
                    );
                }

                if (firstNamePart && lastNamePart) {
                    nameCondition.$or.push({
                        $expr: {
                            $regexMatch: {
                                input: {
                                    $concat: [
                                        "$accountData.createdByData.firstName",
                                        " ",
                                        "$accountData.createdByData.lastName",
                                    ],
                                },
                                regex: name,
                                options: "i",
                            },
                        },
                    });
                }

                if (nameCondition.$or.length > 0) {
                    createdByConditions.push(nameCondition);
                }
            });

            if (createdByConditions.length > 0) {
                matchConditions.$and = matchConditions.$and || [];
                matchConditions.$and.push({ $or: createdByConditions });
            }
        }

        /* ================================
           ASSIGN TO FILTER (assignToFilter)
        ================================ */
        if (assignToFilter) {
            const assignToNames = assignToFilter.split(',').map(name => name.trim()).filter(name => name);
            let allStaffIds = [];

            for (const name of assignToNames) {
                const staffs = await mongoose.model("Staff").find({
                    $or: [
                        { firstName: { $regex: name, $options: "i" } },
                        { lastName: { $regex: name, $options: "i" } },
                        {
                            $expr: {
                                $regexMatch: {
                                    input: { $concat: ["$firstName", " ", "$lastName"] },
                                    regex: name,
                                    options: "i"
                                }
                            }
                        }
                    ]
                }).select("_id");

                const staffIds = staffs.map(staff => staff._id);
                allStaffIds = [...allStaffIds, ...staffIds];
            }

            if (allStaffIds.length > 0) {
                if (matchConditions.assignTo) {
                    // If assignTo already exists, combine with $and
                    const existingCondition = matchConditions.assignTo;
                    delete matchConditions.assignTo;

                    matchConditions.$and = matchConditions.$and || [];
                    matchConditions.$and.push(
                        existingCondition,
                        { assignTo: { $in: allStaffIds } }
                    );
                } else {
                    matchConditions.assignTo = { $in: allStaffIds };
                }
            } else {
                return {
                    success: true,
                    data: [],
                    count: 0,
                };
            }
        }

        /* ================================
           PARTY FILTER
        ================================ */
        if (party) {
            const partyNames = party.split(',').map(p => p.trim()).filter(p => p);
            if (partyNames.length > 0) {
                matchConditions["partyData.partyName"] = {
                    $in: partyNames.map(name => new RegExp(name, "i"))
                };
            }
        }

        /* ================================
           AREA FILTER
        ================================ */
        if (area) {
            const areaNames = area.split(',').map(a => a.trim()).filter(a => a);
            if (areaNames.length > 0) {
                matchConditions["areaData.area"] = {
                    $in: areaNames.map(name => new RegExp(name, "i"))
                };
            }
        }

        const pipeline = [
            // 1. TASK → COMPANY
            {
                $lookup: {
                    from: "companynames",
                    localField: "companyName",
                    foreignField: "_id",
                    as: "companyData"
                }
            },
            { $unwind: { path: "$companyData", preserveNullAndEmptyArrays: true } },

            // 2. TASK → PARTY
            {
                $lookup: {
                    from: "parties",
                    localField: "partyName",
                    foreignField: "_id",
                    as: "partyData"
                }
            },
            { $unwind: { path: "$partyData", preserveNullAndEmptyArrays: true } },

            // 3. TASK → ASSIGN TO (STAFF)
            {
                $lookup: {
                    from: "staffs",
                    localField: "assignTo",
                    foreignField: "_id",
                    as: "assignToData"
                }
            },
            { $unwind: { path: "$assignToData", preserveNullAndEmptyArrays: true } },

            // 4. STAFF → ROLE
            {
                $lookup: {
                    from: "roles",
                    localField: "assignToData.role",
                    foreignField: "_id",
                    as: "assignToData.roleData"
                }
            },
            { $unwind: { path: "$assignToData.roleData", preserveNullAndEmptyArrays: true } },

            // 5. PARTY ADDRESS → MARKET NAME
            {
                $lookup: {
                    from: "markets",
                    localField: "partyData.address.marketName",
                    foreignField: "_id",
                    as: "marketNameData"
                }
            },

            // 6. PARTY ADDRESS → AREA
            {
                $lookup: {
                    from: "markets",
                    localField: "partyData.address.area",
                    foreignField: "_id",
                    as: "areaData"
                }
            },

            // 7. ACCOUNT MASTER FOR CREATED BY
            {
                $lookup: {
                    from: "accountmasters",
                    let: { partyId: "$partyName", companyId: "$companyName" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$party", "$$partyId"] },
                                        { $eq: ["$companyName", "$$companyId"] }
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: "staffs",
                                localField: "createdBy",
                                foreignField: "_id",
                                as: "createdByData"
                            }
                        },
                        { $unwind: "$createdByData" }
                    ],
                    as: "accountData"
                }
            },
            { $unwind: { path: "$accountData", preserveNullAndEmptyArrays: true } },

            // Apply all match conditions
            { $match: matchConditions },

            // Sort by createdAt
            { $sort: { createdAt: -1 } },

            // Project only required fields for Excel
            {
                $project: {
                    _id: 0,
                    // DATE - Format date as YYYY-MM-DD
                    DATE: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$date"
                        }
                    },
                    // PARTY NAME
                    "PARTY NAME": "$partyData.partyName",
                    // UNIT NO
                    "UNIT NO": "$partyData.address.unitNo",
                    // MKT NAME
                    "MKT NAME": { $arrayElemAt: ["$marketNameData.marketName", 0] },
                    // AREA
                    AREA: { $arrayElemAt: ["$areaData.area", 0] },
                    // CONTACT PERSON - Choose appropriate contact person
                    "CONTACT P": {
                        $cond: {
                            if: { $and: ["$partyData.contactPerson", { $ne: ["$partyData.contactPerson", ""] }] },
                            then: "$partyData.contactPerson",
                            else: "$partyData.ownerName"
                        }
                    },
                    // MOBILE NO - Choose appropriate mobile number
                    "MOBILE NO": {
                        $cond: {
                            if: { $and: ["$partyData.contactMobileNo", { $ne: ["$partyData.contactMobileNo", ""] }] },
                            then: "$partyData.contactMobileNo",
                            else: {
                                $cond: {
                                    if: { $and: ["$partyData.personMobileNo", { $ne: ["$partyData.personMobileNo", ""] }] },
                                    then: "$partyData.personMobileNo",
                                    else: "$partyData.ownerMobileNo"
                                }
                            }
                        }
                    },
                    // TAG
                    TAG: "$partyData.partyTag",
                    // STATUS
                    STATUS: "$status",
                    // REMARKS
                    REMARKS: "$remarks",
                    // FEEDBACK
                    FEEDBACK: "$feedback",
                    // Additional useful fields for reference
                    "REASON FOR VISIT": "$reasonForVisit",
                    "ASSIGNED TO": {
                        $concat: ["$assignToData.firstName", " ", "$assignToData.lastName"]
                    },
                    "CREATED BY": {
                        $cond: {
                            if: { $and: ["$accountData.createdByData", "$accountData.createdByData.firstName"] },
                            then: {
                                $concat: [
                                    { $ifNull: ["$accountData.createdByData.firstName", ""] },
                                    " ",
                                    { $ifNull: ["$accountData.createdByData.lastName", ""] }
                                ]
                            },
                            else: "N/A"
                        }
                    },
                    "COMPANY NAME": "$companyData.companyName",
                    "VISIT DATE": {
                        $cond: {
                            if: "$visitDate",
                            then: { $dateToString: { format: "%Y-%m-%d", date: "$visitDate" } },
                            else: "Not Visited"
                        }
                    },
                    "VISIT TIME": "$visitTime",
                    PRIORITY: "$priority"
                }
            }
        ];

        const tasks = await assignTaskModel.aggregate(pipeline);

        return {
            success: true,
            count: tasks.length,
            data: tasks,
        };

    } catch (error) {
        console.error("getTasksDataForExcel Error:", error);
        return {
            success: false,
            message: "Failed to fetch tasks for Excel",
            error: error.message,
        };
    }
};


// API function to export tasks to Excel (returns Excel file)
exports.exportAssignTasksToExcel = async (req, res) => {
    try {
        // Get data using helper function
        const result = await getTasksDataForExcel(req);

        if (!result.success || !result.data || result.data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No data found to export'
            });
        }

        const tasks = result.data;

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Assign Tasks');

        // Helper function to format date (Account Masters के जैसा)
        const formatDate = (dateString) => {
            if (!dateString) return '';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString();
            } catch (error) {
                return dateString;
            }
        };

        // Define only required columns
        worksheet.columns = [
            { header: 'Sr no', key: 'Sr no', width: 10 },
            { header: 'ASSIGN DATE', key: 'DATE', width: 12 },
            { header: 'PARTY NAME', key: 'PARTY NAME', width: 25 },
            { header: 'UNIT NO', key: 'UNIT NO', width: 12 },
            { header: 'MKT NAME', key: 'MKT NAME', width: 20 },
            { header: 'AREA', key: 'AREA', width: 20 },
            { header: 'CONTACT P', key: 'CONTACT P', width: 20 },
            { header: 'MOBILE NO', key: 'MOBILE NO', width: 15 },
            { header: 'TAG', key: 'TAG', width: 10 },
            { header: 'STATUS', key: 'STATUS', width: 12 },
            { header: 'REMARKS', key: 'REMARKS', width: 25 },
            { header: 'FEEDBACK', key: 'FEEDBACK', width: 25 }
        ];

        // Add data rows with only required fields
        tasks.forEach((task, index) => {
            console.log("DEBUG : task:", task);

            worksheet.addRow({
                'Sr no': index + 1,
                DATE: formatDate(task.DATE) || '', // यहाँ formatting apply करें
                'PARTY NAME': task['PARTY NAME'] || '',
                'UNIT NO': task['UNIT NO'] || '',
                'MKT NAME': task['MKT NAME'] || '',
                AREA: task.AREA || '',
                'CONTACT P': task['CONTACT P'] || '',
                'MOBILE NO': task['MOBILE NO'] || '',
                TAG: task.TAG || '',
                STATUS: task.STATUS || '',
                REMARKS: task.REMARKS || '',
                FEEDBACK: task.FEEDBACK || ''
            });
        });

        // Style the header row
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' }
            };
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength + 2;
        });

        // Set response headers for Excel download
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="assign_tasks_${new Date().toISOString().split('T')[0]}.xlsx"`
        );

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Error exporting assign tasks to Excel:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export tasks to Excel",
            error: error.message
        });
    }
};

const getLeadsDataForExcel = async (req) => {
    try {
        const {
            status,
            partyName,
            companyName,
            startDate,
            endDate,
            assignedTo,
            staffId,
            date,
            search,
            mobile,
            unitNo,
            marketName,
            area,
            partyTag,
            createdBy,
            assignedToFilter,
            reason,
        } = req.body;

        console.log("DEBUG : req.body:", req.body);

        // Build match conditions
        const matchConditions = {};

        /* ================================
           DATE RANGE FILTER
        ================================ */
        if (date) {
            const [day, month, year] = date.split('/');
            const startOfDay = new Date(`${year}-${month}-${day}`);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(`${year}-${month}-${day}`);
            endOfDay.setHours(23, 59, 59, 999);
            
            matchConditions.date = {
                $gte: startOfDay,
                $lte: endOfDay,
            };
        } else if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            
            matchConditions.date = {
                $gte: start,
                $lte: end,
            };
        }

        /* ================================
           SEARCH FUNCTIONALITY
        ================================ */
        if (search && search.trim() !== '') {
            const searchRegex = { $regex: search, $options: 'i' };
            
            const searchCondition = {
                $or: [
                    { "partyData.partyName": searchRegex },
                    { "partyData.ownerName": searchRegex },
                    { "partyData.ownerMobileNo": searchRegex },
                    { "partyData.ownerWhatsAppNo": searchRegex },
                    { "partyData.contactPerson": searchRegex },
                    { "partyData.personMobileNo": searchRegex },
                    { "partyData.personWhatsAppNo": searchRegex },
                    { "partyData.contactForPayment": searchRegex },
                    { "partyData.contactMobileNo": searchRegex },
                    { "partyData.contactWhatsAppNo": searchRegex },
                    { "companyData.companyName": searchRegex },
                    { reason: searchRegex },
                    { "marketNameData.marketName": searchRegex },
                    { "areaData.area": searchRegex },
                    { "assignedToData.firstName": searchRegex },
                    { "assignedToData.lastName": searchRegex },
                    { "assignedToData.email": searchRegex },
                    { "accountData.createdBy.firstName": searchRegex },
                    { "accountData.createdBy.lastName": searchRegex },
                ]
            };

            if (Object.keys(matchConditions).length > 0) {
                const combinedConditions = {
                    $and: [
                        { ...matchConditions },
                        searchCondition
                    ]
                };
                Object.keys(matchConditions).forEach(key => delete matchConditions[key]);
                Object.assign(matchConditions, combinedConditions);
            } else {
                Object.assign(matchConditions, searchCondition);
            }
        }

        /* ================================
           STATUS FILTER (multiple allowed)
        ================================ */
        if (status && status.length > 0) {
            const statusArray = Array.isArray(status) ? status : status.split(",");
            matchConditions.status = {
                $in: statusArray.map((s) => new RegExp(`^${s}$`, "i")),
            };
        }

        /* ================================
           COMPANY FILTER
        ================================ */
        if (companyName) {
            if (mongoose.Types.ObjectId.isValid(companyName)) {
                matchConditions.companyName = new mongoose.Types.ObjectId(companyName);
            } else {
                matchConditions["companyData.companyName"] = {
                    $regex: companyName,
                    $options: "i",
                };
            }
        }

        /* ================================
           STAFF ID FILTER (assignedTo by ID)
        ================================ */
        if (staffId) {
            if (mongoose.Types.ObjectId.isValid(staffId)) {
                matchConditions.assignedTo = new mongoose.Types.ObjectId(staffId);
            } else {
                const staffs = await mongoose.model("Staff").find({
                    $or: [
                        { firstName: { $regex: staffId, $options: "i" } },
                        { lastName: { $regex: staffId, $options: "i" } },
                        {
                            $expr: {
                                $regexMatch: {
                                    input: { $concat: ["$firstName", " ", "$lastName"] },
                                    regex: staffId,
                                    options: "i"
                                }
                            }
                        }
                    ]
                }).select("_id");

                if (staffs.length > 0) {
                    const staffIds = staffs.map(staff => staff._id);
                    matchConditions.assignedTo = { $in: staffIds };
                } else {
                    return {
                        success: true,
                        data: [],
                        count: 0,
                    };
                }
            }
        }

        /* ================================
           PARTY NAME FILTER
        ================================ */
        if (partyName) {
            if (partyName.includes(',')) {
                const names = partyName.split(',').map(n => n.trim()).filter(n => n);
                matchConditions["partyData.partyName"] = {
                    $in: names.map(name => new RegExp(name, "i"))
                };
            } else if (mongoose.Types.ObjectId.isValid(partyName)) {
                matchConditions.partyName = new mongoose.Types.ObjectId(partyName);
            } else {
                matchConditions["partyData.partyName"] = {
                    $regex: partyName,
                    $options: "i"
                };
            }
        }

        /* ================================
           MOBILE FILTER - includes all mobile fields
        ================================ */
        if (mobile) {
            if (mobile.includes(',')) {
                const mobiles = mobile.split(',').map(m => m.trim()).filter(m => m);
                const mobileRegexArray = mobiles.map(num => new RegExp(num, "i"));
                
                matchConditions.$or = matchConditions.$or || [];
                matchConditions.$or.push(
                    { "partyData.ownerMobileNo": { $in: mobileRegexArray } },
                    { "partyData.ownerWhatsAppNo": { $in: mobileRegexArray } },
                    { "partyData.personMobileNo": { $in: mobileRegexArray } },
                    { "partyData.personWhatsAppNo": { $in: mobileRegexArray } },
                    { "partyData.contactMobileNo": { $in: mobileRegexArray } },
                    { "partyData.contactWhatsAppNo": { $in: mobileRegexArray } }
                );
            } else {
                const mobileRegex = { $regex: mobile, $options: "i" };
                matchConditions.$or = matchConditions.$or || [];
                matchConditions.$or.push(
                    { "partyData.ownerMobileNo": mobileRegex },
                    { "partyData.ownerWhatsAppNo": mobileRegex },
                    { "partyData.personMobileNo": mobileRegex },
                    { "partyData.personWhatsAppNo": mobileRegex },
                    { "partyData.contactMobileNo": mobileRegex },
                    { "partyData.contactWhatsAppNo": mobileRegex }
                );
            }
        }

        /* ================================
           UNIT NO FILTER
        ================================ */
        if (unitNo) {
            if (unitNo.includes(',')) {
                const unitNos = unitNo.split(',').map(u => u.trim()).filter(u => u);
                matchConditions["partyData.address.unitNo"] = {
                    $in: unitNos.map(unit => new RegExp(unit, "i"))
                };
            } else {
                matchConditions["partyData.address.unitNo"] = {
                    $regex: unitNo,
                    $options: "i"
                };
            }
        }

        /* ================================
           CREATED BY FILTER
        ================================ */
        if (createdBy) {
            const createdByNames = createdBy.split(',').map(name => name.trim()).filter(name => name);
            const createdByConditions = [];

            createdByNames.forEach(name => {
                const parts = name.split(' ').filter(Boolean);
                const firstNamePart = parts[0] || "";
                const lastNamePart = parts.slice(1).join(" ") || "";

                const nameCondition = {
                    $or: []
                };

                if (firstNamePart) {
                    nameCondition.$or.push(
                        { "accountData.createdBy.firstName": { $regex: firstNamePart, $options: "i" } }
                    );
                }

                if (lastNamePart) {
                    nameCondition.$or.push(
                        { "accountData.createdBy.lastName": { $regex: lastNamePart, $options: "i" } }
                    );
                }

                if (firstNamePart && lastNamePart) {
                    nameCondition.$or.push({
                        $expr: {
                            $regexMatch: {
                                input: {
                                    $concat: [
                                        "$accountData.createdBy.firstName",
                                        " ",
                                        "$accountData.createdBy.lastName",
                                    ],
                                },
                                regex: name,
                                options: "i",
                            },
                        },
                    });
                }

                if (nameCondition.$or.length > 0) {
                    createdByConditions.push(nameCondition);
                }
            });

            if (createdByConditions.length > 0) {
                matchConditions.$and = matchConditions.$and || [];
                matchConditions.$and.push({ $or: createdByConditions });
            }
        }

        /* ================================
           MARKET NAME FILTER
        ================================ */
        if (marketName) {
            if (marketName.includes(',')) {
                const markets = marketName.split(',').map(m => m.trim()).filter(m => m);
                matchConditions["marketNameData.marketName"] = {
                    $in: markets.map(name => new RegExp(name, "i"))
                };
            } else {
                matchConditions["marketNameData.marketName"] = {
                    $regex: marketName,
                    $options: "i"
                };
            }
        }

        /* ================================
           AREA FILTER
        ================================ */
        if (area) {
            if (area.includes(',')) {
                const areas = area.split(',').map(a => a.trim()).filter(a => a);
                matchConditions["areaData.area"] = {
                    $in: areas.map(name => new RegExp(name, "i"))
                };
            } else {
                matchConditions["areaData.area"] = {
                    $regex: area,
                    $options: "i"
                };
            }
        }

        /* ================================
           PARTY TAG FILTER
        ================================ */
        if (partyTag) {
            if (partyTag.includes(',')) {
                const tags = partyTag.split(',').map(t => t.trim()).filter(t => t);
                matchConditions["partyData.partyTag"] = {
                    $in: tags.map(tag => new RegExp(tag, "i"))
                };
            } else {
                matchConditions["partyData.partyTag"] = {
                    $regex: partyTag,
                    $options: "i"
                };
            }
        }

        /* ================================
           ASSIGNED TO FILTER (assignedToFilter)
        ================================ */
        if (assignedToFilter) {
            const assignToNames = assignedToFilter.split(',').map(name => name.trim()).filter(name => name);
            let allStaffIds = [];

            for (const name of assignToNames) {
                const staffs = await mongoose.model("Staff").find({
                    $or: [
                        { firstName: { $regex: name, $options: "i" } },
                        { lastName: { $regex: name, $options: "i" } },
                        {
                            $expr: {
                                $regexMatch: {
                                    input: { $concat: ["$firstName", " ", "$lastName"] },
                                    regex: name,
                                    options: "i"
                                }
                            }
                        }
                    ]
                }).select("_id");

                const staffIds = staffs.map(staff => staff._id);
                allStaffIds = [...allStaffIds, ...staffIds];
            }

            if (allStaffIds.length > 0) {
                if (matchConditions.assignedTo) {
                    const existingCondition = matchConditions.assignedTo;
                    delete matchConditions.assignedTo;

                    matchConditions.$and = matchConditions.$and || [];
                    matchConditions.$and.push(
                        existingCondition,
                        { assignedTo: { $in: allStaffIds } }
                    );
                } else {
                    matchConditions.assignedTo = { $in: allStaffIds };
                }
            } else {
                return {
                    success: true,
                    data: [],
                    count: 0,
                };
            }
        }

        /* ================================
           REASON FILTER
        ================================ */
        if (reason) {
            if (reason.includes(',')) {
                const reasons = reason.split(',').map(r => r.trim()).filter(r => r);
                matchConditions.reason = {
                    $in: reasons.map(r => new RegExp(r, "i"))
                };
            } else {
                matchConditions.reason = {
                    $regex: reason,
                    $options: "i"
                };
            }
        }

        const pipeline = [
            // 1. LEAD → PARTY
            {
                $lookup: {
                    from: "parties",
                    localField: "partyName",
                    foreignField: "_id",
                    as: "partyData"
                }
            },
            { $unwind: { path: "$partyData", preserveNullAndEmptyArrays: true } },

            // 2. LEAD → COMPANY
            {
                $lookup: {
                    from: "companynames",
                    localField: "companyName",
                    foreignField: "_id",
                    as: "companyData"
                }
            },
            { $unwind: { path: "$companyData", preserveNullAndEmptyArrays: true } },

            // 3. LEAD → ASSIGNED TO (STAFF)
            {
                $lookup: {
                    from: "staffs",
                    localField: "assignedTo",
                    foreignField: "_id",
                    as: "assignedToData"
                }
            },
            { $unwind: { path: "$assignedToData", preserveNullAndEmptyArrays: true } },

            // 4. MARKET NAME
            {
                $lookup: {
                    from: "markets",
                    localField: "partyData.address.marketName",
                    foreignField: "_id",
                    as: "marketNameData"
                }
            },

            // 5. AREA
            {
                $lookup: {
                    from: "markets",
                    localField: "partyData.address.area",
                    foreignField: "_id",
                    as: "areaData"
                }
            },

            // 6. ACCOUNT MASTER FOR CREATED BY
            {
                $lookup: {
                    from: "accountmasters",
                    let: { partyId: "$partyName", companyId: "$companyName" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$party", "$$partyId"] },
                                        { $eq: ["$companyName", "$$companyId"] }
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: "staffs",
                                localField: "createdBy",
                                foreignField: "_id",
                                as: "createdByData"
                            }
                        },
                        { 
                            $unwind: { 
                                path: "$createdByData", 
                                preserveNullAndEmptyArrays: true 
                            } 
                        },
                        {
                            $project: {
                                createdBy: {
                                    _id: "$createdByData._id",
                                    firstName: "$createdByData.firstName",
                                    lastName: "$createdByData.lastName",
                                    email: "$createdByData.email"
                                }
                            }
                        }
                    ],
                    as: "accountData"
                }
            },
            { $unwind: { path: "$accountData", preserveNullAndEmptyArrays: true } },

            // Apply all match conditions
            { $match: matchConditions },

            // Sort by createdAt
            { $sort: { createdAt: -1 } },

            // Project fields for Excel WITH CONTACT PERSON
            {
                $project: {
                    _id: 0,
                    // Date & Status
                    "DATE": {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$date"
                        }
                    },
                    "TIME": "$time",
                    "STATUS": "$status",
                    "REASON": "$reason",
                    "CUSTOM REASON": "$customReason",
                    
                    // Company
                    "COMPANY NAME": "$companyData.companyName",
                    "COMPANY EMAIL": "$companyData.email",
                    "COMPANY PHONE": "$companyData.phone",
                    
                    // Party Information
                    "PARTY NAME": "$partyData.partyName",
                    "OWNER NAME": "$partyData.ownerName",
                    
                    // ✅ CONTACT PERSON - Priority: contactPerson > contactForPayment > ownerName
                    "CONTACT PERSON": {
                        $cond: {
                            if: { $and: [{ $ne: ["$partyData.contactPerson", ""] }, { $ne: ["$partyData.contactPerson", null] }] },
                            then: "$partyData.contactPerson",
                            else: {
                                $cond: {
                                    if: { $and: [{ $ne: ["$partyData.contactForPayment", ""] }, { $ne: ["$partyData.contactForPayment", null] }] },
                                    then: "$partyData.contactForPayment",
                                    else: "$partyData.ownerName"
                                }
                            }
                        }
                    },
                    
                    // Mobile Numbers
                    "OWNER MOBILE": "$partyData.ownerMobileNo",
                    "OWNER WHATSAPP": "$partyData.ownerWhatsAppNo",
                    "PERSON MOBILE": "$partyData.personMobileNo",
                    "PERSON WHATSAPP": "$partyData.personWhatsAppNo",
                    "CONTACT MOBILE": "$partyData.contactMobileNo",
                    "CONTACT WHATSAPP": "$partyData.contactWhatsAppNo",
                    
                    // Primary Mobile for display
                    "PRIMARY MOBILE": {
                        $cond: {
                            if: { $and: [{ $ne: ["$partyData.personMobileNo", ""] }, { $ne: ["$partyData.contactMobileNo", null] }] },
                            then: "$partyData.personMobileNo",
                            else: {
                                $cond: {
                                    if: { $and: [{ $ne: ["$partyData.personMobileNo", ""] }, { $ne: ["$partyData.personMobileNo", null] }] },
                                    then: "$partyData.personMobileNo",
                                    else: "$partyData.ownerMobileNo"
                                }
                            }
                        }
                    },
                    
                    // Party Details
                    "GST NUMBER": "$partyData.GSTNo",
                    "PARTY TAG": "$partyData.partyTag",
                    
                    // Address
                    "UNIT NO": "$partyData.address.unitNo",
                    "STREET ADDRESS": "$partyData.address.streetAddress",
                    "MARKET NAME": { $arrayElemAt: ["$marketNameData.marketName", 0] },
                    "LANDMARK": "$partyData.address.landMark",
                    "AREA": { $arrayElemAt: ["$areaData.area", 0] },
                    "PINCODE": "$partyData.address.pincode",
                    
                    // Staff Information
                    "ASSIGNED TO": {
                        $concat: [
                            { $ifNull: ["$assignedToData.firstName", ""] },
                            " ",
                            { $ifNull: ["$assignedToData.lastName", ""] }
                        ]
                    },
                    "ASSIGNED TO EMAIL": "$assignedToData.email",
                    
                    // Created By
                    "CREATED BY": {
                        $cond: {
                            if: { $and: ["$accountData.createdBy", "$accountData.createdBy.firstName"] },
                            then: {
                                $concat: [
                                    { $ifNull: ["$accountData.createdBy.firstName", ""] },
                                    " ",
                                    { $ifNull: ["$accountData.createdBy.lastName", ""] }
                                ]
                            },
                            else: "N/A"
                        }
                    },
                    
                    // Feedback
                    "CALL FEEDBACK": "$callFeedback",
                    "REMARKS": "$remarks",
                    "FOLLOW UP REMARKS": "$followUpRemarks",
                    
                    // Reschedule Information
                    "RESCHEDULE DATE": {
                        $cond: {
                            if: "$rescheduleDate",
                            then: { $dateToString: { format: "%Y-%m-%d", date: "$rescheduleDate" } },
                            else: "N/A"
                        }
                    },
                    "IS RESCHEDULED": "$isRescheduledCall",
                    
                    // Source & Dates
                    "SOURCE": "$source",
                    "CREATED AT": {
                        $dateToString: {
                            format: "%Y-%m-%d %H:%M:%S",
                            date: "$createdAt"
                        }
                    },
                    "UPDATED AT": {
                        $cond: {
                            if: "$updatedAt",
                            then: {
                                $dateToString: {
                                    format: "%Y-%m-%d %H:%M:%S",
                                    date: "$updatedAt"
                                }
                            },
                            else: "N/A"
                        }
                    }
                }
            }
        ];

        const leads = await Lead.aggregate(pipeline);

        return {
            success: true,
            count: leads.length,
            data: leads,
        };

    } catch (error) {
        console.error("getLeadsDataForExcel Error:", error);
        return {
            success: false,
            message: "Failed to fetch leads for Excel",
            error: error.message,
        };
    }
};

// API function to export leads to Excel (returns Excel file)
exports.exportLeadsToExcel = async (req, res) => {
    try {
        // Get data using helper function
        const result = await getLeadsDataForExcel(req);

        if (!result.success || !result.data || result.data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No data found to export'
            });
        }

        const leads = result.data;
        console.log("DEBUG : leads:", leads);

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Leads');

        // Define columns for leads (customize as needed)
        worksheet.columns = [
            { header: 'Sr no', key: 'Sr no', width: 10 },
            { header: 'DATE', key: 'DATE', width: 12 },
            { header: 'PARTY NAME', key: 'PARTY NAME', width: 25 },
            // { header: 'COMPANY NAME', key: 'COMPANY NAME', width: 25 },
            { header: 'UNIT NO', key: 'UNIT NO', width: 12 },
            { header: 'MKT NAME', key: 'MKT NAME', width: 20 },
            { header: 'AREA', key: 'AREA', width: 20 },
            { header: 'CONTACT PERSON', key: 'CONTACT PERSON', width: 20 },
            { header: 'MOBILE NO', key: 'MOBILE NO', width: 15 },
            { header: 'TAG', key: 'TAG', width: 10 },
            { header: 'STATUS', key: 'STATUS', width: 12 },
            // { header: 'REASON', key: 'REASON', width: 20 },
            // { header: 'ASSIGNED TO', key: 'ASSIGNED TO', width: 20 },
            // { header: 'CREATED BY', key: 'CREATED BY', width: 20 },
            { header: 'REMARKS', key: 'REMARKS', width: 25 },
            { header: 'CALL FEEDBACK', key: 'CALL FEEDBACK', width: 25 },
        ];

        // Helper function to format date
        const formatDate = (dateString) => {
            if (!dateString) return '';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString(); // Account Masters की तरह format
            } catch (error) {
                return dateString;
            }
        };

        // Add data rows with required fields
        leads.forEach((lead, index) => {
            worksheet.addRow({
                'Sr no': index + 1,
                DATE: formatDate(lead.DATE) || '', // यहाँ formatting apply करें
                'PARTY NAME': lead['PARTY NAME'] || '',
                'COMPANY NAME': lead['COMPANY NAME'] || '',
                'UNIT NO': lead['UNIT NO'] || '',
                'MKT NAME': lead['MARKET NAME'] || lead['MKT NAME'] || '',
                AREA: lead.AREA || '',
                'CONTACT PERSON': lead['CONTACT PERSON'] || lead['OWNER NAME'] || '',
                'MOBILE NO': lead['PRIMARY MOBILE'] || lead['MOBILE NO'] || '',
                TAG: lead['PARTY TAG'] || lead.TAG || '',
                STATUS: lead.STATUS || '',
                REASON: lead.REASON || '',
                'ASSIGNED TO': lead['ASSIGNED TO'] || '',
                'CREATED BY': lead['CREATED BY'] || '',
                'CALL FEEDBACK': lead['CALL FEEDBACK'] || '',
                REMARKS: lead.REMARKS || ''
            });
        });

        // Style the header row
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength + 2;
        });

        // Set response headers for Excel download
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="leads_${new Date().toISOString().split('T')[0]}.xlsx"`
        );

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Error exporting leads to Excel:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export leads to Excel",
            error: error.message
        });
    }
};

exports.exportOrdersToExcel = async (req, res) => {
    try {
        // Create a mock request object with pagination disabled
        const mockReq = {
            body: {
                ...req.body,
                isPagination: false,
                includeCounts: false
            }
        };

        // Create a mock response object to capture the data
        let responseData;
        const mockRes = {
            status: () => ({
                json: (data) => {
                    responseData = data;
                }
            })
        };

        // Reuse the existing controller logic to get filtered orders
        await getAllOrdersPagination(mockReq, mockRes);

        if (!responseData || !responseData.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch orders for export"
            });
        }

        // Create a new Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Orders');

        // Define columns - आपके आवश्यकता के अनुसार कॉलम एडजस्ट करें
        worksheet.columns = [
            { header: 'Sr No', key: 'srNo', width: 10 },
            // { header: 'Order Date', key: 'orderDate', width: 20 },
            { header: 'Order Number', key: 'orderNumber', width: 20 },
            // { header: 'Company', key: 'company', width: 25 },
            { header: 'Date', key: 'createdDate', width: 20 },
            { header: 'Party', key: 'party', width: 30 },
            // { header: 'Contact Person', key: 'contactPerson', width: 25 },
            // { header: 'Mobile', key: 'mobile', width: 15 },
            { header: 'Item', key: 'item', width: 20 },
            { header: 'Size', key: 'size', width: 15 },
            { header: 'Ordered By', key: 'orderedBy', width: 20 },
            { header: 'Order Status', key: 'orderStatus', width: 20 },
            { header: 'Grand Total', key: 'grandTotal', width: 15 },
            { header: 'Remarks', key: 'remarks', width: 30 },
            // { header: 'Quantity', key: 'quantity', width: 15 },
            // { header: 'Rate', key: 'rate', width: 15 },
            // { header: 'Total Amount', key: 'totalAmount', width: 15 },
            // { header: 'GST', key: 'gst', width: 15 },
            // { header: 'Market', key: 'market', width: 20 },
            // { header: 'Area', key: 'area', width: 15 },
            // { header: 'Unit No', key: 'unitNo', width: 15 },
            // { header: 'Designer', key: 'designer', width: 20 },
            // { header: 'Printer', key: 'printer', width: 20 },
            // { header: 'Binder', key: 'binder', width: 20 },
            // { header: 'Booklet Binder', key: 'bookletBinder', width: 20 },
        ];

        // Format and add data rows
        responseData.data.forEach((order, index) => {
            console.log("DEBUG : order:", order);

            const grandTotal = order.finalAmount;

            // Extract party details safely
            const partyDetails = order.party || {};
            const address = partyDetails.address || {};
            
            // Extract staff names safely
            const getStaffName = (staff) => {
                if (!staff) return '';
                return `${staff.firstName || ''} ${staff.lastName || ''}`.trim();
            };

            worksheet.addRow({
                srNo: index + 1,
                orderDate: order.orderDate ? new Date(order.orderDate).toLocaleDateString() : '',
                orderNumber: order.orderNumber || '',
                company: order.companyName?.companyName || '',
                party: partyDetails.partyName || '',
                contactPerson: partyDetails.contactPerson || '',
                mobile: partyDetails.personMobileNo || partyDetails.ownerMobileNo || '',
                item: order.productItem?.itemName || '',
                size: order.size || '',
                quantity: order.quantity || 0,
                rate: order.rate || 0,
                // totalAmount: totalAmount,
                gst: order.gst || 0,
                grandTotal: grandTotal,
                orderStatus: order.status || '',
                market: address.marketName?.marketName || '',
                area: address.area?.area || '',
                unitNo: address.unitNo || '',
                orderedBy: getStaffName(order.createdBy),
                designer: getStaffName(order.designer),
                printer: getStaffName(order.printer),
                binder: getStaffName(order.binder),
                bookletBinder: getStaffName(order.bookletBinder),
                remarks: order.remarks || '',
                createdDate: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''
            });
        });

        // Style the header row
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Style number columns
        // const numberColumns = ['quantity', 'rate', 'totalAmount', 'gst', 'grandTotal'];
        // worksheet.eachRow((row, rowNumber) => {
        //     if (rowNumber > 1) {
        //         numberColumns.forEach(colName => {
        //             const cell = row.getCell(colName);
        //             cell.numFmt = '#,##0.00';
        //         });
        //     }
        // });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength + 2;
        });

        // Set response headers for Excel download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Orders_${new Date().toISOString().split('T')[0]}.xlsx`);

        // Write the Excel file to the response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Error exporting orders to Excel:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export orders to Excel",
            error: error.message,
        });
    }
};

exports.exportDriverReportToExcel = async (req, res) => {
    try {
        const mockReq = {
            body: {
                ...req.body, 
                isPagination: false, 
                includeCounts: false
            }
        };

        let responseData;
        const mockRes = {
            status: () => ({
                json: (data) => {
                    responseData = data;
                }
            })
        };

        await getAllQpOrdersForDriver(mockReq, mockRes);

        if (!responseData || !responseData.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch driver report data for export"
            });
        }

        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Driver Report');

        worksheet.columns = [
            { header: 'S.NO', key: 'serialNo', width: 8 },
            { header: 'Order No', key: 'orderNo', width: 15 },
            { header: 'Assign Date', key: 'driverAssignDate', width: 20 },
            { header: 'PARTY', key: 'partyName', width: 30 },
            { header: 'UNIT NO', key: 'unitNo', width: 15 },
            { header: 'MARKET NAME', key: 'market', width: 40 },
            { header: 'AREA', key: 'area', width: 20 },
            { header: 'MOBILE NO', key: 'mobileNo', width: 15 },
            { header: 'ASSIGN TO', key: 'assignTo', width: 25 },
            { header: 'DELIVER TO', key: 'deliverTo', width: 25 },
            // { header: 'REMARKS', key: 'remarks', width: 30 },
            { header: 'Delivery Status', key: 'deliveryStatus', width: 15 },
        ];

   
        responseData.data.forEach((order, index) => {

            const addressParts = [];
            if (order.party?.address?.landMark?.landmark) addressParts.push(order.party.address.landMark.landmark);
            if (order.party?.address?.marketName?.marketName) addressParts.push(order.party.address.marketName.marketName);
            if (order.party?.address?.city) addressParts.push(order.party.address.city);
            if (order.party?.address?.state) addressParts.push(order.party.address.state);
            const fullAddress = addressParts.join(', ');


            const mobileNo = order.party?.personMobileNo 
                || order.party?.ownerMobileNo 
                || order.party?.contactMobileNo 
                || '';

       
            const assignTo = order.driver 
                ? `${order.driver.firstName || ''} ${order.driver.lastName || ''}`.trim()
                : '';

 
            const area = order.party?.address?.area?.area 
                || order.party?.address?.area 
                || '';

   
            const unitNo = order.party?.address?.unitNo || '';

            console.log("DEBUG : order:", order.deliveryStatus,order.orderNo);
            worksheet.addRow({
                serialNo: index + 1,
                orderNo: order.orderNo || '',
                driverAssignDate: order.driverAssignedDate ? new Date(order.driverAssignedDate).toLocaleDateString() : '',
                partyName: order.party?.partyName || '',
                unitNo: unitNo,
                market: order.party?.address?.marketName?.marketName || '',
                area: area,
                // address: fullAddress,
                mobileNo: mobileNo,
                assignTo: assignTo,
                deliverTo: order.deliverTo || '',
                // remarks: order.remarks || order.deliveryRemarks || '', 
                deliveryStatus: order.deliveryStatus || order.status || '',

                // deliveryStatus: order.deliveryStatus || '',
            });
        });


        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true, size: 12 };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4F81BD' } 
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font.color = { argb: 'FFFFFFFF' }; 
        });

        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                const columnLength = cell.value ? cell.value.toString().length : 0;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = Math.min(Math.max(maxLength + 2, column.width || 10), 50);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Driver_Report_' + new Date().toISOString().split('T')[0] + '.xlsx');

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Driver Report exported: ${responseData.data.length} records`);

    } catch (error) {
        console.error("❌ Error exporting driver report to Excel:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export driver report to Excel",
            error: error.message,
        });
    }
}

exports.exportDesignerPerformanceToExcel = async (req, res) => {
  try {
    const { startDate, endDate, designerNames } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const designerRoles = await Role.find({
      roleName: { $regex: "Designer", $options: "i" },
      isDelete: false,
    }).select("_id");

    const designerRoleIds = designerRoles.map((role) => role._id);

    let staffList = await Staff.find({
      role: { $in: designerRoleIds },
    }).select("firstName lastName _id");

    if (designerNames && Array.isArray(designerNames) && designerNames.length > 0) {
      staffList = staffList.filter(staff => {
        const fullName = `${staff.firstName} ${staff.lastName}`.trim();
        return designerNames.includes(fullName);
      });
    }

    if (staffList.length === 0) {
      return res.status(200).json({ success: true, data: [], message: "No designers found" });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Designer Performance Details');

    // Columns definition (Designer Name column ને અહીં રાખીએ છીએ પણ merge કરીશું)
    worksheet.columns = [
      { header: 'Sr No', key: 'srNo', width: 10 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Order No', key: 'orderNo', width: 18 },
      { header: 'Party Name', key: 'partyName', width: 30 },
      { header: 'Item', key: 'item', width: 25 },
      { header: 'Size', key: 'size', width: 15 },
      { header: 'Created By', key: 'createdBy', width: 20 },
      { header: 'Status', key: 'status', width: 18 },
    ];

    // Main header style
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let currentRowNumber = 2; // Start after header

    for (const staff of staffList) {
      const designerName = `${staff.firstName} ${staff.lastName}`.trim();

      const orders = await Order.find({
        designer: staff._id,
        designerAssignedAt: { $gte: start, $lte: end },
      })
        .populate("party", "partyName")
        .populate("productItem", "itemName")
        .populate("createdBy", "firstName lastName")
        .select("orderNumber designerAssignedAt size designerStatus");

      // === Designer Name as merged header across all columns ===
      worksheet.mergeCells(currentRowNumber, 1, currentRowNumber, 8); // 8 columns
      const designerHeaderCell = worksheet.getCell(currentRowNumber, 1);
      designerHeaderCell.value = designerName;
      designerHeaderCell.font = { bold: true, size: 13 };
      designerHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
      designerHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } }; // Light gray background (optional – remove if not needed)

      currentRowNumber++;

      // === Add orders ===
      let localSrNo = 1;

      if (orders.length > 0) {
        orders.forEach((order) => {
          worksheet.addRow({
            srNo: localSrNo++,
            date: order.designerAssignedAt ? new Date(order.designerAssignedAt).toLocaleDateString('en-IN') : '-',
            orderNo: order.orderNumber || '-',
            partyName: order.party?.partyName || '-',
            item: order.productItem?.itemName || '-',
            size: order.size || '-',
            createdBy: order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}`.trim() : '-',
            status: order.designerStatus || '-',
          });
        });
      } else {
        worksheet.addRow({
          srNo: localSrNo++,
          date: '-',
          orderNo: 'No orders in this period',
          partyName: '',
          item: '',
          size: '',
          createdBy: '',
          status: '',
        });
      }

      // Add empty row as separator
      currentRowNumber = worksheet.lastRow.number + 2;
      worksheet.addRow({});
      currentRowNumber++;
    }

    // Download headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Designer_Performance_${moment(startDate).format('DDMMYYYY')}_to_${moment(endDate).format('DDMMYYYY')}${designerNames?.length > 0 ? '_Filtered' : ''}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting designer performance:", error);
    res.status(500).json({ success: false, message: "Export failed", error: error.message });
  }
};

exports.exportPrinterPerformanceToExcel = async (req, res) => {
  try {
    const { startDate, endDate, printerNames } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const printerRoles = await Role.find({
      roleName: { $regex: "Printer", $options: "i" },
      isDelete: false,
    }).select("_id");

    const printerRoleIds = printerRoles.map((role) => role._id);

    let staffList = await Staff.find({
      role: { $in: printerRoleIds },
    }).select("firstName lastName _id");

    if (printerNames && Array.isArray(printerNames) && printerNames.length > 0) {
      staffList = staffList.filter(staff => {
        const fullName = `${staff.firstName} ${staff.lastName}`.trim();
        return printerNames.includes(fullName);
      });
    }

    if (staffList.length === 0) {
      return res.status(200).json({ success: true, data: [], message: "No printers found" });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Printer Performance Details');

    // Status column removed from here
    worksheet.columns = [
      { header: 'Sr No', key: 'srNo', width: 10 },
      { header: 'Order No', key: 'orderNo', width: 18 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Party Name', key: 'partyName', width: 30 },
      { header: 'Size', key: 'size', width: 15 },           // Size first
      { header: 'Item Name', key: 'itemName', width: 25 }, // Item Name after
      { header: 'Remarks', key: 'remarks', width: 30 },
      { header: 'Qty', key: 'qty', width: 10 },
      { header: 'Number', key: 'number', width: 12 },
      { header: 'Color', key: 'color', width: 12 },
      { header: 'P.Type', key: 'pType', width: 12 },       // Width reduced because only 1 letter
      // Status column removed from here
    ];

    // Header style
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let currentRowNumber = 2;

    for (const staff of staffList) {
      const printerName = `${staff.firstName} ${staff.lastName}`.trim();

      const orders = await Order.find({
        printer: staff._id,
        printerAssignedAt: { $gte: start, $lte: end },
      })
        .populate("party", "partyName")
        .populate("productItem", "itemName")
        .select(
          "orderNumber printerAssignedAt size printerRemarks qty number color pType printerStatus"
        );

      // Printer Name - Merged Header (now 11 columns instead of 12 since status removed)
      worksheet.mergeCells(currentRowNumber, 1, currentRowNumber, 11);
      const printerHeaderCell = worksheet.getCell(currentRowNumber, 1);
      printerHeaderCell.value = printerName;
      printerHeaderCell.font = { bold: true, size: 13 };
      printerHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
      printerHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };

      currentRowNumber++;

      let localSrNo = 1;

      if (orders.length > 0) {
        orders.forEach((order) => {
          // P.Type - First character only
          let pTypeShort = '-';
          if (order.pType) {
            if (order.pType === 'Offset') pTypeShort = 'O';
            else if (order.pType === 'Screen Printing') pTypeShort = 'S';
            else if (order.pType === 'Other') pTypeShort = 'O';
            else pTypeShort = order.pType.charAt(0).toUpperCase(); // fallback
          }

          // Number - First character only (Y/N)
          const numberShort = order.number ? order.number.charAt(0).toUpperCase() : '-';

          worksheet.addRow({
            srNo: localSrNo++,
            orderNo: order.orderNumber || '-',
            date: order.printerAssignedAt ? new Date(order.printerAssignedAt).toLocaleDateString('en-IN') : '-',
            partyName: order.party?.partyName || '-',
            size: order.size || '-',                    // Size first
            itemName: order.productItem?.itemName || '-', // Item Name after
            remarks: order.printerRemarks || '-',
            qty: order.qty || '-',
            number: numberShort,                        // Y or N
            color: order.color || '-',
            pType: pTypeShort,                          // O, S, or O
            // Status column value removed from here
          });
        });
      } else {
        worksheet.addRow({
          srNo: localSrNo++,
          orderNo: 'No orders in this period',
          date: '-',
          partyName: '',
          size: '',
          itemName: '',
          remarks: '',
          qty: '',
          number: '',
          color: '',
          pType: '',
          // Status column value removed from here
        });
      }

      // Empty row separator
      currentRowNumber = worksheet.lastRow.number + 2;
      worksheet.addRow({});
      currentRowNumber++;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Printer_Performance_${moment(startDate).format('DDMMYYYY')}_to_${moment(endDate).format('DDMMYYYY')}${printerNames?.length > 0 ? '_Filtered' : ''}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting printer performance:", error);
    res.status(500).json({ success: false, message: "Export failed", error: error.message });
  }
};
exports.exportBinderPerformanceToExcel = async (req, res) => {
  try {
    const { startDate, endDate, binderNames } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Fetch Binder roles (exact "Binder")
    const binderRoles = await Role.find({
      roleName: { $regex: "^Binder$", $options: "i" },
      isDelete: false,
    }).select("_id");

    const binderRoleIds = binderRoles.map((role) => role._id);

    let staffList = await Staff.find({
      role: { $in: binderRoleIds },
    }).select("firstName lastName _id");

    // Filter by name if provided
    if (binderNames && Array.isArray(binderNames) && binderNames.length > 0) {
      staffList = staffList.filter(staff => {
        const fullName = `${staff.firstName} ${staff.lastName}`.trim();
        return binderNames.includes(fullName);
      });
    }

    if (staffList.length === 0) {
      return res.status(200).json({ success: true, data: [], message: "No binders found" });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Binder Performance Details');

    // Only required columns
    worksheet.columns = [
      { header: 'Sr No', key: 'srNo', width: 10 },
      { header: 'Order No', key: 'orderNo', width: 18 },
      { header: 'Remark', key: 'remark', width: 35 },
      { header: 'Party Name', key: 'partyName', width: 30 },
      { header: 'Size', key: 'size', width: 15 },
      { header: 'Item Name', key: 'itemName', width: 25 },
    ];

    // Header style
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let currentRowNumber = 2;

    for (const staff of staffList) {
      const binderName = `${staff.firstName} ${staff.lastName}`.trim();

      const orders = await Order.find({
        binder: staff._id,
        binderAssignedAt: { $gte: start, $lte: end },
      })
        .populate("party", "partyName")
        .populate("productItem", "itemName")
        .select("orderNumber binderRemarks size party productItem");

      // Binder Name - Merged across all 6 columns
      worksheet.mergeCells(currentRowNumber, 1, currentRowNumber, 6);
      const binderHeaderCell = worksheet.getCell(currentRowNumber, 1);
      binderHeaderCell.value = binderName;
      binderHeaderCell.font = { bold: true, size: 13 };
      binderHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
      binderHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };

      currentRowNumber++;

      let localSrNo = 1;

      if (orders.length > 0) {
        orders.forEach((order) => {
          worksheet.addRow({
            srNo: localSrNo++,
            orderNo: order.orderNumber || '-',
            remark: order.binderRemarks || '-',
            partyName: order.party?.partyName || '-',
            size: order.size || '-',
            itemName: order.productItem?.itemName || '-',
          });
        });
      } else {
        worksheet.addRow({
          srNo: localSrNo++,
          orderNo: 'No orders in this period',
          remark: '',
          partyName: '',
          size: '',
          itemName: '',
        });
      }

      // Separator
      currentRowNumber = worksheet.lastRow.number + 2;
      worksheet.addRow({});
      currentRowNumber++;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Binder_Performance_${moment(startDate).format('DDMMYYYY')}_to_${moment(endDate).format('DDMMYYYY')}${binderNames?.length > 0 ? '_Filtered' : ''}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting binder performance:", error);
    res.status(500).json({ success: false, message: "Export failed", error: error.message });
  }
};

exports.exportBookletBinderPerformanceToExcel = async (req, res) => {
  try {
    const { startDate, endDate, bookletBinderNames } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Fetch Booklet Binder roles
    const bookletBinderRoles = await Role.find({
      roleName: { $regex: "Booklet", $options: "i" },
      isDelete: false,
    }).select("_id");

    const bookletBinderRoleIds = bookletBinderRoles.map((role) => role._id);

    let staffList = await Staff.find({
      role: { $in: bookletBinderRoleIds },
    }).select("firstName lastName _id");

    // Filter by name
    if (bookletBinderNames && Array.isArray(bookletBinderNames) && bookletBinderNames.length > 0) {
      staffList = staffList.filter(staff => {
        const fullName = `${staff.firstName} ${staff.lastName}`.trim();
        return bookletBinderNames.includes(fullName);
      });
    }

    if (staffList.length === 0) {
      return res.status(200).json({ success: true, data: [], message: "No booklet binders found" });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Booklet Binder Performance');

    // Columns same as Binder
    worksheet.columns = [
      { header: 'Sr No', key: 'srNo', width: 10 },
      { header: 'Order No', key: 'orderNo', width: 18 },
      { header: 'Remark', key: 'remark', width: 35 },
      { header: 'Party Name', key: 'partyName', width: 30 },
      { header: 'Size', key: 'size', width: 15 },
      { header: 'Item Name', key: 'itemName', width: 25 },
    ];

    // Header style
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let currentRowNumber = 2;

    for (const staff of staffList) {
      const bookletBinderName = `${staff.firstName} ${staff.lastName}`.trim();

      const orders = await Order.find({
        bookletBinder: staff._id,
        bookletBinderAssignedAt: { $gte: start, $lte: end },
      })
        .populate("party", "partyName")
        .populate("productItem", "itemName")
        .select("orderNumber bookletBinderRemarks size");

      // Merged header for name
      worksheet.mergeCells(currentRowNumber, 1, currentRowNumber, 6);
      const headerCell = worksheet.getCell(currentRowNumber, 1);
      headerCell.value = bookletBinderName;
      headerCell.font = { bold: true, size: 13 };
      headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
      headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };

      currentRowNumber++;

      let localSrNo = 1;

      if (orders.length > 0) {
        orders.forEach((order) => {
          worksheet.addRow({
            srNo: localSrNo++,
            orderNo: order.orderNumber || '-',
            remark: order.bookletBinderRemarks || '-',
            partyName: order.party?.partyName || '-',
            size: order.size || '-',
            itemName: order.productItem?.itemName || '-',
          });
        });
      } else {
        worksheet.addRow({
          srNo: localSrNo++,
          orderNo: 'No orders in this period',
          remark: '',
          partyName: '',
          size: '',
          itemName: '',
        });
      }

      // Separator
      currentRowNumber = worksheet.lastRow.number + 2;
      worksheet.addRow({});
      currentRowNumber++;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=BookletBinder_Performance_${moment(startDate).format('DDMMYYYY')}_to_${moment(endDate).format('DDMMYYYY')}${bookletBinderNames?.length > 0 ? '_Filtered' : ''}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting booklet binder performance:", error);
    res.status(500).json({ success: false, message: "Export failed", error: error.message });
  }
};

exports.exportComplainToExcel = async (req, res) => {
  try {
    const { startDate, endDate, companyNames = [], filters = {}, search = "", staffId } = req.body;

    // Date range
    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateQuery.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.createdAt.$lte = end;
      }
    }

    // Staff filter
    if (staffId) {
      dateQuery.createdBy = staffId;
    }

    // Company validation
    if (!Array.isArray(companyNames) || companyNames.length === 0) {
      return res.status(400).json({ success: false, message: "No companies specified" });
    }

    const selectedCompanies = await CompanyName.find({ companyName: { $in: companyNames } }).lean();
    if (selectedCompanies.length === 0) {
      return res.status(400).json({ success: false, message: "No matching companies found" });
    }

    // Build base query
    let baseQuery = { ...dateQuery };

    // Apply filters
    if (filters && Object.keys(filters).length > 0) {
      for (const key of Object.keys(filters)) {
        if (filters[key] && filters[key].length > 0) {
          switch (key) {
            case 'status':
              baseQuery.status = { $in: filters[key] };
              break;
            case 'createdBy':
              const namePartsArray = filters[key].map(name => name.split(' '));
              const staffOrConditions = [];
              for (const parts of namePartsArray) {
                if (parts.length >= 2) {
                  staffOrConditions.push({
                    $and: [
                      { firstName: { $regex: `^${parts[0]}`, $options: 'i' } },
                      { lastName: { $regex: `^${parts[1]}`, $options: 'i' } }
                    ]
                  });
                } else {
                  staffOrConditions.push({
                    $or: [
                      { firstName: { $regex: parts[0], $options: 'i' } },
                      { lastName: { $regex: parts[0], $options: 'i' } }
                    ]
                  });
                }
              }
              const matchingStaff = await Staff.find({ $or: staffOrConditions }).select('_id').lean();
              if (matchingStaff.length > 0) {
                baseQuery.createdBy = { $in: matchingStaff.map(s => s._id) };
              }
              break;
            case 'party':
              const parties = await Party.find({ partyName: { $in: filters[key] } }).select('_id').lean();
              if (parties.length > 0) {
                baseQuery.party = { $in: parties.map(p => p._id) };
              }
              break;
            case 'subject':
              baseQuery.subject = { $in: filters[key] };
              break;
          }
        }
      }
    }

    // Search - only on direct fields (subject, details, status)
    if (search && search.trim()) {
      const regex = { $regex: search.trim(), $options: 'i' };
      const searchOr = [
        { subject: regex },
        { details: regex },
        { status: regex },
      ];
      if (baseQuery.$or) {
        baseQuery.$or = [...baseQuery.$or, ...searchOr];
      } else {
        baseQuery.$or = searchOr;
      }
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Complains Report');

    worksheet.columns = [
      { header: 'Sr No', key: 'srNo', width: 10 },
      { header: 'DATE', key: 'createdDate', width: 15 },
      { header: 'OrderNo', key: 'orderNo', width: 18 },
      { header: 'Party', key: 'partyName', width: 30 },
      { header: 'SUBJECT', key: 'subject', width: 40 },
      { header: 'STATUS', key: 'status', width: 15 },
      { header: 'CREATED BY', key: 'createdBy', width: 20 },
      { header: 'REMARKS', key: 'remarks', width: 50 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let currentRowNumber = 2;
    let globalSrNo = 1;

    for (const comp of selectedCompanies) {
      const companyName = comp.companyName;

      worksheet.mergeCells(currentRowNumber, 1, currentRowNumber, 8);
      const companyCell = worksheet.getCell(currentRowNumber, 1);
      companyCell.value = companyName;
      companyCell.font = { bold: true, size: 13 };
      companyCell.alignment = { horizontal: 'center', vertical: 'middle' };
      companyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      currentRowNumber++;

      // Final query with company
      const finalQuery = { company: comp._id, ...baseQuery };

      let complains = await Complain.find(finalQuery)
        .populate("party", "partyName")
        .populate("createdBy", "firstName lastName")
        .populate("scorder", "orderNumber")
        .populate("qporder", "orderNo")
        .sort({ createdAt: -1 })
        .lean();

      // Apply orderNo filter AFTER populate (because it uses populated fields)
      if (filters.orderNo && filters.orderNo.length > 0) {
        const filteredByOrder = [];
        const orderFilterSet = new Set(filters.orderNo.map(no => no.toUpperCase()));

        for (const complain of complains) {
          const orderNo = complain.qporder ? `QP-${complain.qporder.orderNo}`.toUpperCase() :
                         complain.scorder ? complain.scorder.orderNumber.toUpperCase() : '';

          if (orderFilterSet.has(orderNo)) {
            filteredByOrder.push(complain);
          }
        }
        complains = filteredByOrder;
      }

      // Apply search on party name and order number AFTER populate
      if (search && search.trim()) {
        const searchLower = search.trim().toLowerCase();
        complains = complains.filter(complain => {
          return (
            (complain.subject && complain.subject.toLowerCase().includes(searchLower)) ||
            (complain.details && complain.details.toLowerCase().includes(searchLower)) ||
            (complain.status && complain.status.toLowerCase().includes(searchLower)) ||
            (complain.party?.partyName && complain.party.partyName.toLowerCase().includes(searchLower)) ||
            (complain.qporder && `QP-${complain.qporder.orderNo}`.toLowerCase().includes(searchLower)) ||
            (complain.scorder && complain.scorder.orderNumber.toLowerCase().includes(searchLower))
          );
        });
      }

      if (complains.length > 0) {
        complains.forEach(complain => {
          const orderNo = complain.qporder ? `QP-${complain.qporder.orderNo}` :
                         complain.scorder ? complain.scorder.orderNumber : 'N/A';

          worksheet.addRow({
            srNo: globalSrNo++,
            createdDate: complain.createdAt ? new Date(complain.createdAt).toLocaleDateString('en-IN') : '-',
            orderNo,
            partyName: complain.party?.partyName || '-',
            subject: complain.subject || '-',
            status: complain.status || '-',
            createdBy: complain.createdBy ? `${complain.createdBy.firstName} ${complain.createdBy.lastName}`.trim() : '-',
            remarks: complain.details || '-',
          });
        });
      } else {
        worksheet.addRow({
          srNo: globalSrNo++,
          createdDate: '-',
          orderNo: 'No complains found',
          partyName: '',
          subject: '',
          status: '',
          createdBy: '',
          remarks: '',
        });
      }

      currentRowNumber = worksheet.lastRow.number + 2;
      worksheet.addRow({});
      currentRowNumber++;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const dateStr = startDate && endDate 
      ? `${moment(startDate).format('DDMMYYYY')}_to_${moment(endDate).format('DDMMYYYY')}`
      : 'All_Time';
    const fileName = `Complains_Report_${dateStr}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting complains:", error);
    res.status(500).json({ success: false, message: "Export failed", error: error.message });
  }
};

exports.exportPaymentFolderToExcel = async (req, res) => {
  try {
    const { startDate, endDate, companyNames = [], filters = {}, search = "" } = req.body;

    if (!Array.isArray(companyNames) || companyNames.length === 0) {
      return res.status(400).json({ success: false, message: "No companies specified" });
    }

    const selectedCompanies = await CompanyName.find({ companyName: { $in: companyNames } }).lean();
    if (selectedCompanies.length === 0) {
      return res.status(400).json({ success: false, message: "No matching companies found" });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Payment Folders Report');

    worksheet.columns = [
      { header: 'S.NO', key: 'srNo', width: 10 },
      { header: 'MONTH', key: 'month', width: 15 },
      { header: 'PARTY', key: 'partyName', width: 35 },
      { header: 'ADDRESS', key: 'address', width: 60 },
      { header: 'PERSON', key: 'person', width: 25 },
      { header: 'MOBILE NO', key: 'mobileNumber', width: 18 },
      { header: 'AREA', key: 'area', width: 15 },
      { header: 'ASSIGN TO', key: 'assignedTo', width: 25 },
      { header: 'REASON', key: 'reason', width: 40 },
      { header: 'REMARKS', key: 'remarks', width: 50 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let currentRowNumber = 2;
    let globalSrNo = 1;

    for (const comp of selectedCompanies) {
      const companyName = comp.companyName;

      worksheet.mergeCells(currentRowNumber, 1, currentRowNumber, 10);
      const companyCell = worksheet.getCell(currentRowNumber, 1);
      companyCell.value = companyName;
      companyCell.font = { bold: true, size: 13 };
      companyCell.alignment = { horizontal: 'center', vertical: 'middle' };
      companyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      currentRowNumber++;

      // Only direct filters in query (Month, Area, Date)
      let finalQuery = { company: comp._id };

      if (startDate || endDate) {
        finalQuery.createdAt = {};
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          finalQuery.createdAt.$gte = start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          finalQuery.createdAt.$lte = end;
        }
      }

      if (filters.area && filters.area.length > 0 && filters.area[0] !== "All") {
        finalQuery.area = { $in: filters.area };
      }

      if (filters.month && filters.month.length > 0) {
        finalQuery.month = { $in: filters.month };
      }

      // Fetch with full populate
      let folders = await PaymentFolder.find(finalQuery)
        .populate({
          path: "party",
          select: "partyName contactMobileNo contactWhatsAppNo ownerMobileNo ownerWhatsAppNo contactForPayment ownerName contactPerson address",
          populate: [
            { path: "address.marketName", model: "Market", select: "marketName" },
            { path: "address.landMark", model: "Market", select: "landmark" },
            { path: "address.area", model: "Market", select: "area" },
            { path: "address.pincode", model: "Market", select: "pincode" },
          ]
        })
        .populate("assignedTo", "firstName lastName")
        .populate("assignTask", "reasonForVisit")
        .sort({ createdAt: -1 })
        .lean();

      // Manual filtering for Party, Person (contactPerson/ownerName), Assigned To, Remarks, Search
      let filteredFolders = [...folders];

      // Party filter
      if (filters.party && filters.party.length > 0) {
        const partySet = new Set(filters.party.map(p => p.toUpperCase()));
        filteredFolders = filteredFolders.filter(f => 
          f.party?.partyName && partySet.has(f.party.partyName.toUpperCase())
        );
      }

      // Person (contactPerson or ownerName)
      if (filters.person && filters.person.length > 0) {
        const personSet = new Set(filters.person.map(p => p.toUpperCase()));
        filteredFolders = filteredFolders.filter(f => {
          const contactPerson = f.party?.contactPerson?.toUpperCase() || '';
          const ownerName = f.party?.ownerName?.toUpperCase() || '';
          return personSet.has(contactPerson) || personSet.has(ownerName);
        });
      }

      // Assigned To filter
      if (filters.assignedTo && filters.assignedTo.length > 0) {
        const assignSet = new Set(filters.assignedTo.map(a => a.toUpperCase()));
        filteredFolders = filteredFolders.filter(f => {
          const name = f.assignedTo ? `${f.assignedTo.firstName} ${f.assignedTo.lastName}`.trim().toUpperCase() : '';
          return assignSet.has(name);
        });
      }

      // Remarks filter
      if (filters.remarks && filters.remarks.length > 0) {
        const remarksSet = new Set(filters.remarks.map(r => r.toUpperCase()));
        filteredFolders = filteredFolders.filter(f => 
          f.remarks && remarksSet.has(f.remarks.toUpperCase())
        );
      }

      // Global Search
      if (search && search.trim()) {
        const lowerSearch = search.trim().toLowerCase();
        filteredFolders = filteredFolders.filter(folder => {
          const partyName = folder.party?.partyName?.toLowerCase() || '';
          const area = folder.area?.toLowerCase() || '';
          const month = folder.month?.toLowerCase() || '';
          const remarks = folder.remarks?.toLowerCase() || '';
          const assignedTo = folder.assignedTo ? `${folder.assignedTo.firstName} ${folder.assignedTo.lastName}`.toLowerCase() : '';
          const person = (folder.party?.contactPerson || folder.party?.ownerName || '').toLowerCase();
          const fullAddress = [
            folder.party?.address?.unitNo,
            folder.party?.address?.marketName?.marketName,
            folder.party?.address?.landMark?.landmark,
            folder.party?.address?.area?.area,
            folder.party?.address?.pincode?.pincode
          ].filter(Boolean).join(' ').toLowerCase();

          return partyName.includes(lowerSearch) ||
                 area.includes(lowerSearch) ||
                 month.includes(lowerSearch) ||
                 remarks.includes(lowerSearch) ||
                 assignedTo.includes(lowerSearch) ||
                 person.includes(lowerSearch) ||
                 fullAddress.includes(lowerSearch);
        });
      }

      if (filteredFolders.length > 0) {
        filteredFolders.forEach(folder => {
          const party = folder.party;
          const addressParts = [];
          if (party?.address?.unitNo) addressParts.push(`Unit No: ${party.address.unitNo}`);
          if (party?.address?.marketName?.marketName) addressParts.push(`Market: ${party.address.marketName.marketName}`);
          if (party?.address?.landMark?.landmark) addressParts.push(`Landmark: ${party.address.landMark.landmark}`);
          if (party?.address?.area?.area) addressParts.push(`Area: ${party.address.area.area}`);
          if (party?.address?.pincode?.pincode) addressParts.push(`Pincode: ${party.address.pincode.pincode}`);
          const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : '-';

          const firstMobile = party?.contactForPayment ||
                             party?.contactMobileNo ||
                             party?.contactWhatsAppNo ||
                             party?.ownerMobileNo ||
                             party?.ownerWhatsAppNo || 'N/A';

          const personName = party?.contactPerson?.trim() || party?.ownerName?.trim() || '-';
          const assignedToName = folder.assignedTo ? `${folder.assignedTo.firstName} ${folder.assignedTo.lastName}`.trim() : 'Unassigned';
          const reason = folder.assignTask?.reasonForVisit || '-';

          worksheet.addRow({
            srNo: globalSrNo++,
            month: folder.month || '-',
            partyName: party?.partyName || '-',
            address: fullAddress,
            person: personName,
            mobileNumber: firstMobile,
            area: folder.area || '-',
            assignedTo: assignedToName,
            reason: reason,
            remarks: folder.remarks || '-',
          });
        });
      } else {
        worksheet.addRow({
          srNo: globalSrNo++,
          month: '-',
          partyName: 'No payment folders found with applied filters',
          address: '-',
          person: '',
          mobileNumber: '',
          area: '',
          assignedTo: '',
          reason: '',
          remarks: '',
        });
      }

      currentRowNumber = worksheet.lastRow.number + 2;
      worksheet.addRow({});
      currentRowNumber++;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const dateStr = startDate && endDate 
      ? `${moment(startDate).format('DDMMYYYY')}_to_${moment(endDate).format('DDMMYYYY')}`
      : 'All_Time';
    const fileName = `PaymentFolders_Report_${dateStr}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting payment folders:", error);
    res.status(500).json({ success: false, message: "Export failed", error: error.message });
  }
};

exports.exportPendingClientApprovalOrdersToExcel = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const query = {
      clientApprovalSentAt: { $exists: true, $ne: null },
      designerStatus: { $ne: "Approved" }
    };

    // Date filter on createdAt (જો જોઈએ તો)
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

    const orders = await Order.find(query)
      .populate("companyName", "companyName")
      .populate("party", "partyName")
      .populate("productItem", "itemName")
      .populate("createdBy", "firstName lastName")
      .sort({ clientApprovalSentAt: -1 }) // Latest sent first
      .lean();

    if (orders.length === 0) {
      return res.status(200).json({ success: true, message: "No pending approval orders found", count: 0 });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pending Client Approval');

    // Your Required Columns Only
    worksheet.columns = [
      { header: 'S.NO', key: 'srNo', width: 10 },
      { header: 'Order No', key: 'orderNumber', width: 22 },
      { header: 'Proof Dt Final', key: 'proofDate', width: 20 },
      { header: 'Party Name', key: 'partyName', width: 35 },
      { header: 'Create By', key: 'createdBy', width: 25 },
      { header: 'Size', key: 'size', width: 15 },
      { header: 'Item Name', key: 'itemName', width: 35 },
    ];

    // Header Styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    let srNo = 1;
    orders.forEach(order => {
      const createdByName = order.createdBy 
        ? `${order.createdBy.firstName} ${order.createdBy.lastName}`.trim() 
        : '-';

      const size = typeof order.size === 'object' && order.size?.size 
        ? order.size.size 
        : order.size || '-';

      worksheet.addRow({
        srNo: srNo++,
        orderNumber: order.orderNumber || '-',
        proofDate: moment(order.clientApprovalSentAt).format('DD-MM-YYYY HH:mm'),
        partyName: order.party?.partyName || '-',
        createdBy: createdByName,
        size: size,
        itemName: order.productItem?.itemName || '-',
      });
    });

    // File download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const fileName = `Pending_Client_Approval_Orders_${moment().format('DDMMYYYY_HHmm')}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export pending client approval orders error:", error);
    res.status(500).json({ success: false, message: "Export failed", error: error.message });
  }
};