const ExcelJS = require('exceljs');
const { getAllAccountMasters } = require('./accountMaster.controller'); // Assuming the original function is in this file
const { getAllAssignTasksForExcel } = require('./assignTask.controller');
const assignTaskModel = require('../models/assignTask.model');
const mongoose = require('mongoose');
const Lead = require('../models/lead.model');
const { getAllOrdersPagination } = require('./order.controller');
const { getAllQpOrdersForDriver } = require('./qpOrder.controller');


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
};