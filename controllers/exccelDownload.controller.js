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

exports.exportCancelledOrdersToExcel = async (req, res) => {
    try {
        // Fetch cancelled orders
        const { startDate, endDate } = req.body;

        const filter = {
            status: "Cancelled"
        };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.cancelledAt = { $gte: start, $lte: end };
        }

        const orders = await Order.find(filter)
            .populate("companyName", "companyName")
            .populate("party", "partyName")
            .populate("productItem", "itemName")               // ✅ Add
            .populate("followUp.staff", "firstName lastName");

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Cancelled Orders');

        // Define columns
        worksheet.columns = [
            { header: 'Sr No', key: 'srNo', width: 10 },
            { header: 'Order No.', key: 'orderNumber', width: 20 },
            { header: 'Order Date', key: 'orderDate', width: 15 }, // ✅ New
            { header: 'Party Name', key: 'partyName', width: 30 },
            { header: 'Item Name', key: 'itemName', width: 25 }, // ✅ New
            { header: 'Item Size', key: 'itemSize', width: 15 }, // ✅ New
            { header: 'Followup Staff', key: 'followupStaff', width: 25 },
            { header: 'Cancel Reason', key: 'cancelReason', width: 40 },
            { header: 'Cancelled At', key: 'cancelledAt', width: 20 },
        ];


        // Add data to worksheet
        orders.forEach((order, index) => {
            worksheet.addRow({
                srNo: index + 1,
                orderNumber: order.orderNumber || '',
                orderDate: moment(order.createdAt).format('DD-MM-YYYY'),                  // ✅ New
                partyName: order.party?.partyName || '',
                itemName: order.productItem?.itemName || '',                              // ✅ New
                itemSize: order.size || '',                                               // ✅ New
                followupStaff: order.followUp?.staff
                    ? `${order.followUp.staff.firstName} ${order.followUp.staff.lastName}`
                    : '',
                cancelReason: order.cancelRemarks || '',
                cancelledAt: order.cancelledAt
                    ? moment(order.cancelledAt).format('DD-MM-YYYY')
                    : '',
            });

        });

        // Style header row
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFCCCCCC' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Auto fit columns
        worksheet.columns.forEach(column => {
            column.width = column.width || 15;
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Cancelled_Orders.xlsx"');

        // Write workbook to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error exporting cancelled orders to Excel:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export cancelled orders to Excel',
            error: error.message
        });
    }
};

// Helper function - order ke upar se stage status nikalta hai
const getStageStatusText = (order) => {
    const status = order.status;

    switch (status) {
        case 'Designer': {
            const designerName = order.designer
                ? `${order.designer.firstName} ${order.designer.lastName}`
                : 'Unassigned';
            const designerStatus = order.designerStatus || 'Pending';

            if (designerStatus === 'Pending') {
                return `Designing Pending by ${designerName}`;
            } else if (designerStatus === 'In Progress') {
                return `Designing In Progress by ${designerName}`;
            } else if (designerStatus === 'Done') {
                return `Designing Done by ${designerName} - Awaiting Approval`;
            } else if (designerStatus === 'Rework') {
                return `Designing Rework by ${designerName}`;
            } else if (designerStatus === 'Approved') {
                return `Design Approved by ${designerName}`;
            }
            return `Designing ${designerStatus} by ${designerName}`;
        }

        case 'Printer': {
            const printerName = order.printer
                ? `${order.printer.firstName} ${order.printer.lastName}`
                : 'Unassigned';
            const printerStatus = order.printerStatus || 'Pending';

            if (printerStatus === 'Pending') {
                return `Printing Pending by ${printerName}`;
            } else if (printerStatus === 'In Progress') {
                return `Printing In Progress by ${printerName}`;
            } else if (printerStatus === 'Done') {
                return `Printing Done by ${printerName}`;
            }
            return `Printing ${printerStatus} by ${printerName}`;
        }

        case 'Binder': {
            const binderName = order.binder
                ? `${order.binder.firstName} ${order.binder.lastName}`
                : 'Unassigned';
            const binderStatus = order.binderStatus || 'Pending';

            if (binderStatus === 'Pending') {
                return `Binding Pending by ${binderName}`;
            } else if (binderStatus === 'In Progress') {
                return `Binding In Progress by ${binderName}`;
            } else if (binderStatus === 'Done') {
                return `Binding Done by ${binderName}`;
            }
            return `Binding ${binderStatus} by ${binderName}`;
        }

        case 'Booklet & Folder Binder': {
            const bookletName = order.bookletBinder
                ? `${order.bookletBinder.firstName} ${order.bookletBinder.lastName}`
                : 'Unassigned';
            const bookletStatus = order.bookletBinderStatus || 'Pending';

            if (bookletStatus === 'Pending') {
                return `Booklet Binding Pending by ${bookletName}`;
            } else if (bookletStatus === 'In Progress') {
                return `Booklet Binding In Progress by ${bookletName}`;
            } else if (bookletStatus === 'Done') {
                return `Booklet Binding Done by ${bookletName}`;
            }
            return `Booklet Binding ${bookletStatus} by ${bookletName}`;
        }

        case 'Received':
            return 'Order Received - Not Yet Assigned';

        case 'Hold':
            return 'Order On Hold';

        default:
            return status || '';
    }
};

