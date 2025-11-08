const Staff = require('../models/staff.model');
const AssignTask = require('../models/assignTask.model');
const QpData = require('../models/qpOrder.model');
const Order = require('../models/order.model')
const CompanyName = require('../models/companyName.model');
const Lead = require("../models/lead.model")
const Role = require('../models/role.model');
const Party = require('../models/Party.model');
const AccountMaster = require('../models/accountMaster.model');
const mongoose = require('mongoose');

// Helper function to build date filter
const buildDateFilter = (startDate, endDate, useCreatedAt = false) => {
  const filter = {};

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // End of day

    if (useCreatedAt) {
      filter.createdAt = { $gte: start, $lte: end };
    } else {
      filter.date = { $gte: start, $lte: end };
    }
  }

  return filter;
};

// Controller to generate company-wise staff report for Sales Staff roles
const getStaffReport = async (req, res) => {
  try {
    // Get companyId from query parameter (optional) and dates from body
    const { companyId } = req.query;
    const { startDate, endDate } = req.body;

    // Validate dates if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use ISO format (YYYY-MM-DD)',
        });
      }

      if (start > end) {
        return res.status(400).json({
          success: false,
          message: 'Start date cannot be after end date',
        });
      }
    }

    // Validate companyId if provided
    let companyFilter = {};
    if (companyId) {
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid company ID',
        });
      }
      companyFilter = { _id: companyId };
    }

    // Fetch all companies (or specific company if companyId is provided)
    const companies = await CompanyName.find(companyFilter).select('companyName _id');

    // Fetch roles where roleName includes "Sales Staff" (case-insensitive)
    const salesRoles = await Role.find({
      roleName: { $regex: 'Sales Staff', $options: 'i' },
      isDelete: false,
    }).select('_id');

    // Extract role IDs
    const salesRoleIds = salesRoles.map(role => role._id);

    // Fetch staff members with Sales Staff roles
    const staffList = await Staff.find({
      role: { $in: salesRoleIds },
    }).select('firstName lastName _id');

    // If no staff found with Sales Staff role
    if (staffList.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No staff found with Sales Staff role',
      });
    }

    // Build date filters
    const taskLeadDateFilter = buildDateFilter(startDate, endDate, false); // Use 'date' field
    const otherModelsDateFilter = buildDateFilter(startDate, endDate, true); // Use 'createdAt'

    // Generate report for each staff
    const reports = await Promise.all(
      staffList.map(async (staff) => {
        const staffReport = {
          staffId: staff._id,
          staffName: `${staff.firstName} ${staff.lastName}`,
          companyBreakdown: [],
        };

        // Generate report for each company
        for (const company of companies) {
          // Count completed tasks for this staff and company (using date field)
          const completedTasks = await AssignTask.countDocuments({
            assignTo: staff._id,
            companyName: company._id,
            status: { $regex: '^completed$', $options: 'i' }, // ✅ case-insensitive match
            ...taskLeadDateFilter,
          });

          // Cancelled Tasks
          const cancelledTasks = await AssignTask.countDocuments({
            assignTo: staff._id,
            companyName: company._id,
            status: { $regex: '^cancelled$', $options: 'i' },
            ...taskLeadDateFilter,
          });

          // Rescheduled Tasks
          const rescheduledTasks = await AssignTask.countDocuments({
            assignTo: staff._id,
            companyName: company._id,
            status: { $regex: '^rescheduled$', $options: 'i' },
            ...taskLeadDateFilter,
          });

          // Completed Leads
          const completedLeads = await Lead.countDocuments({
            assignedTo: staff._id,
            companyName: company._id,
            status: { $regex: '^completed$', $options: 'i' },
            ...taskLeadDateFilter,
          });

          // Cancelled Leads
          const cancelledLeads = await Lead.countDocuments({
            assignedTo: staff._id,
            companyName: company._id,
            status: { $regex: '^cancelled$', $options: 'i' },
            ...taskLeadDateFilter,
          });

          // Rescheduled Leads
          const rescheduledLeads = await Lead.countDocuments({
            assignedTo: staff._id,
            companyName: company._id,
            status: { $regex: '^rescheduled$', $options: 'i' },
            ...taskLeadDateFilter,
          });

          // Count orders from QpOrder for this staff and company (using createdAt)
          const qpOrders = await QpData.countDocuments({
            createdBy: staff._id,
            companyName: company._id,
            ...otherModelsDateFilter,
          });

          // Count orders from Order (Sakshi Creation) for this staff and company (using createdAt)
          const sakshiOrders = await Order.countDocuments({
            createdBy: staff._id,
            companyName: company._id,
            ...otherModelsDateFilter,
          });

          // Combine orders from both models
          const ordersGiven = qpOrders + sakshiOrders;

          // Count unique parties that transitioned from NEW to CUSTOMER (using createdAt for orders)
          const qpOrderParties = await QpData.find({
            createdBy: staff._id,
            companyName: company._id,
            ...otherModelsDateFilter,
          }).distinct('party');

          const sakshiOrderParties = await Order.find({
            createdBy: staff._id,
            companyName: company._id,
            ...otherModelsDateFilter,
          }).distinct('party');

          // Combine unique party IDs from orders
          const orderParties = [...new Set([...qpOrderParties, ...sakshiOrderParties])];

          const newToCustomerParties = await Party.countDocuments({
            _id: { $in: orderParties },
            partyTag: 'CUSTOMER',
          });

          // Count parties created by staff in AccountMaster (using createdAt)
          const createdParties = await AccountMaster.find({
            createdBy: staff._id,
            companyName: company._id,
            ...otherModelsDateFilter,
          }).distinct('party');

          // Count created parties that still have partyTag: "NEW"
          const newPartiesStillNew = await Party.countDocuments({
            _id: { $in: createdParties },
            partyTag: 'NEW',
          });

          // Add company-specific data to the report
          staffReport.companyBreakdown.push({
            companyId: company._id,
            companyName: company.companyName,
            completedTasks,
            cancelledTasks,
            rescheduledTasks,
            completedLeads,
            cancelledLeads,
            rescheduledLeads,
            ordersGiven,
            newToCustomerParties,
            createdParties: createdParties.length, // Total parties created
            newPartiesStillNew, // Parties still tagged NEW
          });
        }

        // If no company filter is applied, add overall totals
        if (!companyId) {
          // Count total orders from both models (using createdAt)
          const totalQpOrders = await QpData.countDocuments({
            createdBy: staff._id,
            ...otherModelsDateFilter,
          });
          const totalSakshiOrders = await Order.countDocuments({
            createdBy: staff._id,
            ...otherModelsDateFilter,
          });
          const totalOrders = totalQpOrders + totalSakshiOrders;

          // Count unique parties that transitioned from NEW to CUSTOMER (overall, using createdAt)
          const totalQpOrderParties = await QpData.find({
            createdBy: staff._id,
            ...otherModelsDateFilter,
          }).distinct('party');

          const totalSakshiOrderParties = await Order.find({
            createdBy: staff._id,
            ...otherModelsDateFilter,
          }).distinct('party');

          const totalOrderParties = [...new Set([...totalQpOrderParties, ...totalSakshiOrderParties])];

          const totalNewToCustomerParties = await Party.countDocuments({
            _id: { $in: totalOrderParties },
            partyTag: 'CUSTOMER',
          });

          // Count total parties created by staff in AccountMaster (using createdAt)
          const totalCreatedParties = await AccountMaster.find({
            createdBy: staff._id,
            ...otherModelsDateFilter,
          }).distinct('party');

          // Count created parties that still have partyTag: "NEW"
          const totalNewPartiesStillNew = await Party.countDocuments({
            _id: { $in: totalCreatedParties },
            partyTag: 'NEW',
          });

          // Count total tasks and leads (using date field)
          const totalCompletedTasks = await AssignTask.countDocuments({
            assignTo: staff._id,
            status: 'Completed',
            ...taskLeadDateFilter,
          });

          const totalCancelledTasks = await AssignTask.countDocuments({
            assignTo: staff._id,
            status: 'Cancelled',
            ...taskLeadDateFilter,
          });

          const totalCompletedLeads = await Lead.countDocuments({
            assignedTo: staff._id,
            status: 'completed',
            ...taskLeadDateFilter,
          });

          const totalCancelledLeads = await Lead.countDocuments({
            assignedTo: staff._id,
            status: 'cancelled',
            ...taskLeadDateFilter,
          });

          staffReport.totals = {
            completedTasks: totalCompletedTasks,
            cancelledTasks: totalCancelledTasks,
            completedLeads: totalCompletedLeads,
            cancelledLeads: totalCancelledLeads,
            ordersGiven: totalOrders,
            newToCustomerParties: totalNewToCustomerParties,
            createdParties: totalCreatedParties.length,
            newPartiesStillNew: totalNewPartiesStillNew,
          };
        }

        return staffReport;
      })
    );

    // Send the reports as JSON response
    res.status(200).json({
      success: true,
      data: reports,
      filters: {
        startDate,
        endDate,
        companyId: companyId || 'All Companies',
      },
    });
  } catch (error) {
    console.error('Error generating staff report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const getSCReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    const company = await CompanyName.findOne({ companyName: 'Sakshi Creation' }).select('_id companyName');
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const salesRoles = await Role.find({ roleName: { $regex: 'Sales Staff', $options: 'i' }, isDelete: false }).select('_id');
    const salesRoleIds = salesRoles.map(r => r._id);

    const staffList = await Staff.find({ role: { $in: salesRoleIds } }).select('firstName lastName _id');

    const taskLeadDateFilter = buildDateFilter(startDate, endDate, false);
    const otherModelsDateFilter = buildDateFilter(startDate, endDate, true);

    const taskReasons = [
      "Delivery",
      "Get Payment",
      "Get Visit",
      "Order",
      "Complain",
      "Sample Approval"
    ];

    const leadReasons = [
      "Cold Call",
      "Proof Approval",
      "Inquiry Call",
      "Confirmation Call"
    ];

    const reports = await Promise.all(staffList.map(async (staff) => {
      const completedTasks = await AssignTask.countDocuments({ assignTo: staff._id, companyName: company._id, status: { $regex: '^completed$', $options: 'i' }, ...taskLeadDateFilter });
      const cancelledTasks = await AssignTask.countDocuments({ assignTo: staff._id, companyName: company._id, status: { $regex: '^cancelled$', $options: 'i' }, ...taskLeadDateFilter });
      const rescheduledTasks = await AssignTask.countDocuments({ assignTo: staff._id, companyName: company._id, status: { $regex: '^rescheduled$', $options: 'i' }, ...taskLeadDateFilter });
      const pendingTasks = await AssignTask.countDocuments({
        assignTo: staff._id,
        companyName: company._id,
        status: { $regex: '^pending$', $options: 'i' },
        ...taskLeadDateFilter
      });

      // Total tasks = sum of all tasks (or just count all)
      const totalTasks = await AssignTask.countDocuments({
        assignTo: staff._id,
        companyName: company._id,
        ...taskLeadDateFilter
      });
      // tasksByReason
      const tasks = await AssignTask.find({ assignTo: staff._id, companyName: company._id, ...taskLeadDateFilter }).select('reasonForVisit status');
      const tasksByReason = {};

      // Initialize keys
      taskReasons.forEach(r => tasksByReason[r.toLowerCase().replace(/\s+/g, '')] = { reason: r, total: 0, completed: 0, cancelled: 0, rescheduled: 0 });
      tasksByReason['other'] = { reason: 'Other', total: 0, completed: 0, cancelled: 0, rescheduled: 0 };

      tasks.forEach(task => {
        const key = taskReasons.find(r => r.toLowerCase() === (task.reasonForVisit || '').toLowerCase())
          ? task.reasonForVisit.toLowerCase().replace(/\s+/g, '')
          : 'other';
        tasksByReason[key].total++;
        if (/^completed$/i.test(task.status)) tasksByReason[key].completed++;
        else if (/^cancelled$/i.test(task.status)) tasksByReason[key].cancelled++;
        else if (/^rescheduled$/i.test(task.status)) tasksByReason[key].rescheduled++;
      });

      // leadsByReason
      const leads = await Lead.find({ assignedTo: staff._id, companyName: company._id, ...taskLeadDateFilter }).select('reason status');
      const leadsByReason = {};

      leadReasons.forEach(r => leadsByReason[r.toLowerCase().replace(/\s+/g, '')] = { reason: r, total: 0, completed: 0, cancelled: 0, rescheduled: 0 });
      leadsByReason['other'] = { reason: 'Other', total: 0, completed: 0, cancelled: 0, rescheduled: 0 };

      leads.forEach(lead => {
        const key = leadReasons.find(r => r.toLowerCase() === (lead.reason || '').toLowerCase())
          ? lead.reason.toLowerCase().replace(/\s+/g, '')
          : 'other';
        leadsByReason[key].total++;
        if (/^completed$/i.test(lead.status)) leadsByReason[key].completed++;
        else if (/^cancelled$/i.test(lead.status)) leadsByReason[key].cancelled++;
        else if (/^rescheduled$/i.test(lead.status)) leadsByReason[key].rescheduled++;
      });

      // visit party task nem customer count
      const visitTasks = await AssignTask.find({
        assignTo: staff._id,
        companyName: company._id,
        ...taskLeadDateFilter,
      }).populate('partyName', 'partyTag'); // populate the party to get partyTag

      let getVisitCount = 0;
      let newPartyCount = 0;
      let customerPartyCount = 0;

      visitTasks.forEach(task => {
        // Sirf ek baar check karein
        if (/^get visit$/i.test(task.reasonForVisit)) {
          getVisitCount++;
          console.log("DEBUG : getSCReport : getVisitCount:", getVisitCount);

          // Count partyTag NEW / CUSTOMER only for "Get Visit" tasks
          if (task.partyName?.partyTag === 'NEW') {
            newPartyCount++;
            console.log("DEBUG : getSCReport : NEW party found:", task.partyName?.partyName);
          } else if (task.partyName?.partyTag === 'CUSTOMER') {
            customerPartyCount++;
            console.log("DEBUG : getSCReport : CUSTOMER party found:", task.partyName?.partyName);
          }
        }
      })


      const completedLeads = await Lead.countDocuments({ assignedTo: staff._id, companyName: company._id, status: { $regex: '^completed$', $options: 'i' }, ...taskLeadDateFilter });
      const cancelledLeads = await Lead.countDocuments({ assignedTo: staff._id, companyName: company._id, status: { $regex: '^cancelled$', $options: 'i' }, ...taskLeadDateFilter });
      const rescheduledLeads = await Lead.countDocuments({ assignedTo: staff._id, companyName: company._id, status: { $regex: '^rescheduled$', $options: 'i' }, ...taskLeadDateFilter });
      const totalLeads = await Lead.countDocuments({
        assignedTo: staff._id,
        companyName: company._id,
        ...taskLeadDateFilter
      });
      const qpOrders = await QpData.countDocuments({ createdBy: staff._id, companyName: company._id, ...otherModelsDateFilter });
      const sakshiOrders = await Order.countDocuments({ createdBy: staff._id, companyName: company._id, ...otherModelsDateFilter });
      const ordersGiven = sakshiOrders;
      const totalSaleData = await Order.aggregate([
        {
          $match: {
            companyName: company._id,
            createdBy: staff._id,
            ...otherModelsDateFilter,
          },
        },
        {
          $project: {
            lastQuotation: { $arrayElemAt: ["$quotation", -1] }, // last entry
          },
        },
        {
          $project: {
            unitPrice: { $toDouble: "$lastQuotation.unitPrice" },
            qty: { $toDouble: "$lastQuotation.qty" },
            gst: { $toDouble: "$lastQuotation.gst" },
          },
        },
        {
          $project: {
            total: { $multiply: ["$unitPrice", "$qty"] },
            gstAmount: {
              $divide: [
                { $multiply: ["$unitPrice", "$qty", "$gst"] },
                100,
              ],
            },
          },
        },
        {
          $project: {
            grandTotal: { $add: ["$total", "$gstAmount"] },
          },
        },
        {
          $group: {
            _id: null,
            totalSale: { $sum: "$grandTotal" },
          },
        },
      ]);


      const totalSale = totalSaleData.length > 0 ? totalSaleData[0].totalSale : 0;

      const qpOrderParties = await QpData.find({ createdBy: staff._id, companyName: company._id, ...otherModelsDateFilter }).distinct('party');
      const sakshiOrderParties = await Order.find({ createdBy: staff._id, companyName: company._id, ...otherModelsDateFilter }).distinct('party');

      const createdParties = await AccountMaster.find({ createdBy: staff._id, companyName: company._id, ...otherModelsDateFilter }).distinct('party');
      console.log("DEBUG : getSCReport : createdParties:", createdParties);

      const newToCustomerParties = await Party.countDocuments({ _id: { $in: [...new Set([...sakshiOrderParties])] }, partyTag: 'CUSTOMER', createdBy: staff._id, });
      const newPartiesStillNew = await Party.countDocuments({ _id: { $in: createdParties }, partyTag: 'NEW', createdBy: staff._id });

      // Count NEW parties for this staff
      const newparty = await Party.countDocuments({
        _id: { $in: createdParties },
        partyTag: 'NEW'
      });
      console.log("DEBUG : getSCReport : newparty:", newparty);


      // Count CUSTOMER parties for this staff
      const customerparty = await Party.countDocuments({
        _id: { $in: createdParties },
        partyTag: 'CUSTOMER'
      });
      console.log("DEBUG : getSCReport : customerparty:", customerparty);

      return {
        staffId: staff._id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        companyId: company._id,
        companyName: company.companyName,
        completedTasks,
        cancelledTasks,
        doneTask: completedTasks + cancelledTasks,
        rescheduledTasks,
        pendingTasks,
        totalTasks,
        completedLeads,
        cancelledLeads,
        doneLeads: completedLeads + cancelledLeads,
        rescheduledLeads,
        ordersGiven,
        newToCustomerParties,
        createdParties: createdParties.length,
        newPartiesStillNew,
        totalSale,
        tasksByReason,
        leadsByReason,
        getVisitCount,
        newPartyCount,
        customerPartyCount,
        totalLeads,
        customerparty,
        newparty,
      };
    }));

    res.status(200).json({ success: true, data: reports, filters: { startDate, endDate, companyName: company.companyName } });

  } catch (error) {
    console.error('Error generating SC report:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const getQPReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    const company = await CompanyName.findOne({ companyName: 'Quality Packaging' }).select('_id companyName');
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const salesRoles = await Role.find({ roleName: { $regex: 'Sales Staff', $options: 'i' }, isDelete: false }).select('_id');
    const salesRoleIds = salesRoles.map(r => r._id);

    const staffList = await Staff.find({ role: { $in: salesRoleIds } }).select('firstName lastName _id');

    const taskLeadDateFilter = buildDateFilter(startDate, endDate, false);
    const otherModelsDateFilter = buildDateFilter(startDate, endDate, true);

    const taskReasons = [
      "Delivery",
      "Get Payment",
      "Get Visit",
      "Order",
      "Complain",
      "Sample Approval"
    ];

    const leadReasons = [
      "Cold Call",
      "Proof Approval",
      "Inquiry Call",
      "Confirmation Call"
    ];

    const reports = await Promise.all(staffList.map(async (staff) => {
      const completedTasks = await AssignTask.countDocuments({ assignTo: staff._id, companyName: company._id, status: { $regex: '^completed$', $options: 'i' }, ...taskLeadDateFilter });
      const cancelledTasks = await AssignTask.countDocuments({ assignTo: staff._id, companyName: company._id, status: { $regex: '^cancelled$', $options: 'i' }, ...taskLeadDateFilter });
      const rescheduledTasks = await AssignTask.countDocuments({ assignTo: staff._id, companyName: company._id, status: { $regex: '^rescheduled$', $options: 'i' }, ...taskLeadDateFilter });
      const pendingTasks = await AssignTask.countDocuments({
        assignTo: staff._id,
        companyName: company._id,
        status: { $regex: '^pending$', $options: 'i' },
        ...taskLeadDateFilter
      });

      // Total tasks = sum of all tasks (or just count all)
      const totalTasks = await AssignTask.countDocuments({
        assignTo: staff._id,
        companyName: company._id,
        ...taskLeadDateFilter
      });
      // tasksByReason
      const tasks = await AssignTask.find({ assignTo: staff._id, companyName: company._id, ...taskLeadDateFilter }).select('reasonForVisit status');
      const tasksByReason = {};
      taskReasons.forEach(r => tasksByReason[r.toLowerCase().replace(/\s+/g, '')] = { reason: r, total: 0, completed: 0, cancelled: 0, rescheduled: 0 });
      tasksByReason['other'] = { reason: 'Other', total: 0, completed: 0, cancelled: 0, rescheduled: 0 };

      tasks.forEach(task => {
        const key = taskReasons.find(r => r.toLowerCase() === (task.reasonForVisit || '').toLowerCase())
          ? task.reasonForVisit.toLowerCase().replace(/\s+/g, '')
          : 'other';
        tasksByReason[key].total++;
        if (/^completed$/i.test(task.status)) tasksByReason[key].completed++;
        else if (/^cancelled$/i.test(task.status)) tasksByReason[key].cancelled++;
        else if (/^rescheduled$/i.test(task.status)) tasksByReason[key].rescheduled++;
      });

      // leadsByReason
      const leads = await Lead.find({ assignedTo: staff._id, companyName: company._id, ...taskLeadDateFilter }).select('reason status');
      const leadsByReason = {};
      leadReasons.forEach(r => leadsByReason[r.toLowerCase().replace(/\s+/g, '')] = { reason: r, total: 0, completed: 0, cancelled: 0, rescheduled: 0 });
      leadsByReason['other'] = { reason: 'Other', total: 0, completed: 0, cancelled: 0, rescheduled: 0 };

      leads.forEach(lead => {
        const key = leadReasons.find(r => r.toLowerCase() === (lead.reason || '').toLowerCase())
          ? lead.reason.toLowerCase().replace(/\s+/g, '')
          : 'other';
        leadsByReason[key].total++;
        if (/^completed$/i.test(lead.status)) leadsByReason[key].completed++;
        else if (/^cancelled$/i.test(lead.status)) leadsByReason[key].cancelled++;
        else if (/^rescheduled$/i.test(lead.status)) leadsByReason[key].rescheduled++;
      });

      // visit party task nem customer count
      const visitTasks = await AssignTask.find({
        assignTo: staff._id,
        companyName: company._id,
        ...taskLeadDateFilter,
      }).populate('partyName', 'partyTag'); // populate the party to get partyTag

      let getVisitCount = 0;
      let newPartyCount = 0;
      let customerPartyCount = 0;

      visitTasks.forEach(task => {
        // Sirf ek baar check karein
        if (/^get visit$/i.test(task.reasonForVisit)) {
          getVisitCount++;
          console.log("DEBUG : getSCReport : getVisitCount:", getVisitCount);

          // Count partyTag NEW / CUSTOMER only for "Get Visit" tasks
          if (task.partyName?.partyTag === 'NEW') {
            newPartyCount++;
            console.log("DEBUG : getSCReport : NEW party found:", task.partyName?.partyName);
          } else if (task.partyName?.partyTag === 'CUSTOMER') {
            customerPartyCount++;
            console.log("DEBUG : getSCReport : CUSTOMER party found:", task.partyName?.partyName);
          }
        }
      })


      const completedLeads = await Lead.countDocuments({ assignedTo: staff._id, companyName: company._id, status: { $regex: '^completed$', $options: 'i' }, ...taskLeadDateFilter });
      const cancelledLeads = await Lead.countDocuments({ assignedTo: staff._id, companyName: company._id, status: { $regex: '^cancelled$', $options: 'i' }, ...taskLeadDateFilter });
      const rescheduledLeads = await Lead.countDocuments({ assignedTo: staff._id, companyName: company._id, status: { $regex: '^rescheduled$', $options: 'i' }, ...taskLeadDateFilter });
      console.log("DEBUG : getQPReport : companyName: company._id:", company._id);

      console.log("DEBUG : getQPReport :  assignedTo: staff._id:", staff._id);

      const totalLeads = await Lead.countDocuments({
        assignedTo: staff._id,
        companyName: company._id,
        ...taskLeadDateFilter
      });
      const qpOrders = await QpData.countDocuments({ createdBy: staff._id, companyName: company._id, ...otherModelsDateFilter });
      const sakshiOrders = await Order.countDocuments({ createdBy: staff._id, companyName: company._id, ...otherModelsDateFilter });
      const ordersGiven = qpOrders;

      const qpTotalSaleData = await QpData.aggregate([
        {
          $match: {
            companyName: company._id,
            createdBy: staff._id,
            amount: { $ne: null, $ne: "" }, // sirf jinke amount filled hai
            ...otherModelsDateFilter,
          },
        },
        {
          $group: {
            _id: null,
            totalSale: { $sum: { $toDouble: "$amount" } }, // string → number convert
          },
        },
      ]);

      const totalSale = qpTotalSaleData.length > 0 ? qpTotalSaleData[0].totalSale : 0;

      const qpOrderParties = await QpData.find({ createdBy: staff._id, companyName: company._id, ...otherModelsDateFilter }).distinct('party');
      const sakshiOrderParties = await Order.find({ createdBy: staff._id, companyName: company._id, ...otherModelsDateFilter }).distinct('party');

      const createdParties = await AccountMaster.find({ createdBy: staff._id, companyName: company._id, ...otherModelsDateFilter }).distinct('party');
      console.log("DEBUG : getQPReport : company._id:", company._id);

      console.log("DEBUG : getQPReport : staff._id:", staff._id);

      console.log("DEBUG : getQPReport : createdParties:", createdParties);

      const newToCustomerParties = await Party.countDocuments({ _id: { $in: [...new Set([...qpOrderParties])] }, partyTag: 'CUSTOMER' });
      const newPartiesStillNew = await Party.countDocuments({ _id: { $in: createdParties }, partyTag: 'NEW' });

      // Count NEW parties for this staff
      const newparty = await Party.countDocuments({
        _id: { $in: createdParties },
        partyTag: 'NEW'
      });
      console.log("DEBUG : getQPReport : newparty:", newparty);


      // Count CUSTOMER parties for this staff
      const customerparty = await Party.countDocuments({
        _id: { $in: createdParties },
        partyTag: 'CUSTOMER'
      });
      console.log("DEBUG : getQPReport : customerparty:", customerparty);

      return {
        staffId: staff._id,
        staffName: `${staff.firstName} ${staff.lastName}`,
        companyId: company._id,
        companyName: company.companyName,
        completedTasks,
        cancelledTasks,
        doneTask: completedTasks + cancelledTasks,
        rescheduledTasks,
        pendingTasks,
        totalTasks,
        completedLeads,
        cancelledLeads,
        doneLeads: completedLeads + cancelledLeads,
        rescheduledLeads,
        ordersGiven,
        newToCustomerParties,
        createdParties: createdParties.length,
        newPartiesStillNew,
        tasksByReason,
        leadsByReason,
        getVisitCount,
        newPartyCount,
        customerPartyCount,
        totalLeads,
        customerparty,
        newparty,
      };
    }));

    res.status(200).json({ success: true, data: reports, filters: { startDate, endDate, companyName: company.companyName } });

  } catch (error) {
    console.error('Error generating QP report:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const getqpInactiveParties = async (req, res) => {
  try {
    const days = parseInt(req.body.days) || 30;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);

    // 1️⃣ Find company "Quality Packaging"
    const company = await CompanyName.findOne({
      companyName: { $regex: "quality packaging", $options: "i" },
    });

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // 2️⃣ Aggregate inactive parties and compute lastOrderId + lastOrderDate
    const inactiveParties = await Party.aggregate([
      { $match: { companyName: company._id } },

      // Lookup qpOrders
      {
        $lookup: {
          from: "qporders",
          localField: "_id",
          foreignField: "party",
          as: "orders",
        },
      },

      // Compute last order ID and date
      {
        $addFields: {
          lastOrderDate: { $max: "$orders.createdAt" },
          lastOrderId: {
            $let: {
              vars: {
                sortedOrders: {
                  $sortArray: {
                    input: "$orders",
                    sortBy: { createdAt: -1 },
                  },
                },
              },
              in: { $arrayElemAt: ["$$sortedOrders._id", 0] },
            },
          },
        },
      },

      // Only include inactive parties
      {
        $match: {
          $or: [
            { lastOrderDate: { $lt: thirtyDaysAgo } },
            { lastOrderDate: { $eq: null } },
          ],
        },
      },

      // Lookup AccountMaster to get createdBy staff
      {
        $lookup: {
          from: "accountmasters",
          localField: "_id",
          foreignField: "party",
          as: "accountDetails",
        },
      },
      { $unwind: { path: "$accountDetails", preserveNullAndEmptyArrays: true } },

      // Lookup creator staff from AccountMaster
      {
        $lookup: {
          from: "staffs",
          localField: "accountDetails.createdBy",
          foreignField: "_id",
          as: "createdByDetails",
        },
      },
      { $unwind: { path: "$createdByDetails", preserveNullAndEmptyArrays: true } },

      // Lookup Market fields inside address
      {
        $lookup: {
          from: "markets",
          localField: "address.marketName",
          foreignField: "_id",
          as: "marketDetails",
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "address.landMark",
          foreignField: "_id",
          as: "landMarkDetails",
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "address.area",
          foreignField: "_id",
          as: "areaDetails",
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "address.pincode",
          foreignField: "_id",
          as: "pincodeDetails",
        },
      },

      // Final Projection
      {
        $project: {
          _id: 1,
          partyName: 1,
          ownerName: 1,
          ownerMobileNo: 1,
          lastOrderDate: 1,
          lastOrderId: 1, // ✅ include only ID
          createdBy: {
            _id: "$createdByDetails._id",
            firstName: "$createdByDetails.firstName",
            lastName: "$createdByDetails.lastName",
            email: "$createdByDetails.email",
            mobileNo: "$createdByDetails.mobileNo",
          },
          address: {
            unitNo: "$address.unitNo",
            marketName: { $arrayElemAt: ["$marketDetails.marketName", 0] },
            landMark: { $arrayElemAt: ["$landMarkDetails.landmark", 0] },
            area: { $arrayElemAt: ["$areaDetails.area", 0] },
            pincode: { $arrayElemAt: ["$pincodeDetails.pincode", 0] },
          },
        },
      },
    ]);

    // 3️⃣ Populate the lastOrderId field to include last order details
    const populatedParties = await QpData.populate(inactiveParties, {
      path: "lastOrderId",
      select: "_id orderNo noOfPieces amount createdAt status orderdata",
      populate: {
        path: "orderdata", // packagingOption reference
        model: "packagingOption",
        select: "_id ply length width height deckal paper1GSM paper2GSM paper3GSM noOfPieces ratePerPiece",
      },
    });

    // 4️⃣ Send response
    return res.status(200).json({
      success: true,
      message: "QP Order Inactive Parties with Last Order Info",
      data: populatedParties,
    });
  } catch (error) {
    console.error("Error fetching inactive parties:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getscOrderInactiveParties = async (req, res) => {
  try {
    const days = parseInt(req.body.days) || 30;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);

    const company = await CompanyName.findOne({
      companyName: { $regex: "sakshi creation", $options: "i" },
    });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const inactiveParties = await Party.aggregate([
      { $match: { companyName: company._id } },

      // Lookup Orders (Order model)
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "party",
          as: "orders",
        },
      },
      {
        $addFields: {
          lastOrderDate: { $max: "$orders.createdAt" },
          lastOrderId: {
            $let: {
              vars: {
                sortedOrders: {
                  $sortArray: {
                    input: "$orders",
                    sortBy: { createdAt: -1 },
                  },
                },
              },
              in: { $arrayElemAt: ["$$sortedOrders._id", 0] },
            },
          },
        },
      },
      {
        $match: {
          $or: [
            { lastOrderDate: { $lt: thirtyDaysAgo } },
            { lastOrderDate: { $eq: null } },
          ],
        },
      },

      // Lookup AccountMaster + Staff
      {
        $lookup: {
          from: "accountmasters",
          localField: "_id",
          foreignField: "party",
          as: "accountDetails",
        },
      },
      { $unwind: { path: "$accountDetails", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "staffs",
          localField: "accountDetails.createdBy",
          foreignField: "_id",
          as: "createdByDetails",
        },
      },
      { $unwind: { path: "$createdByDetails", preserveNullAndEmptyArrays: true } },

      // Lookup Markets for address fields
      {
        $lookup: {
          from: "markets",
          localField: "address.marketName",
          foreignField: "_id",
          as: "marketDetails",
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "address.landMark",
          foreignField: "_id",
          as: "landMarkDetails",
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "address.area",
          foreignField: "_id",
          as: "areaDetails",
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "address.pincode",
          foreignField: "_id",
          as: "pincodeDetails",
        },
      },

      // Final projection
      {
        $project: {
          _id: 1,
          partyName: 1,
          ownerName: 1,
          ownerMobileNo: 1,
          lastOrderDate: 1,
          lastOrderId: 1, // ✅ only store ID
          createdBy: {
            _id: "$createdByDetails._id",
            firstName: "$createdByDetails.firstName",
            lastName: "$createdByDetails.lastName",
            email: "$createdByDetails.email",
            mobileNo: "$createdByDetails.mobileNo"
          },
          address: {
            unitNo: "$address.unitNo",
            marketName: { $arrayElemAt: ["$marketDetails.marketName", 0] },
            landMark: { $arrayElemAt: ["$landMarkDetails.landmark", 0] },
            area: { $arrayElemAt: ["$areaDetails.area", 0] },
            pincode: { $arrayElemAt: ["$pincodeDetails.pincode", 0] },
          },
        },
      },
    ]);

    // 3️⃣ Populate lastOrderId (convert ObjectId → Order doc)
    const populatedParties = await Order.populate(inactiveParties, {
      path: "lastOrderId",
      select: "_id orderNumber qty createdAt productItem quotation",
      populate: {
        path: "productItem", // packagingOption reference
        model: "productItem",
        select: "_id itemName",
      },
    });

    // 4️⃣ Send response
    return res.status(200).json({
      success: true,
      message: "Order Inactive Parties with Last Order Info",
      data: populatedParties,
    });
  } catch (error) {
    console.error("Error fetching Order inactive parties:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};


module.exports = { getStaffReport, getSCReport, getQPReport, getqpInactiveParties, getscOrderInactiveParties };