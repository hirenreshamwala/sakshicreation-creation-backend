const ExcelJS = require('exceljs');
const { getAllAccountMasters } = require('./accountMaster.controller'); // Assuming the original function is in this file
const Order = require("../models/order.model");
const CompanyName = require("../models/companyName.model");
const Lead = require("../models/lead.model");
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
            { header: 'Company', key: 'company', width: 20 },
            { header: 'Created Date', key: 'createdDate', width: 20 },
            { header: 'Party', key: 'party', width: 30 },
            { header: 'Contact Person', key: 'contactPerson', width: 20 },
            { header: 'Party Tag', key: 'partyTag', width: 15 },
            { header: 'Mobile No.', key: 'mobileNo', width: 15 },
            { header: 'Reason to Visit', key: 'reasonToVisit', width: 20 },
            { header: 'Unit No', key: 'unitNo', width: 15 },
            { header: 'Market', key: 'market', width: 20 },
            { header: 'Area', key: 'area', width: 15 },
            { header: 'Remarks', key: 'remarks', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Created By', key: 'createdBy', width: 20 },
            { header: 'Assign', key: 'assign', width: 20 }
        ];

        // Format and add data rows
        responseData.data.forEach(account => {
            worksheet.addRow({
                company: account.companyName?.name || '',
                createdDate: new Date(account.createdAt).toLocaleDateString(),
                party: account.party?.partyName || '',
                contactPerson: account.party?.contactPerson || '',
                partyTag: account.party?.partyTag || '',
                mobileNo: account.party?.ownerMobileNo || '',
                reasonToVisit: account.reasonToVisit || '',
                unitNo: account.party?.address?.unitNo || '',
                market: account.party?.address?.marketName?.marketName || '',
                area: account.party?.address?.area?.area || '',
                remarks: account.assignment?.remarks || '',
                status: account.party?.statusApproval || '',
                createdBy: `${account.createdBy?.firstName || ''} ${account.createdBy?.lastName || ''}`.trim(),
                assign: `${account.assignment?.assignedTo?.firstName || ''} ${account.assignment?.assignedTo?.lastName || ''}`.trim()
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