exports.exportPendingApprovalOrdersToExcel = async (req, res) => {
    try {
        const { startDate, endDate } = req.body;

        const filter = {
            status: { $nin: ["Cancelled", "Delivery"] }
        };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.createdAt = { $gte: start, $lte: end };
        }

        const orders = await Order.find(filter)
            .populate("companyName", "companyName")
            .populate("party", "partyName")
            .populate("productItem", "itemName")
            .populate("createdBy", "firstName lastName")
            .populate("designer", "firstName lastName")        // ✅ Add
            .populate("printer", "firstName lastName")         // ✅ Add
            .populate("binder", "firstName lastName")          // ✅ Add
            .populate("bookletBinder", "firstName lastName")   // ✅ Add
            .populate("followUp.staff", "firstName lastName")
            .populate("followUp.taskId", "status rescheduleDate remarks"); // taskId populate

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Pending Orders');

        worksheet.columns = [
            { header: 'Sr No', key: 'srNo', width: 8 },
            { header: 'Order No.', key: 'orderNumber', width: 15 },
            { header: 'Order Date', key: 'orderDate', width: 15 },
            { header: 'Party Name', key: 'partyName', width: 30 },
            { header: 'Item Name', key: 'itemName', width: 25 },
            { header: 'Item Size', key: 'itemSize', width: 15 }, // ✅ New
            { header: 'Ordered By', key: 'orderedBy', width: 20 },
            { header: 'Order Status', key: 'currentStage', width: 20 },
            { header: 'Follow Up By', key: 'followUpBy', width: 20 },
            { header: 'Task Assigned Date', key: 'taskAssignedDate', width: 20 },
            { header: 'Rescheduled Date', key: 'rescheduleDate', width: 20 },
            { header: 'Task Status', key: 'taskStatus', width: 20 },
            { header: 'Task Remarks', key: 'followUpRemarks', width: 40 },
        ];

        orders.forEach((order, index) => {
            // Current stage ka sub-status nikalna
            let stageStatus = '';
            switch (order.status) {
                case 'Designer':
                    stageStatus = order.designerStatus || '';
                    break;
                case 'Printer':
                    stageStatus = order.printerStatus || '';
                    break;
                case 'Binder':
                    stageStatus = order.binderStatus || '';
                    break;
                case 'Booklet & Folder Binder':
                    stageStatus = order.bookletBinderStatus || '';
                    break;
                default:
                    stageStatus = '';
            }

            const followUpStaff = order.followUp?.staff
                ? `${order.followUp.staff.firstName} ${order.followUp.staff.lastName}`
                : '';

            const taskStatus = order.followUp?.taskId?.status || '';

            const rescheduleDate = order.followUp?.taskId?.rescheduleDate
                ? moment(order.followUp.taskId.rescheduleDate).format('DD-MM-YYYY')
                : '';

            const followUpRemarks = order.followUp?.remarks || '';

            worksheet.addRow({
                srNo: index + 1,
                orderNumber: order.orderNumber || '',
                orderDate: moment(order.createdAt).format('DD-MM-YYYY'),
                partyName: order.party?.partyName || '',
                itemName: order.productItem?.itemName || '',
                itemSize: order.size || '',                 // ✅ New
                orderedBy: order.createdBy
                    ? `${order.createdBy.firstName} ${order.createdBy.lastName}`
                    : '',
                currentStage: getStageStatusText(order),
                followUpBy: followUpStaff,
                taskAssignedDate: order.followUp?.assignedAt
                    ? moment(order.followUp.assignedAt).format('DD-MM-YYYY')
                    : '',
                rescheduleDate: order.followUp?.taskId?.rescheduleDate
                    ? moment(order.followUp.taskId.rescheduleDate).format('DD-MM-YYYY')
                    : '',
                taskStatus,
                followUpRemarks,
            });
        });

        // Header styling
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFCCCCCC' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Pending_Orders.xlsx"');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error exporting pending orders to Excel:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export pending orders to Excel',
            error: error.message
        });
    }
};

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
            worksheet.addRow({
                srNo: index + 1,
                company: account.companyName?.companyName || '',
                createdDate: moment(account.createdAt).format('DD-MM-YYYY'),
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
            status,
            companyName,
            assignTo,
            assignedTo,
            priority,
            startDate,
            endDate,
            date,
            unitNo,
            marketName,
            mobile,
            reason,
            assignToFilter,
            party,
            area,
            search,
        } = req.body;

        // Same as getAllAssignTasks: createdBy comes from assignBy field
        const createdBy = req.body.assignBy;

        // PRE-MATCH (direct fields on AssignTask — applied BEFORE lookups)
        const preMatchConditions = {};

        // POST-MATCH (populated/nested fields — applied AFTER lookups)
        const postMatchConditions = {};

        /* ================================
           DATE FILTER
        ================================ */
        if (date) {
            if (typeof date === "string" && date.includes(",")) {
                const dates = date.split(",").map((d) => d.trim()).filter((d) => d);
                const dateConditions = [];

                dates.forEach((dateStr) => {
                    const parsedDate = parseDateString(dateStr);
                    const startOfDay = new Date(parsedDate);
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date(parsedDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    dateConditions.push({ date: { $gte: startOfDay, $lte: endOfDay } });
                });

                if (dateConditions.length > 0) {
                    preMatchConditions.$or = preMatchConditions.$or || [];
                    preMatchConditions.$or.push(...dateConditions);
                }
            } else {
                const parsedDate = parseDateString(date);
                const startOfDay = new Date(parsedDate);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(parsedDate);
                endOfDay.setHours(23, 59, 59, 999);
                preMatchConditions.date = { $gte: startOfDay, $lte: endOfDay };
            }
        }

        if (startDate && endDate && !date) {
            preMatchConditions.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        /* ================================
           COMPANY FILTER
        ================================ */
        if (companyName) {
            if (mongoose.Types.ObjectId.isValid(companyName)) {
                preMatchConditions.companyName = new mongoose.Types.ObjectId(companyName);
            } else {
                postMatchConditions["companyData.companyName"] = {
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
            preMatchConditions.status = {
                $in: statusArray.map((s) => new RegExp(`^${s}$`, "i")),
            };
        }

        /* ================================
           PRIORITY FILTER
        ================================ */
        if (priority) {
            preMatchConditions.priority = new RegExp(`^${priority}$`, "i");
        }

        /* ================================
           REASON FOR VISIT FILTER
        ================================ */
        if (reason) {
            const predefinedReasons = [
                "delivery",
                "get payment",
                "visit",
                "order",
                "complain",
                "sample approval",
            ];
            const reasons = reason
                .split(",")
                .map((r) => r.trim().toLowerCase())
                .filter((r) => r);

            if (reasons.length > 0) {
                const otherIncluded = reasons.includes("other");
                const specificReasons = reasons.filter((r) => r !== "other");

                if (otherIncluded && specificReasons.length === 0) {
                    preMatchConditions.reasonForVisit = {
                        $nin: predefinedReasons.map((r) => new RegExp(`^${r}$`, "i")),
                    };
                } else if (otherIncluded && specificReasons.length > 0) {
                    preMatchConditions.$or = preMatchConditions.$or || [];
                    preMatchConditions.$or.push(
                        {
                            reasonForVisit: {
                                $in: specificReasons.map((r) => new RegExp(`^${r}$`, "i")),
                            },
                        },
                        {
                            reasonForVisit: {
                                $nin: predefinedReasons.map((r) => new RegExp(`^${r}$`, "i")),
                            },
                        }
                    );
                } else {
                    preMatchConditions.reasonForVisit = {
                        $in: specificReasons.map((r) => new RegExp(`^${r}$`, "i")),
                    };
                }
            }
        }

        /* ================================
           BASE PIPELINE
        ================================ */
        const pipeline = [
            ...(Object.keys(preMatchConditions).length > 0
                ? [{ $match: preMatchConditions }]
                : []),

            // 1. TASK → COMPANY
            {
                $lookup: {
                    from: "companynames",
                    localField: "companyName",
                    foreignField: "_id",
                    as: "companyData",
                },
            },
            { $unwind: { path: "$companyData", preserveNullAndEmptyArrays: true } },

            // 2. TASK → PARTY
            {
                $lookup: {
                    from: "parties",
                    localField: "partyName",
                    foreignField: "_id",
                    as: "partyData",
                },
            },
            { $unwind: { path: "$partyData", preserveNullAndEmptyArrays: true } },

            // 3. TASK → ASSIGN TO (STAFF)
            {
                $lookup: {
                    from: "staffs",
                    localField: "assignTo",
                    foreignField: "_id",
                    as: "assignToData",
                },
            },
            { $unwind: { path: "$assignToData", preserveNullAndEmptyArrays: true } },

            // 4. STAFF → ROLE
            {
                $lookup: {
                    from: "roles",
                    localField: "assignToData.role",
                    foreignField: "_id",
                    as: "assignToData.roleData",
                },
            },
            {
                $unwind: {
                    path: "$assignToData.roleData",
                    preserveNullAndEmptyArrays: true,
                },
            },

            // 5. STAFF → DEPARTMENT
            {
                $lookup: {
                    from: "departments",
                    localField: "assignToData.department",
                    foreignField: "_id",
                    as: "assignToData.departmentData",
                },
            },
            {
                $unwind: {
                    path: "$assignToData.departmentData",
                    preserveNullAndEmptyArrays: true,
                },
            },

            // 6. PARTY ADDRESS → MARKET NAME
            {
                $lookup: {
                    from: "markets",
                    localField: "partyData.address.marketName",
                    foreignField: "_id",
                    as: "marketNameData",
                },
            },

            // 7. PARTY ADDRESS → AREA
            {
                $lookup: {
                    from: "markets",
                    localField: "partyData.address.area",
                    foreignField: "_id",
                    as: "areaData",
                },
            },

            // 8. PARTY ADDRESS → LANDMARK
            // {
            //     $lookup: {
            //         from: "markets",
            //         localField: "partyData.address.landMark",
            //         foreignField: "_id",
            //         as: "landMarkData",
            //     },
            // },

            // // 9. PARTY ADDRESS → PINCODE
            // {
            //     $lookup: {
            //         from: "markets",
            //         localField: "partyData.address.pincode",
            //         foreignField: "_id",
            //         as: "pincodeData",
            //     },
            // },

            // 10. COMPANY → OWNER
            {
                $lookup: {
                    from: "users",
                    localField: "companyData.owner",
                    foreignField: "_id",
                    as: "companyData.ownerData",
                },
            },
            {
                $unwind: {
                    path: "$companyData.ownerData",
                    preserveNullAndEmptyArrays: true,
                },
            },

            // 11. ACCOUNT MASTER FOR CREATED BY
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
                                        { $eq: ["$companyName", "$$companyId"] },
                                    ],
                                },
                            },
                        },
                        {
                            $lookup: {
                                from: "staffs",
                                localField: "createdBy",
                                foreignField: "_id",
                                as: "createdByData",
                            },
                        },
                        { $unwind: "$createdByData" },
                    ],
                    as: "accountData",
                },
            },
            { $unwind: { path: "$accountData", preserveNullAndEmptyArrays: true } },

            // 12. ORIGINAL TASK (IF RESCHEDULED)
            {
                $lookup: {
                    from: "assigntasks",
                    localField: "originalTaskId",
                    foreignField: "_id",
                    as: "originalTaskData",
                },
            },
            {
                $unwind: {
                    path: "$originalTaskData",
                    preserveNullAndEmptyArrays: true,
                },
            },
        ];

        /* ================================
           POST-LOOKUP FILTERS
        ================================ */

        // UNIT NO FILTER
        if (unitNo) {
            const unitNos = unitNo.split(",").map((u) => u.trim()).filter((u) => u);
            if (unitNos.length > 0) {
                postMatchConditions["partyData.address.unitNo"] = {
                    $in: unitNos.map((unit) => new RegExp(`^${unit}$`, "i")),
                };
            }
        }

        // MARKET NAME FILTER
        if (marketName) {
            const marketNames = marketName.split(",").map((m) => m.trim()).filter((m) => m);
            if (marketNames.length > 0) {
                postMatchConditions["marketNameData.marketName"] = {
                    $in: marketNames.map((name) => new RegExp(name, "i")),
                };
            }
        }

        // MOBILE NUMBER FILTER
        if (mobile) {
            postMatchConditions.$or = postMatchConditions.$or || [];
            postMatchConditions.$or.push(
                { "partyData.ownerMobileNo": { $regex: mobile, $options: "i" } },
                { "partyData.personMobileNo": { $regex: mobile, $options: "i" } },
                { "partyData.contactMobileNo": { $regex: mobile, $options: "i" } },
                { "partyData.ownerWhatsAppNo": { $regex: mobile, $options: "i" } },
                { "partyData.personWhatsAppNo": { $regex: mobile, $options: "i" } },
                { "partyData.contactWhatsAppNo": { $regex: mobile, $options: "i" } }
            );
        }

        // CREATED BY FILTER
        if (createdBy) {
            const createdByNames = createdBy
                .split(",")
                .map((name) => name.trim())
                .filter(Boolean);

            const createdByConditions = [];

            createdByNames.forEach((name) => {
                const parts = name.split(" ").filter(Boolean);

                if (parts.length >= 2) {
                    const firstName = parts[0];
                    const lastName = parts.slice(1).join(" ");
                    createdByConditions.push({
                        $and: [
                            {
                                "accountData.createdByData.firstName": {
                                    $regex: `^${firstName}$`,
                                    $options: "i",
                                },
                            },
                            {
                                "accountData.createdByData.lastName": {
                                    $regex: `^${lastName}$`,
                                    $options: "i",
                                },
                            },
                        ],
                    });
                } else {
                    createdByConditions.push({
                        "accountData.createdByData.firstName": {
                            $regex: `^${parts[0]}$`,
                            $options: "i",
                        },
                    });
                }
            });

            if (createdByConditions.length > 0) {
                postMatchConditions.$or = createdByConditions;
            }
        }

        // ASSIGN TO FILTER (assignedTo / assignTo)
        const assignToValue = assignedTo || assignTo;
        let finalAssignToIds = [];

        if (assignToValue && assignToValue.trim() !== "") {
            if (mongoose.Types.ObjectId.isValid(assignToValue)) {
                finalAssignToIds.push(new mongoose.Types.ObjectId(assignToValue));
            } else {
                const staffs = await mongoose.model("Staff").find({
                    $or: [
                        { firstName: { $regex: assignToValue, $options: "i" } },
                        { lastName: { $regex: assignToValue, $options: "i" } },
                        {
                            $expr: {
                                $regexMatch: {
                                    input: { $concat: ["$firstName", " ", "$lastName"] },
                                    regex: assignToValue,
                                    options: "i",
                                },
                            },
                        },
                    ],
                }).select("_id firstName lastName");

                if (staffs.length > 0) {
                    finalAssignToIds = staffs.map((staff) => staff._id);
                } else {
                    return { success: true, data: [], count: 0 };
                }
            }
        }

        // ASSIGN TO FILTER (comma-separated assignToFilter)
        if (assignToFilter && assignToFilter.trim() !== "") {
            const assignToNames = assignToFilter
                .split(",")
                .map((name) => name.trim())
                .filter((name) => name !== "");

            let filterStaffIds = [];

            const staffResults = await Promise.all(
                assignToNames.map(async (name) => {
                    if (mongoose.Types.ObjectId.isValid(name)) {
                        return [new mongoose.Types.ObjectId(name)];
                    }
                    const parts = name.split(" ").filter(Boolean);
                    const staffQuery = parts.length >= 2
                        ? {
                            $and: [
                                { firstName: { $regex: `^${parts[0]}$`, $options: "i" } },
                                { lastName: { $regex: `^${parts.slice(1).join(" ")}$`, $options: "i" } }
                            ]
                        }
                        : { firstName: { $regex: `^${parts[0]}$`, $options: "i" } };

                    const staffs = await mongoose.model("Staff").find(staffQuery).select("_id").lean();
                    return staffs.map(s => s._id);
                })
            );
            filterStaffIds = staffResults.flat();

            if (filterStaffIds.length === 0) {
                return { success: true, data: [], count: 0 };
            }

            if (finalAssignToIds.length > 0) {
                const intersection = finalAssignToIds.filter((id) =>
                    filterStaffIds.some((fid) => fid.toString() === id.toString())
                );
                if (intersection.length === 0) {
                    return { success: true, data: [], count: 0 };
                }
                finalAssignToIds = intersection;
            } else {
                finalAssignToIds = filterStaffIds;
            }
        }

        if (finalAssignToIds.length > 0) {
            postMatchConditions["assignToData._id"] = { $in: finalAssignToIds };
        }

        // PARTY FILTER
        if (party) {
            const partyNames = party.split(",").map((p) => p.trim()).filter((p) => p);
            if (partyNames.length > 0) {
                postMatchConditions["partyData.partyName"] = {
                    $in: partyNames.map((name) => new RegExp(name, "i")),
                };
            }
        }

        // AREA FILTER
        if (area) {
            const areaNames = area.split(",").map((a) => a.trim()).filter((a) => a);
            if (areaNames.length > 0) {
                postMatchConditions["areaData.area"] = {
                    $in: areaNames.map((name) => new RegExp(name, "i")),
                };
            }
        }

        // Apply post-match conditions
        if (Object.keys(postMatchConditions).length > 0) {
            pipeline.push({ $match: postMatchConditions });
        }

        /* ================================
           SEARCH
        ================================ */
        if (search && search.trim() !== "") {
            const searchRegex = { $regex: search, $options: "i" };

            pipeline.push({
                $match: {
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
                                    input: {
                                        $concat: ["$assignToData.firstName", " ", "$assignToData.lastName"],
                                    },
                                    regex: search,
                                    options: "i",
                                },
                            },
                        },
                        {
                            $expr: {
                                $regexMatch: {
                                    input: {
                                        $concat: [
                                            "$accountData.createdByData.firstName",
                                            " ",
                                            "$accountData.createdByData.lastName",
                                        ],
                                    },
                                    regex: search,
                                    options: "i",
                                },
                            },
                        },
                    ],
                },
            });
        }

        // Sort
        pipeline.push({ $sort: { createdAt: -1 } });

        /* ================================
           PROJECT — raw fields chahiye, transform JS mein karenge
        ================================ */
        pipeline.push({
            $project: {
                _id: 0,
                date: 1,
                rescheduleDate: 1,       // raw Date object — JS mein format karenge
                isRescheduledTask: 1,    // ✅ KEY FIELD: false = original task, true = nayi task
                status: 1,
                reasonForVisit: 1,
                remarks: 1,
                feedback: 1,
                visitDate: 1,
                visitTime: 1,
                priority: 1,
                "companyData.companyName": 1,
                "partyData.partyName": 1,
                "partyData.ownerName": 1,
                "partyData.ownerMobileNo": 1,
                "partyData.contactPerson": 1,
                "partyData.personMobileNo": 1,
                "partyData.contactMobileNo": 1,
                "partyData.partyTag": 1,
                "partyData.partyType": 1,
                "partyData.address.unitNo": 1,
                "marketNameData.marketName": 1,
                "areaData.area": 1,
                "assignToData.firstName": 1,
                "assignToData.lastName": 1,
                "accountData.createdByData.firstName": 1,
                "accountData.createdByData.lastName": 1,
                // Rescheduled task fields
                isRescheduledTask: 1,
                originalTaskId: 1,
                "originalTaskData._id": 1,
                "originalTaskData.date": 1,   // original task ki assign date
            },
        });

        const rawTasks = await assignTaskModel.aggregate(pipeline).allowDiskUse(true);

        /* ================================
           TRANSFORM
        ================================ */
        const transformedTasks = rawTasks.map((task) => {
            // ─── RESCHEDULE DATE LOGIC ────────────────────────────
            // isRescheduledTask: true  → YEH nayi task hai jab original reschedule hua
            //   - task.date             = new scheduled date (reschedule date)
            //   - originalTaskData.date = original task ki assign date
            // isRescheduledTask: false → Normal / original task hai
            //
            // Excel mein:
            //   isRescheduledTask=true  → ASSIGN DATE = originalTaskData.date, RESCHEDULE DATE = task.date
            //   isRescheduledTask=false → ASSIGN DATE = task.date, RESCHEDULE DATE = ""

            const isRescheduled = task.isRescheduledTask === true
            // task.originalTaskData &&
            // task.originalTaskData._id != null;

            let assignDateFormatted = "";
            let rescheduleDateFormatted = "";

            if (isRescheduled) {
                // Original assign date
                const origDate = task?.originalTaskData?.date
                    ? new Date(task.originalTaskData.date)
                    : null;

                if (origDate && !isNaN(origDate.getTime())) {
                    assignDateFormatted = moment(origDate).format("DD-MM-YYYY");
                }

                // Reschedule date (new task date)
                const reschedDate = task?.date
                    ? new Date(task.date)
                    : null;

                if (reschedDate && !isNaN(reschedDate.getTime())) {
                    rescheduleDateFormatted = moment(reschedDate).format("DD-MM-YYYY");
                } else {
                    rescheduleDateFormatted = ""; // 👈 explicitly blank
                }

            } else {
                // Normal task
                const assignDate = task?.date
                    ? new Date(task.date)
                    : null;

                if (assignDate && !isNaN(assignDate.getTime())) {
                    assignDateFormatted = moment(assignDate).format("DD-MM-YYYY");
                }
            }


            const party = task.partyData || {};
            const address = party.address || {};

            // marketName — array from lookup
            const mktName =
                Array.isArray(task.marketNameData) && task.marketNameData.length > 0
                    ? task.marketNameData[0].marketName || ""
                    : "";

            // area — array from lookup
            const areaVal =
                Array.isArray(task.areaData) && task.areaData.length > 0
                    ? task.areaData[0].area || ""
                    : "";

            const contactPerson =
                party.contactPerson && party.contactPerson !== ""
                    ? party.contactPerson
                    : party.ownerName || "";

            const mobileNo =
                party.contactMobileNo && party.contactMobileNo !== ""
                    ? party.contactMobileNo
                    : party.personMobileNo && party.personMobileNo !== ""
                        ? party.personMobileNo
                        : party.ownerMobileNo || "";

            const assignedTo = task.assignToData || {};

            let createdByName = "N/A";
            const cb = task.accountData?.createdByData;
            if (cb) {
                const full = `${cb.firstName || ""} ${cb.lastName || ""}`.trim();
                if (full) createdByName = full;
            }

            const companyName = task.companyData?.companyName || "";

            // ─── Visit Date ────────────────────────────────────────
            let visitDateValue = "Not Visited";
            if (task.visitDate) {
                const vd = new Date(task.visitDate);
                if (!isNaN(vd.getTime())) {
                    visitDateValue = moment(vd).format("DD-MM-YYYY");
                }
            }

            return {
                DATE: assignDateFormatted,                 // Original task date (ya originalTaskData.date for rescheduled)
                "RESCHEDULE DATE": rescheduleDateFormatted, // Nayi date (sirf isRescheduledTask=true wale tasks mein)
                "PARTY NAME": party.partyName || "",
                "UNIT NO": address.unitNo || "",
                "MKT NAME": mktName,
                AREA: areaVal,
                "CONTACT P": contactPerson,
                "MOBILE NO": mobileNo,
                TAG: party.partyTag || "",
                TYPE: party.partyType || "",
                STATUS: task.status || "",
                REMARKS: task.remarks || "",
                FEEDBACK: task.feedback || "",
                "REASON FOR VISIT": task.reasonForVisit || "",
                "ASSIGNED TO":
                    assignedTo.firstName || assignedTo.lastName
                        ? `${assignedTo.firstName || ""} ${assignedTo.lastName || ""}`.trim()
                        : "",
                "CREATED BY": createdByName,
                "COMPANY NAME": companyName,
                "VISIT DATE": visitDateValue,
                "VISIT TIME": task.visitTime || "",
                PRIORITY: task.priority || "",
            };
        });

        return {
            success: true,
            count: transformedTasks.length,
            data: transformedTasks,
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


// ─────────────────────────────────────────────────────────────
//  EXPORT API
// ─────────────────────────────────────────────────────────────
exports.exportAssignTasksToExcel = async (req, res) => {
    try {
        const result = await getTasksDataForExcel(req);

        if (!result.success || !result.data || result.data.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No data found to export",
            });
        }

        const tasks = result.data;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Assign Tasks");

        worksheet.columns = [
            { header: "Sr no", key: "Sr no", width: 8 },
            { header: "ASSIGN DATE", key: "DATE", width: 14 },
            { header: "RESCHEDULE DATE", key: "RESCHEDULE DATE", width: 14 },
            { header: "PARTY NAME", key: "PARTY NAME", width: 25 },
            { header: "UNIT NO", key: "UNIT NO", width: 12 },
            { header: "MKT NAME", key: "MKT NAME", width: 20 },
            { header: "AREA", key: "AREA", width: 20 },
            { header: "CONTACT P", key: "CONTACT P", width: 20 },
            { header: "MOBILE NO", key: "MOBILE NO", width: 15 },
            { header: "TAG", key: "TAG", width: 10 },
            { header: "TYPE", key: "TYPE", width: 10 },
            { header: "REASON FOR VISIT", key: "REASON FOR VISIT", width: 20 },
            { header: "STATUS", key: "STATUS", width: 12 },
            { header: "ASSIGNED TO", key: "ASSIGNED TO", width: 20 },
            { header: "REMARKS", key: "REMARKS", width: 25 },
            { header: "FEEDBACK", key: "FEEDBACK", width: 25 },
        ];

        tasks.forEach((task, index) => {
            worksheet.addRow({
                "Sr no": index + 1,
                DATE: task.DATE || "",
                "RESCHEDULE DATE": task["RESCHEDULE DATE"] || "",
                "PARTY NAME": task["PARTY NAME"] || "",
                "UNIT NO": task["UNIT NO"] || "",
                "MKT NAME": task["MKT NAME"] || "",
                AREA: task.AREA || "",
                "CONTACT P": task["CONTACT P"] || "",
                "MOBILE NO": task["MOBILE NO"] || "",
                TAG: task.TAG || "",
                TYPE: task.TYPE || "",
                "REASON FOR VISIT": task["REASON FOR VISIT"] || "",

                // ✅ STATUS AUTO CHANGE
                STATUS: task["RESCHEDULE DATE"]
                    ? "Rescheduled"
                    : task.STATUS || "",

                "ASSIGNED TO": task["ASSIGNED TO"] || "",
                REMARKS: task.REMARKS || "",
                FEEDBACK: task.FEEDBACK || "",
            });
        });


        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FF000000" } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFD3D3D3" },
            };
            cell.alignment = { vertical: "middle", horizontal: "center" };
        });
        headerRow.height = 20;

        // Auto-fit columns
        // worksheet.columns.forEach((column) => {
        //     let maxLen = column.header ? column.header.length : 10;
        //     column.eachCell({ includeEmpty: true }, (cell) => {
        //         const len = cell.value ? cell.value.toString().length : 0;
        //         if (len > maxLen) maxLen = len;
        //     });
        //     column.width = Math.min(maxLen + 2, 50);
        // });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="assign_tasks_${new Date().toISOString().split("T")[0]}.xlsx"`
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Error exporting assign tasks to Excel:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export tasks to Excel",
            error: error.message,
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
                    "PARTY TYPE": "$partyData.partyType",

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
            { header: 'PARTY TYPE', key: 'PARTY TYPE', width: 10 },
            { header: 'REASON', key: 'REASON', width: 20 },
            { header: 'STATUS', key: 'STATUS', width: 12 },
            { header: 'ASSIGNED TO', key: 'ASSIGNED TO', width: 20 },
            // { header: 'CREATED BY', key: 'CREATED BY', width: 20 },
            { header: 'REMARKS', key: 'REMARKS', width: 25 },
            { header: 'CALL FEEDBACK', key: 'CALL FEEDBACK', width: 25 },
        ];

        // Add data rows with required fields
        leads.forEach((lead, index) => {
            worksheet.addRow({
                'Sr no': index + 1,
                DATE: moment(lead.DATE).format('DD-MM-YYYY') || '', // यहाँ formatting apply करें
                'PARTY NAME': lead['PARTY NAME'] || '',
                'COMPANY NAME': lead['COMPANY NAME'] || '',
                'UNIT NO': lead['UNIT NO'] || '',
                'MKT NAME': lead['MARKET NAME'] || lead['MKT NAME'] || '',
                AREA: lead.AREA || '',
                'CONTACT PERSON': lead['CONTACT PERSON'] || lead['OWNER NAME'] || '',
                'MOBILE NO': lead['PRIMARY MOBILE'] || lead['MOBILE NO'] || '',
                TAG: lead['PARTY TAG'] || lead.TAG || '',
                'PARTY TYPE': lead['PARTY TYPE'] || '',
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
                orderDate: moment(order.orderDate).format('DD-MM-YYYY') || '',
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
                createdDate: moment(order.createdAt).format('DD-MM-YYYY') || ''
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
            { header: 'Qty', key: 'qty', width: 10 },
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
                .select("orderNumber designerAssignedAt size designerStatus qty");

            // === Designer Name as merged header across all columns ===
            worksheet.mergeCells(currentRowNumber, 1, currentRowNumber, 9); // 8 columns
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
                        qty: order.qty || '-',
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
                    qty: '',
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
            { header: 'Qty', key: 'qty', width: 10 },
            { header: 'Number', key: 'number', width: 12 },
            { header: 'Color', key: 'color', width: 12 },
            { header: 'P.Type', key: 'pType', width: 12 },    // Width reduced because only 1 letter
            { header: 'Remarks', key: 'remarks', width: 30 },
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
                        qty: order.qty || '-',
                        number: numberShort,                        // Y or N
                        color: order.color || '-',
                        pType: pTypeShort,                          // O, S, or O
                        remarks: order.printerRemarks || '-',
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
                    qty: '',
                    number: '',
                    color: '',
                    pType: '',
                    remarks: '',
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
            { header: 'Party Name', key: 'partyName', width: 30 },
            { header: 'Size', key: 'size', width: 15 },
            { header: 'Item Name', key: 'itemName', width: 25 },
            { header: 'Qty', key: 'qty', width: 10 },
            { header: 'Remark', key: 'remark', width: 35 },
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
                .select("orderNumber binderRemarks size party productItem qty");

            // Binder Name - Merged across all 6 columns
            worksheet.mergeCells(currentRowNumber, 1, currentRowNumber, 7);
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
                        partyName: order.party?.partyName || '-',
                        size: order.size || '-',
                        itemName: order.productItem?.itemName || '-',
                        qty: order.qty || '-',
                        remark: order.binderRemarks || '-',
                    });
                });
            } else {
                worksheet.addRow({
                    srNo: localSrNo++,
                    orderNo: 'No orders in this period',
                    partyName: '',
                    size: '',
                    itemName: '',
                    qty: '',
                    remark: '',
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
            { header: 'Party Name', key: 'partyName', width: 30 },
            { header: 'Size', key: 'size', width: 15 },
            { header: 'Item Name', key: 'itemName', width: 25 },
            { header: 'Qty', key: 'qty', width: 10 },
            { header: 'Remark', key: 'remark', width: 35 },
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
                .select("orderNumber bookletBinderRemarks size qty");

            // Merged header for name
            worksheet.mergeCells(currentRowNumber, 1, currentRowNumber, 7);
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
                        partyName: order.party?.partyName || '-',
                        size: order.size || '-',
                        itemName: order.productItem?.itemName || '-',
                        qty: order.qty || '-',
                        remark: order.bookletBinderRemarks || '-',
                    });
                });
            } else {
                worksheet.addRow({
                    srNo: localSrNo++,
                    orderNo: 'No orders in this period',
                    partyName: '',
                    size: '',
                    itemName: '',
                    qty: '',
                    remark: '',
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
        const {
            companyNames = [],
            filters = {},
            search = "",
            startDate,
            endDate,
            isDifference
        } = req.body;

        if (!Array.isArray(companyNames) || companyNames.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No companies specified",
            });
        }

        // =============================
        // FETCH COMPANIES
        // =============================
        const companies = await CompanyName.find({
            companyName: { $in: companyNames },
        }).lean();

        if (!companies.length) {
            return res.status(400).json({
                success: false,
                message: "No matching companies found",
            });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Payment Pending Report");

        // =============================
        // LAST 4 MONTHS (EXCLUDING CURRENT)
        // =============================
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const last4Months = [];
        for (let i = 4; i >= 1; i--) {
            const d = new Date(currentYear, currentMonth - i, 1);
            last4Months.push({
                month: d.getMonth() + 1,
                year: d.getFullYear(),
                label: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
            });
        }
        if (isDifference === true) {
            const curr = new Date(currentYear, currentMonth, 1);
            last4Months.push({
                month: curr.getMonth() + 1,
                year: curr.getFullYear(),
                label: curr.toLocaleString("en-US", { month: "short" }).toUpperCase(),
            });
        }

        // Helper function to get payment term days
        const getPaymentTermDays = (paymentTerms) => {
            if (!paymentTerms) return 0;

            const term = paymentTerms.toLowerCase();

            if (term.includes("30") || term.includes("thirty")) {
                return 30;
            } else if (term.includes("60") || term.includes("sixty")) {
                return 60;
            } else if (term.includes("90") || term.includes("ninety")) {
                return 90;
            } else {
                // Extract custom number of days
                const match = term.match(/(\d+)\s*day/i);
                if (match) {
                    return parseInt(match[1]);
                }
            }
            return 0;
        };

        const isInLast4Months = (month, year) => {
            return last4Months.some(
                (m) => m.month === month && m.year === year
            );
        };

        const isOldDate = (month, year) => {
            // Check if it's current month
            if (month === currentMonth + 1 && year === currentYear) {
                return false;
            }
            // Old = not in last 4 months and not current month
            return !isInLast4Months(month, year);
        };

        // =============================
        // EXCEL COLUMNS
        // =============================
        const monthColumns = last4Months.map((m) => ({
            header: m.label,
            key: m.label,
            width: 14,
        }));

        worksheet.columns = [
            { header: "S.NO", key: "srNo", width: 8 },
            { header: "PARTY NAME", key: "partyName", width: 30 },
            { header: "PHONE NO", key: "phoneNumber", width: 18 },
            { header: "CONTACT PERSON NAME", key: "contactPerson", width: 22 },
            { header: "OLD", key: "OLD", width: 14 },
            ...monthColumns,
            { header: "TOTAL", key: "TOTAL", width: 15 },
            { header: "DIFFERENCE", key: "difference", width: 15 },
            { header: "ASSIGN TO", key: "assignTo", width: 20 },
            { header: "ASSIGN DATE", key: "assignDate", width: 18 },
            { header: "TASK STATUS", key: "taskStatus", width: 15 },
            { header: "REMARKS", key: "remarks", width: 30 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

        let srNo = 1;

        // =============================
        // LOOP COMPANIES
        // =============================
        for (const comp of companies) {
            const startRow = worksheet.lastRow
                ? worksheet.lastRow.number + 1
                : 2;

            worksheet.mergeCells(
                startRow,
                1,
                startRow,
                worksheet.columns.length
            );

            const titleRow = worksheet.getRow(startRow);
            titleRow.getCell(1).value = comp.companyName;
            titleRow.font = { bold: true, size: 13 };
            titleRow.alignment = { horizontal: "center" };
            titleRow.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE0E0E0" },
            };

            // =============================
            // FETCH PAYMENT FOLDERS
            // =============================
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
                    { remarks: { $regex: search, $options: "i" } },
                    { month: { $regex: search, $options: "i" } },
                    { area: { $regex: search, $options: "i" } },
                ];

                // Company search with multi-word support
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

                // Party search with multi-word support
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

                // Assigned to (Staff) search with multi-word support
                const staffFields = ['firstName', 'lastName', 'email'];
                const staffConditions = buildMultiWordSearch(search, staffFields);
                if (staffConditions.length > 0) {
                    const matchingStaff = await Staff.find({
                        $or: staffConditions
                    }).select('_id').lean();
                    const staffIds = matchingStaff.map(s => s._id);
                    if (staffIds.length > 0) {
                        directOr.push({ assignedTo: { $in: staffIds } });
                    }
                }

                if (directOr.length > 0) {
                    query.$or = directOr;
                }
            }

            // AssignedDate filter - Match exact dates from array
            if (filters.assignedDate && Array.isArray(filters.assignedDate) && filters.assignedDate.length > 0) {
                // Filter out null/empty values
                const validDates = filters.assignedDate.filter(d => d && d !== 'null');

                if (validDates.length > 0) {
                    // Create date range conditions for each date (match full day)
                    const dateConditions = validDates.map(dateStr => {
                        const startOfDay = new Date(dateStr);
                        startOfDay.setHours(0, 0, 0, 0);

                        const endOfDay = new Date(dateStr);
                        endOfDay.setHours(23, 59, 59, 999);

                        return {
                            assignedDate: {
                                $gte: startOfDay,
                                $lte: endOfDay
                            }
                        };
                    });

                    // Use $or to match any of the dates
                    if (dateConditions.length === 1) {
                        query.assignedDate = dateConditions[0].assignedDate;
                    } else {
                        query.$or = query.$or
                            ? [...query.$or, ...dateConditions]
                            : dateConditions;
                    }
                }
            }

            // Top-level startDate/endDate (for date range if needed separately)
            if ((startDate || endDate) && (!filters.assignedDate || filters.assignedDate.length === 0)) {
                query.assignedDate = {};
                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    query.assignedDate.$gte = start;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    query.assignedDate.$lte = end;
                }
            }

            // Company filter
            if (filters.company && filters.company.length > 0) {
                const companies = await CompanyName.find({
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

            // Area filter
            if (filters.area && filters.area.length > 0) {
                query.area = { $in: filters.area };
            }

            // Month filter
            if (filters.month && filters.month.length > 0) {
                query.month = { $in: filters.month };
            }

            // Remarks filter
            if (filters.remarks && filters.remarks.length > 0) {
                query.remarks = { $in: filters.remarks };
            }

            // Assigned to filter
            if (filters.assignTo && filters.assignTo.length > 0) {
                const nameConditions = filters.assignTo.map(name => {
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
                    query.assignedTo = { $in: matchingStaff.map(s => s._id) };
                }
            }

            // Payment amount range filter
            if (filters.paymentAmount && (filters.paymentAmount.min !== undefined || filters.paymentAmount.max !== undefined)) {
                query.paymentAmount = {};
                if (filters.paymentAmount.min !== undefined) {
                    query.paymentAmount.$gte = filters.paymentAmount.min;
                }
                if (filters.paymentAmount.max !== undefined) {
                    query.paymentAmount.$lte = filters.paymentAmount.max;
                }
            }

            // Task Status filter
            if (filters.taskStatus && filters.taskStatus.length > 0) {
                query.taskStatus = { $in: filters.taskStatus };
            }

            // Difference filter
            if (isDifference) {
                query.differenceAmount = { $gt: 0 };
            }

            const folders = await PaymentFolder.find({
                company: comp._id,
                ...query,
            })
                .populate({
                    path: "party",
                    select:
                        "partyName contactMobileNo ownerMobileNo contactPerson ownerName contactWhatsAppNo contactForPayment",
                })
                .populate("assignedTo", "firstName lastName")
                .populate({
                    path: "assignTask",
                    select: "status followUpDate followUpTime notes isRescheduledTask date rescheduleDate originalTaskId",
                    populate: { path: "originalTaskId", select: "date" }
                })
                .sort({ createdAt: -1 });


            // =============================
            // SEARCH FILTER
            // =============================
            if (search?.trim()) {
                const s = search.toLowerCase();
                folders = folders.filter((f) => {
                    const p = f.party || {};
                    const task = f.assignTask || {};
                    return (
                        p.partyName?.toLowerCase().includes(s) ||
                        p.contactPerson?.toLowerCase().includes(s) ||
                        p.ownerName?.toLowerCase().includes(s) ||
                        f.remarks?.toLowerCase().includes(s) ||
                        task.status?.toLowerCase().includes(s)
                    );
                });
            }

            // =============================
            // PARTY-WISE AGGREGATION
            // =============================
            const partyMap = new Map();

            for (const folder of folders) {
                const payments = Array.isArray(folder.payments)
                    ? folder.payments
                    : [];

                const totalReceived = payments.reduce(
                    (sum, p) => sum + (p.amount || 0),
                    0
                );

                // Calculate pending amount WITHOUT subtracting difference amount
                const pendingAmount = (folder.paymentAmount || 0) - totalReceived - (folder.differenceAmount || 0);

                // Get difference amount
                const differenceAmount = folder.differenceAmount || 0;

                // Only include if payment is NOT fully received AND there's pending amount
                if (pendingAmount <= 0) continue;

                const party = folder.party;
                if (!party?._id) continue;

                const partyId = party._id.toString();

                // Initialize party entry if not exists
                if (!partyMap.has(partyId)) {
                    const base = {
                        partyName: party.partyName || "-",
                        phoneNumber:
                            party.contactMobileNo || party.ownerMobileNo || party.contactWhatsAppNo || "-",
                        contactPerson:
                            party.contactPerson || party.ownerName || party.contactForPayment || "-",
                        OLD: 0,
                        TOTAL: 0,
                        difference: 0,
                        assignTo: "",
                        assignDate: "",
                        taskStatus: "",
                        remarks: "",
                    };

                    last4Months.forEach((m) => (base[m.label] = 0));
                    partyMap.set(partyId, base);
                }

                const row = partyMap.get(partyId);

                // Add difference amount to total difference (aggregate all difference amounts for this party)
                row.difference += differenceAmount;

                // Get month from folder.month field
                if (folder.month) {
                    // Parse month from "Aug" format
                    let paymentMonth, paymentYear;

                    // Format: "Aug", "SEP", etc.
                    const monthNames = {
                        JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
                        JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
                    };

                    // Handle both uppercase and proper case month names
                    const monthUpper = folder.month.toUpperCase();
                    paymentMonth = monthNames[monthUpper];

                    if (folder.assignedDate) {
                        const assignDate = new Date(folder.assignedDate);
                        const assignMonth = assignDate.getMonth() + 1;
                        let assignYear = assignDate.getFullYear();

                        // 🔥 FIX: Correct year calculation
                        // Bug: sirf `paymentMonth > assignMonth` se year-1 karte the
                        // Issue: NOV(11) assigned Jan(1) 2025 → 11>1 TRUE → 2024 set hota tha
                        // Lekin NOV 2024 last4Months mein nahi tha toh OLD column mein jaata tha ❌
                        //
                        // Correct logic:
                        // - Month difference > 6: clearly pichle saal ka
                        //   (e.g., DEC assigned JAN → 12-1=11 > 6 → pichle saal ka DEC ✅)
                        // - Month difference <= 6: createdAt se year confirm karo
                        if (paymentMonth > assignMonth) {
                            const monthDiff = paymentMonth - assignMonth;
                            if (monthDiff > 6) {
                                // Clearly pichle saal ka (e.g., DEC in JAN, NOV in Mar)
                                assignYear = assignYear - 1;
                            } else {
                                // Ambiguous - createdAt se confirm karo
                                const folderCreatedYear = folder.createdAt
                                    ? new Date(folder.createdAt).getFullYear()
                                    : assignYear;
                                if (folderCreatedYear < assignYear) {
                                    assignYear = folderCreatedYear;
                                }
                                // Else: same year, kuch change nahi
                            }
                        }

                        paymentYear = assignYear;
                    } else if (folder.createdAt) {
                        // assignedDate nahi hai toh createdAt se year lo
                        const createdDate = new Date(folder.createdAt);
                        const createdMonth = createdDate.getMonth() + 1;
                        let createdYear = createdDate.getFullYear();

                        // Agar paymentMonth createdAt month se > 6 aage hai toh pichle saal
                        if (paymentMonth > createdMonth && (paymentMonth - createdMonth) > 6) {
                            createdYear = createdYear - 1;
                        }

                        paymentYear = createdYear;
                    } else {
                        paymentYear = currentYear;
                    }

                    // Find matching month in last 4 months
                    const matchingMonth = last4Months.find(
                        (m) => m.month === paymentMonth && m.year === paymentYear
                    );

                    if (matchingMonth) {
                        // Add pending amount to specific month column
                        row[matchingMonth.label] += pendingAmount;
                    } else if (isOldDate(paymentMonth, paymentYear)) {
                        // Add to OLD if before last 4 months
                        row.OLD += pendingAmount;
                    }
                    // Current month inclusion handled via last4Months when isDifference === true
                }

                // Update total
                row.TOTAL += pendingAmount;

                // Update assignment details (use latest folder's details)
                if (folder.assignedTo) {
                    row.assignTo = `${folder.assignedTo.firstName || ""} ${folder.assignedTo.lastName || ""}`.trim();
                }
                if (folder.assignedDate) {
                    row.assignDate = moment(folder.assignedDate).format("DD-MM-YYYY");
                }

                // Get task status from populated assignTask
                if (folder.assignTask) {
                    const task = folder.assignTask;
                    let statusText;

                    if (task.isRescheduledTask === true) {
                        const oldDate =
                            task.originalTaskId && task.originalTaskId.date
                                ? moment(task.originalTaskId.date).format("DD-MM-YYYY")
                                : "-";
                        const newDate =
                            folder.assignedDate
                                ? moment(folder.assignedDate).format("DD-MM-YYYY")
                                : (task.date ? moment(task.date).format("DD-MM-YYYY") : "-");
                        statusText = `Rescheduled (Old: ${oldDate} → New: ${newDate})`;
                    } else {
                        statusText = task.status || "Pending";
                        statusText = statusText.charAt(0).toUpperCase() + statusText.slice(1).toLowerCase();
                    }

                    // Add follow-up info if available
                    if (task.followUpDate) {
                        const followUpDate = moment(task.followUpDate).format("DD-MM-YYYY");
                        statusText += ` (Follow-up: ${followUpDate}`;
                        if (task.followUpTime) {
                            statusText += ` ${task.followUpTime}`;
                        }
                        statusText += `)`;
                    }

                    row.taskStatus = statusText;
                } else {
                    row.taskStatus = "Not Assigned";
                }

                if (folder.remarks) {
                    row.remarks = folder.remarks;
                }
            }

            // =============================
            // WRITE EXCEL ROWS
            // =============================
            const sortedParties = Array.from(partyMap.values()).sort((a, b) =>
                a.partyName.localeCompare(b.partyName)
            );

            for (const data of sortedParties) {
                const newRow = worksheet.addRow({
                    srNo: srNo++,
                    ...data,
                });

                // Format currency columns
                const monthColumnStart = 6;
                const monthCount = monthColumns.length;
                const totalColIndex = monthColumnStart + monthCount;
                const differenceColIndex = totalColIndex + 1;
                const currencyColumns = [
                    5, // OLD
                    ...Array.from({ length: monthCount }, (_, i) => monthColumnStart + i),
                    totalColIndex,
                    differenceColIndex
                ];
                currencyColumns.forEach(col => {
                    newRow.getCell(col).numFmt = '#,##0';
                });

                // Apply conditional formatting for task status
                const statusCell = newRow.getCell(12); // Task Status column
                if (data.taskStatus.includes('Rescheduled')) {
                    statusCell.font = { color: { argb: 'FFFF9800' } }; // Orange
                    statusCell.font = { bold: true };
                } else if (data.taskStatus.includes('Pending')) {
                    statusCell.font = { color: { argb: 'FF9C27B0' } }; // Purple
                    statusCell.font = { bold: true };
                } else if (data.taskStatus.includes('Completed')) {
                    statusCell.font = { color: { argb: 'FF4CAF50' } }; // Green
                    statusCell.font = { bold: true };
                } else if (data.taskStatus.includes('Not Assigned')) {
                    statusCell.font = { color: { argb: 'FF9E9E9E' } }; // Grey
                    statusCell.font = { italic: true };
                }
            }

            // Add empty row after each company
            worksheet.addRow({});
        }

        // =============================
        // AUTO-FIT COLUMNS
        // =============================
        worksheet.columns.forEach((column) => {
            if (column.header) {
                column.width = Math.max(
                    column.width || 10,
                    column.header.length + 2
                );
            }
        });

        // =============================
        // SEND RESPONSE
        // =============================
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="Pending_Payment_Report_${moment().format(
                "DDMMYYYY"
            )}.xlsx"`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error("Export error:", err);
        res.status(500).json({
            success: false,
            message: "Export failed",
            error: err.message,
        });
    }
};

exports.exportPaymentFolderDifferenceToExcel = async (req, res) => {
    try {
        const {
            companyNames = [],
            filters = {},
            search = "",
            startDate,
            endDate,
            isDifference
        } = req.body;

        if (!Array.isArray(companyNames) || companyNames.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No companies specified",
            });
        }

        // =============================
        // FETCH COMPANIES
        // =============================
        const companies = await CompanyName.find({
            companyName: { $in: companyNames },
        }).lean();

        if (!companies.length) {
            return res.status(400).json({
                success: false,
                message: "No matching companies found",
            });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Payment Difference Report");

        // =============================
        // LAST 4 MONTHS (EXCLUDING CURRENT)
        // =============================
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const last4Months = [];
        for (let i = 4; i >= 1; i--) {
            const d = new Date(currentYear, currentMonth - i, 1);
            last4Months.push({
                month: d.getMonth() + 1,
                year: d.getFullYear(),
                label: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
            });
        }

        // Current month ko include karo (difference ke liye)
        const curr = new Date(currentYear, currentMonth, 1);
        last4Months.push({
            month: curr.getMonth() + 1,
            year: curr.getFullYear(),
            label: curr.toLocaleString("en-US", { month: "short" }).toUpperCase(),
        });

        // Helper function to get payment term days
        const getPaymentTermDays = (paymentTerms) => {
            if (!paymentTerms) return 0;

            const term = paymentTerms.toLowerCase();

            if (term.includes("30") || term.includes("thirty")) {
                return 30;
            } else if (term.includes("60") || term.includes("sixty")) {
                return 60;
            } else if (term.includes("90") || term.includes("ninety")) {
                return 90;
            } else {
                // Extract custom number of days
                const match = term.match(/(\d+)\s*day/i);
                if (match) {
                    return parseInt(match[1]);
                }
            }
            return 0;
        };

        const isInLast4Months = (month, year) => {
            return last4Months.some(
                (m) => m.month === month && m.year === year
            );
        };

        const isOldDate = (month, year) => {
            // Check if it's current month
            if (month === currentMonth + 1 && year === currentYear) {
                return false;
            }
            // Old = not in last 4 months and not current month
            return !isInLast4Months(month, year);
        };

        // =============================
        // EXCEL COLUMNS
        // =============================
        const monthColumns = last4Months.map((m) => ({
            header: m.label,
            key: m.label,
            width: 14,
        }));

        worksheet.columns = [
            { header: "S.NO", key: "srNo", width: 8 },
            { header: "PARTY NAME", key: "partyName", width: 30 },
            { header: "PHONE NO", key: "phoneNumber", width: 18 },
            { header: "CONTACT PERSON NAME", key: "contactPerson", width: 22 },
            { header: "OLD", key: "OLD", width: 14 },
            ...monthColumns,
            { header: "TOTAL", key: "TOTAL", width: 15 },
            { header: "DIFFERENCE AMOUNT", key: "difference", width: 18 },
            { header: "ASSIGN TO", key: "assignTo", width: 20 },
            { header: "ASSIGN DATE", key: "assignDate", width: 18 },
            { header: "TASK STATUS", key: "taskStatus", width: 15 },
            { header: "REMARKS", key: "remarks", width: 30 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

        let srNo = 1;

        // =============================
        // LOOP COMPANIES
        // =============================
        for (const comp of companies) {
            const startRow = worksheet.lastRow
                ? worksheet.lastRow.number + 1
                : 2;

            worksheet.mergeCells(
                startRow,
                1,
                startRow,
                worksheet.columns.length
            );

            const titleRow = worksheet.getRow(startRow);
            titleRow.getCell(1).value = comp.companyName;
            titleRow.font = { bold: true, size: 13 };
            titleRow.alignment = { horizontal: "center" };
            titleRow.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE0E0E0" },
            };

            // =============================
            // FETCH PAYMENT FOLDERS
            // =============================
            // Build query object
            const query = {};

            // Helper function to build multi-word search conditions
            // const buildMultiWordSearch = (searchStr, fields) => {
            //     if (!searchStr || !searchStr.trim()) return [];
            //     const parts = searchStr.trim().split(/\s+/).filter(p => p.length > 0);
            //     if (parts.length === 0) return [];

            //     const partConditions = parts.map(part => ({
            //         $or: fields.map(field => ({
            //             [field]: { $regex: part, $options: "i" }
            //         }))
            //     }));

            //     if (parts.length === 1) {
            //         return partConditions[0].$or;
            //     } else {
            //         return [{ $and: partConditions }];
            //     }
            // };

            // Search functionality
            // if (search && search.trim()) {
            //     const directOr = [
            //         { remarks: { $regex: search, $options: "i" } },
            //         { month: { $regex: search, $options: "i" } },
            //         { area: { $regex: search, $options: "i" } },
            //     ];

            //     // Company search with multi-word support
            //     const companyFields = ['companyName'];
            //     const companyConditions = buildMultiWordSearch(search, companyFields);
            //     if (companyConditions.length > 0) {
            //         const matchingCompanies = await Company.find({
            //             $or: companyConditions
            //         }).select('_id').lean();
            //         const companyIds = matchingCompanies.map(c => c._id);
            //         if (companyIds.length > 0) {
            //             directOr.push({ company: { $in: companyIds } });
            //         }
            //     }

            //     // Party search with multi-word support
            //     const partyFields = ['partyName'];
            //     const partyConditions = buildMultiWordSearch(search, partyFields);
            //     if (partyConditions.length > 0) {
            //         const matchingParties = await Party.find({
            //             $or: partyConditions
            //         }).select('_id').lean();
            //         const partyIds = matchingParties.map(p => p._id);
            //         if (partyIds.length > 0) {
            //             directOr.push({ party: { $in: partyIds } });
            //         }
            //     }

            //     // Assigned to (Staff) search with multi-word support
            //     const staffFields = ['firstName', 'lastName', 'email'];
            //     const staffConditions = buildMultiWordSearch(search, staffFields);
            //     if (staffConditions.length > 0) {
            //         const matchingStaff = await Staff.find({
            //             $or: staffConditions
            //         }).select('_id').lean();
            //         const staffIds = matchingStaff.map(s => s._id);
            //         if (staffIds.length > 0) {
            //             directOr.push({ assignedTo: { $in: staffIds } });
            //         }
            //     }

            //     if (directOr.length > 0) {
            //         query.$or = directOr;
            //     }
            // }

            // // AssignedDate filter - Match exact dates from array
            // if (filters.assignedDate && Array.isArray(filters.assignedDate) && filters.assignedDate.length > 0) {
            //     // Filter out null/empty values
            //     const validDates = filters.assignedDate.filter(d => d && d !== 'null');

            //     if (validDates.length > 0) {
            //         // Create date range conditions for each date (match full day)
            //         const dateConditions = validDates.map(dateStr => {
            //             const startOfDay = new Date(dateStr);
            //             startOfDay.setHours(0, 0, 0, 0);

            //             const endOfDay = new Date(dateStr);
            //             endOfDay.setHours(23, 59, 59, 999);

            //             return {
            //                 assignedDate: {
            //                     $gte: startOfDay,
            //                     $lte: endOfDay
            //                 }
            //             };
            //         });

            //         // Use $or to match any of the dates
            //         if (dateConditions.length === 1) {
            //             query.assignedDate = dateConditions[0].assignedDate;
            //         } else {
            //             query.$or = query.$or
            //                 ? [...query.$or, ...dateConditions]
            //                 : dateConditions;
            //         }
            //     }
            // }

            // // Top-level startDate/endDate (for date range if needed separately)
            // if ((startDate || endDate) && (!filters.assignedDate || filters.assignedDate.length === 0)) {
            //     query.assignedDate = {};
            //     if (startDate) {
            //         const start = new Date(startDate);
            //         start.setHours(0, 0, 0, 0);
            //         query.assignedDate.$gte = start;
            //     }
            //     if (endDate) {
            //         const end = new Date(endDate);
            //         end.setHours(23, 59, 59, 999);
            //         query.assignedDate.$lte = end;
            //     }
            // }

            // // Company filter
            // if (filters.company && filters.company.length > 0) {
            //     const companies = await CompanyName.find({
            //         companyName: { $in: filters.company }
            //     }).select('_id').lean();
            //     if (companies.length > 0) {
            //         query.company = { $in: companies.map(c => c._id) };
            //     }
            // }

            // // Party filter
            // if (filters.party && filters.party.length > 0) {
            //     const parties = await Party.find({
            //         partyName: { $in: filters.party }
            //     }).select('_id').lean();
            //     if (parties.length > 0) {
            //         query.party = { $in: parties.map(p => p._id) };
            //     }
            // }

            // // Area filter
            // if (filters.area && filters.area.length > 0) {
            //     query.area = { $in: filters.area };
            // }

            // // Month filter
            // if (filters.month && filters.month.length > 0) {
            //     query.month = { $in: filters.month };
            // }

            // // Remarks filter
            // if (filters.remarks && filters.remarks.length > 0) {
            //     query.remarks = { $in: filters.remarks };
            // }

            // // Assigned to filter
            // if (filters.assignTo && filters.assignTo.length > 0) {
            //     const nameConditions = filters.assignTo.map(name => {
            //         const parts = name.split(' ');
            //         if (parts.length === 2) {
            //             return {
            //                 firstName: { $regex: `^${parts[0]}`, $options: "i" },
            //                 lastName: { $regex: `^${parts[1]}`, $options: "i" }
            //             };
            //         } else {
            //             return {
            //                 $or: [
            //                     { firstName: { $regex: `^${name}`, $options: "i" } },
            //                     { lastName: { $regex: `^${name}`, $options: "i" } }
            //                 ]
            //             };
            //         }
            //     });
            //     const matchingStaff = await Staff.find({
            //         $or: nameConditions
            //     }).select('_id').lean();

            //     if (matchingStaff.length > 0) {
            //         query.assignedTo = { $in: matchingStaff.map(s => s._id) };
            //     }
            // }

            // // Payment amount range filter
            // if (filters.paymentAmount && (filters.paymentAmount.min !== undefined || filters.paymentAmount.max !== undefined)) {
            //     query.paymentAmount = {};
            //     if (filters.paymentAmount.min !== undefined) {
            //         query.paymentAmount.$gte = filters.paymentAmount.min;
            //     }
            //     if (filters.paymentAmount.max !== undefined) {
            //         query.paymentAmount.$lte = filters.paymentAmount.max;
            //     }
            // }

            // // Task Status filter
            // if (filters.taskStatus && filters.taskStatus.length > 0) {
            //     query.taskStatus = { $in: filters.taskStatus };
            // }

            // SIRF DIFFERENCE WALA DATA - Only fetch folders with difference amount > 0
            query.differenceAmount = { $gt: 0 };

            const folders = await PaymentFolder.find({
                company: comp._id,
                ...query,
            })
                .populate({
                    path: "party",
                    select:
                        "partyName contactMobileNo ownerMobileNo contactPerson ownerName contactWhatsAppNo contactForPayment",
                })
                .populate("assignedTo", "firstName lastName")
                .populate({
                    path: "assignTask",
                    select: "status followUpDate followUpTime notes isRescheduledTask date rescheduleDate originalTaskId",
                    populate: { path: "originalTaskId", select: "date" }
                })
                .sort({ createdAt: -1 });

            // =============================
            // SEARCH FILTER
            // =============================
            // if (search?.trim()) {
            //     const s = search.toLowerCase();
            //     folders = folders.filter((f) => {
            //         const p = f.party || {};
            //         const task = f.assignTask || {};
            //         return (
            //             p.partyName?.toLowerCase().includes(s) ||
            //             p.contactPerson?.toLowerCase().includes(s) ||
            //             p.ownerName?.toLowerCase().includes(s) ||
            //             f.remarks?.toLowerCase().includes(s) ||
            //             task.status?.toLowerCase().includes(s)
            //         );
            //     });
            // }

            // =============================
            // PARTY-WISE AGGREGATION - SIRF DIFFERENCE WALA DATA
            // =============================
            const partyMap = new Map();

            for (const folder of folders) {
                const payments = Array.isArray(folder.payments)
                    ? folder.payments
                    : [];

                const totalReceived = payments.reduce(
                    (sum, p) => sum + (p.amount || 0),
                    0
                );

                // Get difference amount
                const differenceAmount = folder.differenceAmount || 0;

                // Sirf wahi folders jinka difference amount > 0 hai
                if (differenceAmount <= 0) continue;

                const party = folder.party;
                if (!party?._id) continue;

                const partyId = party._id.toString();

                // Initialize party entry if not exists
                if (!partyMap.has(partyId)) {
                    const base = {
                        partyName: party.partyName || "-",
                        phoneNumber:
                            party.contactMobileNo || party.ownerMobileNo || party.contactWhatsAppNo || "-",
                        contactPerson:
                            party.contactPerson || party.ownerName || party.contactForPayment || "-",
                        OLD: 0,
                        TOTAL: 0,
                        difference: 0,
                        assignTo: "",
                        assignDate: "",
                        taskStatus: "",
                        remarks: "",
                    };

                    last4Months.forEach((m) => (base[m.label] = 0));
                    partyMap.set(partyId, base);
                }

                const row = partyMap.get(partyId);

                // Add difference amount to total difference (aggregate all difference amounts for this party)
                row.difference += differenceAmount;

                // Get month from folder.month field
                if (folder.month) {
                    // Parse month from "Aug" format
                    let paymentMonth, paymentYear;

                    // Format: "Aug", "SEP", etc.
                    const monthNames = {
                        JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
                        JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
                    };

                    // Handle both uppercase and proper case month names
                    const monthUpper = folder.month.toUpperCase();
                    paymentMonth = monthNames[monthUpper];

                    if (folder.assignedDate) {
                        const assignDate = new Date(folder.assignedDate);
                        const assignMonth = assignDate.getMonth() + 1;
                        let assignYear = assignDate.getFullYear();

                        // 🔥 FIX: Correct year calculation
                        // Bug: sirf `paymentMonth > assignMonth` se year-1 karte the
                        // Issue: NOV(11) assigned Jan(1) 2025 → 11>1 TRUE → 2024 set hota tha
                        // Lekin NOV 2024 last4Months mein nahi tha toh OLD column mein jaata tha ❌
                        //
                        // Correct logic:
                        // - Month difference > 6: clearly pichle saal ka
                        //   (e.g., DEC assigned JAN → 12-1=11 > 6 → pichle saal ka DEC ✅)
                        // - Month difference <= 6: createdAt se year confirm karo
                        if (paymentMonth > assignMonth) {
                            const monthDiff = paymentMonth - assignMonth;
                            if (monthDiff > 6) {
                                // Clearly pichle saal ka (e.g., DEC in JAN, NOV in Mar)
                                assignYear = assignYear - 1;
                            } else {
                                // Ambiguous - createdAt se confirm karo
                                const folderCreatedYear = folder.createdAt
                                    ? new Date(folder.createdAt).getFullYear()
                                    : assignYear;
                                if (folderCreatedYear < assignYear) {
                                    assignYear = folderCreatedYear;
                                }
                                // Else: same year, kuch change nahi
                            }
                        }

                        paymentYear = assignYear;
                    } else if (folder.createdAt) {
                        // assignedDate nahi hai toh createdAt se year lo
                        const createdDate = new Date(folder.createdAt);
                        const createdMonth = createdDate.getMonth() + 1;
                        let createdYear = createdDate.getFullYear();

                        // Agar paymentMonth createdAt month se > 6 aage hai toh pichle saal
                        if (paymentMonth > createdMonth && (paymentMonth - createdMonth) > 6) {
                            createdYear = createdYear - 1;
                        }

                        paymentYear = createdYear;
                    } else {
                        paymentYear = currentYear;
                    }

                    // Find matching month in last 4 months
                    const matchingMonth = last4Months.find(
                        (m) => m.month === paymentMonth && m.year === paymentYear
                    );

                    if (matchingMonth) {
                        // Add difference amount to specific month column
                        row[matchingMonth.label] += differenceAmount;
                    } else if (isOldDate(paymentMonth, paymentYear)) {
                        // Add to OLD if before last 4 months
                        row.OLD += differenceAmount;
                    }
                }

                // Update total (difference amount total)
                row.TOTAL += differenceAmount;

                // Update assignment details (use latest folder's details)
                if (folder.assignedTo) {
                    row.assignTo = `${folder.assignedTo.firstName || ""} ${folder.assignedTo.lastName || ""}`.trim();
                }
                if (folder.assignedDate) {
                    row.assignDate = moment(folder.assignedDate).format("DD-MM-YYYY");
                }

                // Get task status from populated assignTask
                if (folder.assignTask) {
                    const task = folder.assignTask;
                    let statusText;

                    if (task.isRescheduledTask === true) {
                        const oldDate =
                            task.originalTaskId && task.originalTaskId.date
                                ? moment(task.originalTaskId.date).format("DD-MM-YYYY")
                                : "-";
                        const newDate =
                            folder.assignedDate
                                ? moment(folder.assignedDate).format("DD-MM-YYYY")
                                : (task.date ? moment(task.date).format("DD-MM-YYYY") : "-");
                        statusText = `Rescheduled (Old: ${oldDate} → New: ${newDate})`;
                    } else {
                        statusText = task.status || "Pending";
                        statusText = statusText.charAt(0).toUpperCase() + statusText.slice(1).toLowerCase();
                    }

                    // Add follow-up info if available
                    if (task.followUpDate) {
                        const followUpDate = moment(task.followUpDate).format("DD-MM-YYYY");
                        statusText += ` (Follow-up: ${followUpDate}`;
                        if (task.followUpTime) {
                            statusText += ` ${task.followUpTime}`;
                        }
                        statusText += `)`;
                    }

                    row.taskStatus = statusText;
                } else {
                    row.taskStatus = "Not Assigned";
                }

                if (!folder?.payments?.length) {
                    row.remarks = folder.remarks;
                } else {
                    row.remarks = folder?.payments[folder?.payments?.length - 1]?.note || folder.remarks;
                }
            }

            // =============================
            // WRITE EXCEL ROWS - SIRF DIFFERENCE WALE PARTIES
            // =============================
            // Sirf un parties ko include karo jinka difference > 0 hai
            const sortedParties = Array.from(partyMap.values())
                .filter(party => party.difference > 0) // Extra filter to ensure only parties with difference
                .sort((a, b) => a.partyName.localeCompare(b.partyName));

            for (const data of sortedParties) {
                const newRow = worksheet.addRow({
                    srNo: srNo++,
                    ...data,
                });

                // Format currency columns - SIRF NUMBER FORMATTING, KOI COLOR NAHI
                const monthColumnStart = 6;
                const monthCount = monthColumns.length;
                const totalColIndex = monthColumnStart + monthCount;
                const differenceColIndex = totalColIndex + 1;
                const currencyColumns = [
                    5, // OLD
                    ...Array.from({ length: monthCount }, (_, i) => monthColumnStart + i),
                    totalColIndex,
                    differenceColIndex
                ];

                // SIRF NUMBER FORMAT LAGAO, KOI COLOR NAHI
                currencyColumns.forEach(col => {
                    newRow.getCell(col).numFmt = '#,##0';
                    // Color formatting hata diya - ab sirf number format hai
                });

                // Task status formatting (yeh required hai kyunki user ko status dikhna chahiye)
                const statusCell = newRow.getCell(12); // Task Status column
                // if (data.taskStatus.includes('Rescheduled')) {
                //     statusCell.font = { color: { argb: 'FFFF9800' }, bold: true };
                // } else if (data.taskStatus.includes('Pending')) {
                //     statusCell.font = { color: { argb: 'FF9C27B0' }, bold: true };
                // } else if (data.taskStatus.includes('Completed')) {
                //     statusCell.font = { color: { argb: 'FF4CAF50' }, bold: true };
                // } else if (data.taskStatus.includes('Not Assigned')) {
                //     statusCell.font = { color: { argb: 'FF9E9E9E' }, italic: true };
                // }
            }

            // Add empty row after each company
            worksheet.addRow({});
        }

        // =============================
        // AUTO-FIT COLUMNS
        // =============================
        worksheet.columns.forEach((column) => {
            if (column.header) {
                column.width = Math.max(
                    column.width || 10,
                    column.header.length + 2
                );
            }
        });

        // =============================
        // SEND RESPONSE
        // =============================
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="Payment_Difference_Report_${moment().format(
                "DDMMYYYY"
            )}.xlsx"`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error("Export error:", err);
        res.status(500).json({
            success: false,
            message: "Export failed",
            error: err.message,
        });
    }
};

exports.exportPendingClientApprovalOrdersToExcel = async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        const query = {
            clientApprovalSentAt: { $exists: true, $ne: null },
            designerStatus: { $ne: "Approved" }
        };

        // Date filter on createdAt
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
            .sort({ clientApprovalSentAt: -1 })
            .lean();

        if (orders.length === 0) {
            // Return JSON response when no data is found
            return res.status(200).json({
                success: true,
                message: "No pending approval orders found",
                count: 0,
                empty: true // Add flag to identify empty response
            });
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

// Export Pending Orders to Excel with yellow highlight for orders pending > 3 days
// exports.exportPendingOrdersToExcel = async (req, res) => {
//     try {
//         const { type } = req.body; // 'printer', 'binder', 'booklet-binder'

//         let query = {};
//         let assignField = '';
//         let statusField = '';
//         let remarksField = '';
//         let typeLabel = '';

//         if (type === 'printer') {
//             assignField = 'printerAssignedAt';
//             statusField = 'printerStatus';
//             remarksField = 'printerRemarks';
//             typeLabel = 'Printer';
//             query = {
//                 printer: { $exists: true, $ne: null },
//                 printerStatus: { $in: ['Pending', 'In Progress'] }
//             };
//         } else if (type === 'binder') {
//             assignField = 'binderAssignedAt';
//             statusField = 'binderStatus';
//             remarksField = 'binderRemarks';
//             typeLabel = 'Binder';
//             query = {
//                 binder: { $exists: true, $ne: null },
//                 binderStatus: { $in: ['Pending', 'In Progress'] }
//             };
//         } else if (type === 'booklet-binder') {
//             assignField = 'bookletBinderAssignedAt';
//             statusField = 'bookletBinderStatus';
//             remarksField = 'bookletBinderRemarks';
//             typeLabel = 'Booklet Binder';
//             query = {
//                 bookletBinder: { $exists: true, $ne: null },
//                 bookletBinderStatus: { $in: ['Pending', 'In Progress'] }
//             };
//         } else {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid type. Use 'printer', 'binder', or 'booklet-binder'"
//             });
//         }

//         const orders = await Order.find(query)
//             .populate('printer', 'firstName lastName')
//             .populate('binder', 'firstName lastName')
//             .populate('bookletBinder', 'firstName lastName')
//             .populate('party', 'partyName')
//             .populate('productItem', 'itemName')
//             .populate('companyName', 'companyName')
//             .sort({ [assignField]: 1 })
//             .lean();

//         if (orders.length === 0) {
//             return res.status(200).json({
//                 success: true,
//                 message: `No pending ${typeLabel.toLowerCase()} orders found`,
//                 count: 0,
//                 empty: true
//             });
//         }

//         const workbook = new ExcelJS.Workbook();
//         const worksheet = workbook.addWorksheet(`Pending ${typeLabel} Orders`);

//         // Columns
//         worksheet.columns = [
//             { header: 'Order No', key: 'orderNumber', width: 18 },
//             { header: 'Assign Date', key: 'assignDate', width: 15 },
//             { header: 'Party Name', key: 'partyName', width: 30 },
//             { header: 'Size', key: 'size', width: 15 },
//             { header: 'Item Name', key: 'itemName', width: 25 },
//             { header: 'Remark', key: 'remark', width: 30 },
//             { header: 'Qty', key: 'qty', width: 10 },
//             { header: 'Num', key: 'num', width: 12 },
//             { header: 'Status', key: 'status', width: 15 },
//             { header: type === 'printer' ? 'Printer' : type === 'binder' ? 'Binder' : 'Booklet Binder', key: 'assignee', width: 25 },
//         ];

//         // Header Styling
//         const headerRow = worksheet.getRow(1);
//         headerRow.font = { bold: true };
//         headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
//         headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

//         const now = new Date();
//         const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

//         let srNo = 1;
//         orders.forEach(order => {
//             const assignDate = order[assignField] ? new Date(order[assignField]) : null;
//             const isPendingMoreThan3Days = assignDate && assignDate < threeDaysAgo;

//             const row = worksheet.addRow({
//                 orderNumber: order.orderNumber || '-',
//                 assignDate: assignDate ? moment(assignDate).format('DD-MM-YYYY') : '-',
//                 partyName: order.party?.partyName || '-',
//                 size: order.size || '-',
//                 itemName: order.productItem?.itemName || '-',
//                 remark: order[remarksField] || order.remarks || '-',
//                 qty: order.qty || 0,
//                 num: order.number || '-',
//                 status: order[statusField] || 'Pending',
//                 assignee: type === 'printer' ? order.printer?.firstName + ' ' + order.printer?.lastName : type === 'binder' ? order.binder?.firstName + ' ' + order.binder?.lastName : order.bookletBinder?.firstName + ' ' + order.bookletBinder?.lastName
//             });

//             // Apply yellow highlight for orders pending more than 3 days
//             if (isPendingMoreThan3Days) {
//                 row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
//             }
//         });

//         // File download
//         res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//         const fileName = `Pending_${typeLabel}_Orders_${moment().format('DDMMYYYY_HHmm')}.xlsx`;
//         res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

//         await workbook.xlsx.write(res);
//         res.end();
//     } catch (error) {
//         console.error("Export pending orders error:", error);
//         res.status(500).json({ success: false, message: "Export failed", error: error.message });
//     }
// };

// // Export Completed Orders to Excel
// exports.exportCompletedOrdersToExcel = async (req, res) => {
//     try {
//         const { type, startDate, endDate } = req.body; // 'printer', 'binder', 'booklet-binder'

//         let query = {};
//         let statusField = '';
//         let completedField = '';
//         let assignField = '';
//         let remarksField = '';
//         let typeLabel = '';

//         if (type === 'printer') {
//             statusField = 'printerStatus';
//             completedField = 'printingCompletedAt';
//             assignField = 'printerAssignedAt';
//             remarksField = 'printerRemarks';
//             typeLabel = 'Printer';
//             query = {
//                 printer: { $exists: true, $ne: null },
//                 printerStatus: 'Done'
//             };
//         } else if (type === 'binder') {
//             statusField = 'binderStatus';
//             completedField = 'bindingCompletedAt';
//             assignField = 'binderAssignedAt';
//             remarksField = 'binderRemarks';
//             typeLabel = 'Binder';
//             query = {
//                 binder: { $exists: true, $ne: null },
//                 binderStatus: 'Done'
//             };
//         } else if (type === 'booklet-binder') {
//             statusField = 'bookletBinderStatus';
//             completedField = 'bookletBindingCompletedAt';
//             assignField = 'bookletBinderAssignedAt';
//             remarksField = 'bookletBinderRemarks';
//             typeLabel = 'Booklet Binder';
//             query = {
//                 bookletBinder: { $exists: true, $ne: null },
//                 bookletBinderStatus: 'Done'
//             };
//         } else {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid type. Use 'printer', 'binder', or 'booklet-binder'"
//             });
//         }

//         // Add date range filter if provided
//         if (startDate && endDate) {
//             const start = new Date(startDate);
//             const end = new Date(endDate);
//             end.setHours(23, 59, 59, 999);
//             query[completedField] = { $gte: start, $lte: end };
//         }

//         const orders = await Order.find(query)
//             .populate('printer', 'firstName lastName')
//             .populate('binder', 'firstName lastName')
//             .populate('bookletBinder', 'firstName lastName')
//             .populate('party', 'partyName')
//             .populate('productItem', 'itemName')
//             .populate('companyName', 'companyName')
//             .sort({ [completedField]: -1 })
//             .lean();

//         if (orders.length === 0) {
//             return res.status(200).json({
//                 success: true,
//                 message: `No completed ${typeLabel.toLowerCase()} orders found`,
//                 count: 0,
//                 empty: true
//             });
//         }

//         const workbook = new ExcelJS.Workbook();
//         const worksheet = workbook.addWorksheet(`Completed ${typeLabel} Orders`);

//         // Columns
//         worksheet.columns = [
//             { header: 'Order No', key: 'orderNumber', width: 18 },
//             { header: 'Assign Date', key: 'assignDate', width: 15 },
//             { header: 'Completed Date', key: 'completedDate', width: 15 },
//             { header: 'Party Name', key: 'partyName', width: 30 },
//             { header: 'Size', key: 'size', width: 15 },
//             { header: 'Item Name', key: 'itemName', width: 25 },
//             { header: 'Remark', key: 'remark', width: 30 },
//             { header: 'Qty', key: 'qty', width: 10 },
//             { header: 'Num', key: 'num', width: 12 },
//             { header: 'Status', key: 'status', width: 15 },
//             { header: type === 'printer' ? 'Printer' : type === 'binder' ? 'Binder' : 'Booklet Binder', key: 'assignee', width: 25 },
//         ];

//         // Header Styling
//         const headerRow = worksheet.getRow(1);
//         headerRow.font = { bold: true };
//         headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
//         headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

//         orders.forEach(order => {
//             const completedDate = order[completedField] ? new Date(order[completedField]) : null;
//             const assignDate = order[assignField] ? new Date(order[assignField]) : null;

//             worksheet.addRow({
//                 orderNumber: order.orderNumber || '-',
//                 assignDate: assignDate ? moment(assignDate).format('DD-MM-YYYY') : '-',
//                 completedDate: completedDate ? moment(completedDate).format('DD-MM-YYYY') : '-',
//                 partyName: order.party?.partyName || '-',
//                 size: order.size || '-',
//                 itemName: order.productItem?.itemName || '-',
//                 remark: order[remarksField] || order.remarks || '-',
//                 qty: order.qty || 0,
//                 num: order.number || '-',
//                 status: order[statusField] || 'Done',
//                 assignee: type === 'printer' ? order.printer?.firstName + ' ' + order.printer?.lastName : type === 'binder' ? order.binder?.firstName + ' ' + order.binder?.lastName : order.bookletBinder?.firstName + ' ' + order.bookletBinder?.lastName
//             });
//         });

//         // File download
//         res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//         const fileName = `Completed_${typeLabel}_Orders_${moment().format('DDMMYYYY_HHmm')}.xlsx`;
//         res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

//         await workbook.xlsx.write(res);
//         res.end();
//     } catch (error) {
//         console.error("Export completed orders error:", error);
//         res.status(500).json({ success: false, message: "Export failed", error: error.message });
//     }
// };

exports.exportPendingOrdersToExcel = async (req, res) => {
    try {
        const { type } = req.body; // 'printer', 'binder', 'booklet-binder'

        let query = {};
        let assignField = '';
        let statusField = '';
        let remarksField = '';
        let typeLabel = '';
        let populateField = '';

        if (type === 'printer') {
            assignField = 'printerAssignedAt';
            statusField = 'printerStatus';
            remarksField = 'printerRemarks';
            typeLabel = 'Printer';
            populateField = 'printer';
            query = {
                printer: { $exists: true, $ne: null },
                printerStatus: { $in: ['Pending', 'In Progress'] }
            };
        } else if (type === 'binder') {
            assignField = 'binderAssignedAt';
            statusField = 'binderStatus';
            remarksField = 'binderRemarks';
            typeLabel = 'Binder';
            populateField = 'binder';
            query = {
                binder: { $exists: true, $ne: null },
                binderStatus: { $in: ['Pending', 'In Progress'] }
            };
        } else if (type === 'booklet-binder') {
            assignField = 'bookletBinderAssignedAt';
            statusField = 'bookletBinderStatus';
            remarksField = 'bookletBinderRemarks';
            typeLabel = 'Booklet Binder';
            populateField = 'bookletBinder';
            query = {
                bookletBinder: { $exists: true, $ne: null },
                bookletBinderStatus: { $in: ['Pending', 'In Progress'] }
            };
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid type. Use 'printer', 'binder', or 'booklet-binder'"
            });
        }

        const orders = await Order.find(query)
            .populate('printer', 'firstName lastName')
            .populate('binder', 'firstName lastName')
            .populate('bookletBinder', 'firstName lastName')
            .populate('party', 'partyName')
            .populate('productItem', 'itemName')
            .populate('companyName', 'companyName')
            .sort({ [populateField + '.firstName']: 1, [assignField]: 1 })
            .lean();

        if (orders.length === 0) {
            return res.status(200).json({
                success: true,
                message: `No pending ${typeLabel.toLowerCase()} orders found`,
                count: 0,
                empty: true
            });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Pending ${typeLabel} Orders`);

        // Columns
        worksheet.columns = [
            { header: 'Order No', key: 'orderNumber', width: 18 },
            { header: 'Assign Date', key: 'assignDate', width: 15 },
            { header: 'Party Name', key: 'partyName', width: 30 },
            { header: 'Size', key: 'size', width: 15 },
            { header: 'Item Name', key: 'itemName', width: 25 },
            { header: 'Remark', key: 'remark', width: 30 },
            { header: 'Qty', key: 'qty', width: 10 },
            { header: 'Num', key: 'num', width: 12 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        // Header Styling
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

        // Group orders by assignee
        const groupedOrders = {};
        orders.forEach(order => {
            let assignee = null;
            let assigneeName = '';

            if (type === 'printer') {
                assignee = order.printer;
                assigneeName = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : 'Unassigned';
            } else if (type === 'binder') {
                assignee = order.binder;
                assigneeName = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : 'Unassigned';
            } else {
                assignee = order.bookletBinder;
                assigneeName = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : 'Unassigned';
            }

            if (!groupedOrders[assigneeName]) {
                groupedOrders[assigneeName] = [];
            }
            groupedOrders[assigneeName].push(order);
        });

        // Add data to worksheet with grouping
        const assigneeNames = Object.keys(groupedOrders).sort();

        assigneeNames.forEach((assigneeName, index) => {
            // Add empty row before each new assignee group (except first)
            if (index > 0) {
                worksheet.addRow({});
            }

            // Add assignee header row
            const assigneeHeaderRow = worksheet.addRow({
                orderNumber: `${typeLabel}: ${assigneeName}`,
            });

            // Style assignee header
            assigneeHeaderRow.font = { bold: true, size: 12 };
            assigneeHeaderRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            assigneeHeaderRow.getCell(1).alignment = { horizontal: 'left' };

            // Merge cells for assignee header
            for (let i = 2; i <= 9; i++) {
                assigneeHeaderRow.getCell(i).value = '';
            }

            // Add orders for this assignee
            groupedOrders[assigneeName].forEach(order => {
                const assignDate = order[assignField] ? new Date(order[assignField]) : null;
                const isPendingMoreThan3Days = assignDate && assignDate < threeDaysAgo;

                const row = worksheet.addRow({
                    orderNumber: order.orderNumber || '-',
                    assignDate: assignDate ? moment(assignDate).format('DD-MM-YYYY') : '-',
                    partyName: order.party?.partyName || '-',
                    size: order.size || '-',
                    itemName: order.productItem?.itemName || '-',
                    remark: order[remarksField] || order.remarks || '-',
                    qty: order.qty || 0,
                    num: order.number || '-',
                    status: order[statusField] || 'Pending',
                });

                // Apply yellow highlight for orders pending more than 3 days
                if (isPendingMoreThan3Days) {
                    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                }
            });
        });

        // File download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const fileName = `Pending_${typeLabel}_Orders_${moment().format('DDMMYYYY_HHmm')}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Export pending orders error:", error);
        res.status(500).json({ success: false, message: "Export failed", error: error.message });
    }
};

// Export Completed Orders to Excel
exports.exportCompletedOrdersToExcel = async (req, res) => {
    try {
        const { type, startDate, endDate } = req.body; // 'printer', 'binder', 'booklet-binder'

        let query = {};
        let statusField = '';
        let completedField = '';
        let assignField = '';
        let remarksField = '';
        let typeLabel = '';
        let populateField = '';

        if (type === 'printer') {
            statusField = 'printerStatus';
            completedField = 'printingCompletedAt';
            assignField = 'printerAssignedAt';
            remarksField = 'printerRemarks';
            typeLabel = 'Printer';
            populateField = 'printer';
            query = {
                printer: { $exists: true, $ne: null },
                printerStatus: 'Done'
            };
        } else if (type === 'binder') {
            statusField = 'binderStatus';
            completedField = 'bindingCompletedAt';
            assignField = 'binderAssignedAt';
            remarksField = 'binderRemarks';
            typeLabel = 'Binder';
            populateField = 'binder';
            query = {
                binder: { $exists: true, $ne: null },
                binderStatus: 'Done'
            };
        } else if (type === 'booklet-binder') {
            statusField = 'bookletBinderStatus';
            completedField = 'bookletBindingCompletedAt';
            assignField = 'bookletBinderAssignedAt';
            remarksField = 'bookletBinderRemarks';
            typeLabel = 'Booklet Binder';
            populateField = 'bookletBinder';
            query = {
                bookletBinder: { $exists: true, $ne: null },
                bookletBinderStatus: 'Done'
            };
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid type. Use 'printer', 'binder', or 'booklet-binder'"
            });
        }

        // Add date range filter if provided
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query[completedField] = { $gte: start, $lte: end };
        }

        const orders = await Order.find(query)
            .populate('printer', 'firstName lastName')
            .populate('binder', 'firstName lastName')
            .populate('bookletBinder', 'firstName lastName')
            .populate('party', 'partyName')
            .populate('productItem', 'itemName')
            .populate('companyName', 'companyName')
            .sort({ [populateField + '.firstName']: 1, [completedField]: -1 })
            .lean();

        if (orders.length === 0) {
            return res.status(200).json({
                success: true,
                message: `No completed ${typeLabel.toLowerCase()} orders found`,
                count: 0,
                empty: true
            });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Completed ${typeLabel} Orders`);

        // Columns
        worksheet.columns = [
            { header: 'Order No', key: 'orderNumber', width: 18 },
            { header: 'Assign Date', key: 'assignDate', width: 15 },
            { header: 'Completed Date', key: 'completedDate', width: 15 },
            { header: 'Party Name', key: 'partyName', width: 30 },
            { header: 'Size', key: 'size', width: 15 },
            { header: 'Item Name', key: 'itemName', width: 25 },
            { header: 'Remark', key: 'remark', width: 30 },
            { header: 'Qty', key: 'qty', width: 10 },
            { header: 'Num', key: 'num', width: 12 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        // Header Styling
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

        // Group orders by assignee
        const groupedOrders = {};
        orders.forEach(order => {
            let assignee = null;
            let assigneeName = '';

            if (type === 'printer') {
                assignee = order.printer;
                assigneeName = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : 'Unassigned';
            } else if (type === 'binder') {
                assignee = order.binder;
                assigneeName = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : 'Unassigned';
            } else {
                assignee = order.bookletBinder;
                assigneeName = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : 'Unassigned';
            }

            if (!groupedOrders[assigneeName]) {
                groupedOrders[assigneeName] = [];
            }
            groupedOrders[assigneeName].push(order);
        });

        // Add data to worksheet with grouping
        const assigneeNames = Object.keys(groupedOrders).sort();

        assigneeNames.forEach((assigneeName, index) => {
            // Add empty row before each new assignee group (except first)
            if (index > 0) {
                worksheet.addRow({});
            }

            // Add assignee header row
            const assigneeHeaderRow = worksheet.addRow({
                orderNumber: `${typeLabel}: ${assigneeName}`,
            });

            // Style assignee header
            assigneeHeaderRow.font = { bold: true, size: 12 };
            assigneeHeaderRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            assigneeHeaderRow.getCell(1).alignment = { horizontal: 'left' };

            // Merge cells for assignee header
            for (let i = 2; i <= 10; i++) {
                assigneeHeaderRow.getCell(i).value = '';
            }

            // Add orders for this assignee
            groupedOrders[assigneeName].forEach(order => {
                const completedDate = order[completedField] ? new Date(order[completedField]) : null;
                const assignDate = order[assignField] ? new Date(order[assignField]) : null;

                worksheet.addRow({
                    orderNumber: order.orderNumber || '-',
                    assignDate: assignDate ? moment(assignDate).format('DD-MM-YYYY') : '-',
                    completedDate: completedDate ? moment(completedDate).format('DD-MM-YYYY') : '-',
                    partyName: order.party?.partyName || '-',
                    size: order.size || '-',
                    itemName: order.productItem?.itemName || '-',
                    remark: order[remarksField] || order.remarks || '-',
                    qty: order.qty || 0,
                    num: order.number || '-',
                    status: order[statusField] || 'Done',
                });
            });
        });

        // File download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const fileName = `Completed_${typeLabel}_Orders_${moment().format('DDMMYYYY_HHmm')}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Export completed orders error:", error);
        res.status(500).json({ success: false, message: "Export failed", error: error.message });
    }
};

// Staff Billing Excel Export
exports.exportStaffBillingToExcel = async (req, res) => {
    try {
        const { staffId, staffType, startDate, endDate, isFullBill } = req.body;

        if (!staffId || !staffType) {
            return res.status(400).json({
                success: false,
                message: "Staff ID and Staff Type are required",
            });
        }

        // Get staff details
        const staff = await Staff.findById(staffId).select("firstName lastName");
        if (!staff) {
            return res.status(404).json({
                success: false,
                message: "Staff not found",
            });
        }

        const staffName = `${staff.firstName} ${staff.lastName}`.trim();

        // Build query based on staff type
        let query = {};
        let assignField = '';
        let amountFields = {};

        switch (staffType.toLowerCase()) {
            case 'binder':
                query = { binder: staffId };
                assignField = 'binderAssignedAt';
                amountFields = {
                    amount: '$numberingAmount',
                    rate: '$rateBook',
                    totalAmount: '$totalAmount'
                };
                break;
            case 'printer':
                query = { printer: staffId };
                assignField = 'printerAssignedAt';
                amountFields = {
                    amount: { $multiply: ['$qty', { $toDouble: '$printingrate' }] },
                    rate: '$printingrate',
                    totalAmount: { $multiply: ['$qty', { $toDouble: '$printingrate' }] }
                };
                break;
            case 'booklet-binder':
            case 'bookletbinder':
                query = { bookletBinder: staffId };
                assignField = 'bookletBinderAssignedAt';
                amountFields = {
                    amount: { $multiply: ['$qty', { $toDouble: '$ratePerUnit' }] },
                    rate: '$ratePerUnit',
                    totalAmount: { $multiply: ['$qty', { $toDouble: '$ratePerUnit' }] }
                };
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid staff type. Use: binder, printer, or booklet-binder",
                });
        }

        // Add date range filter if provided
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query[assignField] = { $gte: start, $lte: end };
        }

        // Fetch orders with amount fields
        const orders = await Order.find(query)
            .populate("party", "partyName")
            .populate("productItem", "itemName")
            .populate("companyName", "companyName")
            .select("orderNumber party size qty productItem companyName createdAt binderAssignedAt printerAssignedAt bookletBinderAssignedAt totalAmount numberingAmount rateBook printingrate ratePerUnit")
            .sort({ createdAt: -1 });

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Staff Billing');

        // Staff name header
        worksheet.mergeCells('A1:G1');
        const headerCell = worksheet.getCell('A1');
        headerCell.value = `${staffName} - ${staffType.toUpperCase()} BILL`;
        headerCell.font = { bold: true, size: 14 };
        headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
        headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };

        // Date range header
        worksheet.mergeCells('A2:G2');
        const dateRangeCell = worksheet.getCell('A2');
        if (isFullBill) {
            dateRangeCell.value = "Full Bill - All Time";
        } else if (startDate && endDate) {
            dateRangeCell.value = `Period: ${moment(startDate).format('DD-MM-YYYY')} to ${moment(endDate).format('DD-MM-YYYY')}`;
        } else {
            dateRangeCell.value = "All Orders";
        }
        dateRangeCell.font = { bold: true, size: 11 };
        dateRangeCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Define columns
        worksheet.columns = [
            { header: 'Sr No', key: 'srNo', width: 10 },
            { header: 'Order No', key: 'orderNumber', width: 18 },
            { header: 'Party Name', key: 'partyName', width: 30 },
            { header: 'Size', key: 'size', width: 15 },
            { header: 'Qty', key: 'qty', width: 10 },
            { header: 'Rate', key: 'rate', width: 12 },
            { header: 'Amount', key: 'amount', width: 15 },
        ];

        // Style header row
        const headerRow = worksheet.getRow(3);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // Check if orders exist
        if (orders.length === 0) {
            // Add a message row when no data found
            worksheet.addRow([]);
            worksheet.addRow(["No data found for export"]);
        } else {
            // Calculate amounts for each order
            const ordersWithAmounts = orders.map(order => {
                let amount = 0;
                let rate = 0;
                let total = 0;

                switch (staffType.toLowerCase()) {
                    case 'binder':
                        rate = parseFloat(order.rateBook) || 0;
                        total = parseFloat(order.numberingAmount) || (parseFloat(order.totalAmount) || 0);
                        amount = total;
                        break;
                    case 'printer':
                        rate = parseFloat(order.printingrate) || 0;
                        total = (parseFloat(order.qty) || 0) * rate;
                        amount = total;
                        break;
                    case 'booklet-binder':
                    case 'bookletbinder':
                        rate = parseFloat(order.ratePerUnit) || 0;
                        total = (parseFloat(order.qty) || 0) * rate;
                        amount = total;
                        break;
                }

                return {
                    orderNumber: order.orderNumber,
                    partyName: order.party?.partyName || '-',
                    size: order.size || '-',
                    itemName: order.productItem?.itemName || '-',
                    qty: order.qty || 0,
                    rate: rate,
                    amount: amount,
                    date: order[assignField] ? moment(order[assignField]).format('DD-MM-YYYY') : '-',
                };
            });

            // Calculate total
            const totalAmount = ordersWithAmounts.reduce((sum, order) => sum + order.amount, 0);

            // Add data rows
            let srNo = 1;
            ordersWithAmounts.forEach(order => {
                worksheet.addRow([
                    srNo++,
                    order.orderNumber || '-',
                    order.partyName,
                    order.size,
                    order.qty,
                    order.rate,
                    order.amount
                ]);
            });

            // Add total row
            const totalRowNum = worksheet.lastRow.number + 1;
            worksheet.mergeCells(`A${totalRowNum}:E${totalRowNum}`);
            const totalLabelCell = worksheet.getCell(`A${totalRowNum}`);
            totalLabelCell.value = 'TOTAL';
            totalLabelCell.font = { bold: true };
            totalLabelCell.alignment = { horizontal: 'right' };

            const totalAmountCell = worksheet.getCell(`G${totalRowNum}`);
            totalAmountCell.value = totalAmount;
            totalAmountCell.font = { bold: true };
            totalAmountCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };

            // Format amount column as currency
            worksheet.getColumn('G').numFmt = '₹#,##0.00';
            worksheet.getColumn('F').numFmt = '₹#,##0.00';
        }

        // File download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const typeLabel = staffType.charAt(0).toUpperCase() + staffType.slice(1);
        const fileName = `${staffName}_${typeLabel}_Bill_${moment().format('DDMMYYYY_HHmm')}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Export staff billing error:", error);
        res.status(500).json({ success: false, message: "Export failed", error: error.message });
    }
};