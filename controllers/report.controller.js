const Staff = require("../models/staff.model");
const AssignTask = require("../models/assignTask.model");
const QpData = require("../models/qpOrder.model");
const Order = require("../models/order.model");
const CompanyName = require("../models/companyName.model");
const Lead = require("../models/lead.model");
const Role = require("../models/role.model");
const Party = require("../models/Party.model");
const AccountMaster = require("../models/accountMaster.model");
const mongoose = require("mongoose");

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
          message: "Invalid date format. Use ISO format (YYYY-MM-DD)",
        });
      }

      if (start > end) {
        return res.status(400).json({
          success: false,
          message: "Start date cannot be after end date",
        });
      }
    }

    // Validate companyId if provided
    let companyFilter = {};
    if (companyId) {
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid company ID",
        });
      }
      companyFilter = { _id: companyId };
    }

    // Fetch all companies (or specific company if companyId is provided)
    const companies = await CompanyName.find(companyFilter).select(
      "companyName _id"
    );

    // Fetch roles where roleName includes "Sales Staff" (case-insensitive)
    const salesRoles = await Role.find({
      roleName: { $regex: "Sales Staff", $options: "i" },
      isDelete: false,
    }).select("_id");

    // Extract role IDs
    const salesRoleIds = salesRoles.map((role) => role._id);

    // Fetch staff members with Sales Staff roles
    const staffList = await Staff.find({
      role: { $in: salesRoleIds },
    }).select("firstName lastName _id");

    // If no staff found with Sales Staff role
    if (staffList.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No staff found with Sales Staff role",
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
            status: { $regex: "^completed$", $options: "i" }, // ✅ case-insensitive match
            ...taskLeadDateFilter,
          });

          // Cancelled Tasks
          const cancelledTasks = await AssignTask.countDocuments({
            assignTo: staff._id,
            companyName: company._id,
            status: { $regex: "^cancelled$", $options: "i" },
            ...taskLeadDateFilter,
          });

          // Rescheduled Tasks
          const rescheduledTasks = await AssignTask.countDocuments({
            assignTo: staff._id,
            companyName: company._id,
            status: { $regex: "^rescheduled$", $options: "i" },
            ...taskLeadDateFilter,
          });

          // Completed Leads
          const completedLeads = await Lead.countDocuments({
            assignedTo: staff._id,
            companyName: company._id,
            status: { $regex: "^completed$", $options: "i" },
            ...taskLeadDateFilter,
          });

          // Cancelled Leads
          const cancelledLeads = await Lead.countDocuments({
            assignedTo: staff._id,
            companyName: company._id,
            status: { $regex: "^cancelled$", $options: "i" },
            ...taskLeadDateFilter,
          });

          // Rescheduled Leads
          const rescheduledLeads = await Lead.countDocuments({
            assignedTo: staff._id,
            companyName: company._id,
            status: { $regex: "^rescheduled$", $options: "i" },
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
          }).distinct("party");

          const sakshiOrderParties = await Order.find({
            createdBy: staff._id,
            companyName: company._id,
            ...otherModelsDateFilter,
          }).distinct("party");

          // Combine unique party IDs from orders
          const orderParties = [
            ...new Set([...qpOrderParties, ...sakshiOrderParties]),
          ];

          const newToCustomerParties = await Party.countDocuments({
            _id: { $in: orderParties },
            partyTag: "CUSTOMER",
          });

          // Count parties created by staff in AccountMaster (using createdAt)
          const createdParties = await AccountMaster.find({
            createdBy: staff._id,
            companyName: company._id,
            ...otherModelsDateFilter,
          }).distinct("party");

          // Count created parties that still have partyTag: "NEW"
          const newPartiesStillNew = await Party.countDocuments({
            _id: { $in: createdParties },
            partyTag: "NEW",
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
          }).distinct("party");

          const totalSakshiOrderParties = await Order.find({
            createdBy: staff._id,
            ...otherModelsDateFilter,
          }).distinct("party");

          const totalOrderParties = [
            ...new Set([...totalQpOrderParties, ...totalSakshiOrderParties]),
          ];

          const totalNewToCustomerParties = await Party.countDocuments({
            _id: { $in: totalOrderParties },
            partyTag: "CUSTOMER",
          });

          // Count total parties created by staff in AccountMaster (using createdAt)
          const totalCreatedParties = await AccountMaster.find({
            createdBy: staff._id,
            ...otherModelsDateFilter,
          }).distinct("party");

          // Count created parties that still have partyTag: "NEW"
          const totalNewPartiesStillNew = await Party.countDocuments({
            _id: { $in: totalCreatedParties },
            partyTag: "NEW",
          });

          // Count total tasks and leads (using date field)
          const totalCompletedTasks = await AssignTask.countDocuments({
            assignTo: staff._id,
            status: "Completed",
            ...taskLeadDateFilter,
          });

          const totalCancelledTasks = await AssignTask.countDocuments({
            assignTo: staff._id,
            status: "Cancelled",
            ...taskLeadDateFilter,
          });

          const totalCompletedLeads = await Lead.countDocuments({
            assignedTo: staff._id,
            status: "completed",
            ...taskLeadDateFilter,
          });

          const totalCancelledLeads = await Lead.countDocuments({
            assignedTo: staff._id,
            status: "cancelled",
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
        companyId: companyId || "All Companies",
      },
    });
  } catch (error) {
    console.error("Error generating staff report:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const getSCReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    const company = await CompanyName.findOne({
      companyName: "Sakshi Creation",
    }).select("_id companyName");
    if (!company)
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });

    const salesRoles = await Role.find({
      roleName: { $regex: "Sales Staff", $options: "i" },
      isDelete: false,
    }).select("_id");
    const salesRoleIds = salesRoles.map((r) => r._id);

    const staffList = await Staff.find({ role: { $in: salesRoleIds } }).select(
      "firstName lastName _id"
    );

    const taskLeadDateFilter = buildDateFilter(startDate, endDate, false);
    const otherModelsDateFilter = buildDateFilter(startDate, endDate, true);

    const taskReasons = [
      "Delivery",
      "Get Payment",
      "Get Visit",
      "Order",
      "Complain",
      "Sample Approval",
    ];

    const leadReasons = [
      "Cold Call",
      "Proof Approval",
      "Inquiry Call",
      "Confirmation Call",
    ];

    const reports = await Promise.all(
      staffList.map(async (staff) => {
        const completedTasks = await AssignTask.countDocuments({
          assignTo: staff._id,
          companyName: company._id,
          status: { $regex: "^completed$", $options: "i" },
          ...taskLeadDateFilter,
        });
        const cancelledTasks = await AssignTask.countDocuments({
          assignTo: staff._id,
          companyName: company._id,
          status: { $regex: "^cancelled$", $options: "i" },
          ...taskLeadDateFilter,
        });
        const rescheduledTasks = await AssignTask.countDocuments({
          assignTo: staff._id,
          companyName: company._id,
          status: { $regex: "^rescheduled$", $options: "i" },
          ...taskLeadDateFilter,
        });
        const pendingTasks = await AssignTask.countDocuments({
          assignTo: staff._id,
          companyName: company._id,
          status: { $regex: "^pending$", $options: "i" },
          ...taskLeadDateFilter,
        });

        // Total tasks = sum of all tasks (or just count all)
        const totalTasks = await AssignTask.countDocuments({
          assignTo: staff._id,
          companyName: company._id,
          ...taskLeadDateFilter,
        });
        // tasksByReason
        const tasks = await AssignTask.find({
          assignTo: staff._id,
          companyName: company._id,
          ...taskLeadDateFilter,
        }).select("reasonForVisit status");
        const tasksByReason = {};

        // Initialize keys
        taskReasons.forEach(
          (r) =>
            (tasksByReason[r.toLowerCase().replace(/\s+/g, "")] = {
              reason: r,
              total: 0,
              completed: 0,
              cancelled: 0,
              rescheduled: 0,
            })
        );
        tasksByReason["other"] = {
          reason: "Other",
          total: 0,
          completed: 0,
          cancelled: 0,
          rescheduled: 0,
        };

        tasks.forEach((task) => {
          const key = taskReasons.find(
            (r) => r.toLowerCase() === (task.reasonForVisit || "").toLowerCase()
          )
            ? task.reasonForVisit.toLowerCase().replace(/\s+/g, "")
            : "other";
          tasksByReason[key].total++;
          if (/^completed$/i.test(task.status)) tasksByReason[key].completed++;
          else if (/^cancelled$/i.test(task.status))
            tasksByReason[key].cancelled++;
          else if (/^rescheduled$/i.test(task.status))
            tasksByReason[key].rescheduled++;
        });

        // leadsByReason
        const leads = await Lead.find({
          assignedTo: staff._id,
          companyName: company._id,
          ...taskLeadDateFilter,
        }).select("reason status");
        const leadsByReason = {};

        leadReasons.forEach(
          (r) =>
            (leadsByReason[r.toLowerCase().replace(/\s+/g, "")] = {
              reason: r,
              total: 0,
              completed: 0,
              cancelled: 0,
              rescheduled: 0,
            })
        );
        leadsByReason["other"] = {
          reason: "Other",
          total: 0,
          completed: 0,
          cancelled: 0,
          rescheduled: 0,
        };

        leads.forEach((lead) => {
          const key = leadReasons.find(
            (r) => r.toLowerCase() === (lead.reason || "").toLowerCase()
          )
            ? lead.reason.toLowerCase().replace(/\s+/g, "")
            : "other";
          leadsByReason[key].total++;
          if (/^completed$/i.test(lead.status)) leadsByReason[key].completed++;
          else if (/^cancelled$/i.test(lead.status))
            leadsByReason[key].cancelled++;
          else if (/^rescheduled$/i.test(lead.status))
            leadsByReason[key].rescheduled++;
        });

        // visit party task nem customer count
        const visitTasks = await AssignTask.find({
          assignTo: staff._id,
          companyName: company._id,
          ...taskLeadDateFilter,
        }).populate("partyName", "partyTag"); // populate the party to get partyTag

        let getVisitCount = 0;
        let newPartyCount = 0;
        let customerPartyCount = 0;

        visitTasks.forEach((task) => {
          // Sirf ek baar check karein
          if (/^get visit$/i.test(task.reasonForVisit)) {
            getVisitCount++;

            // Count partyTag NEW / CUSTOMER only for "Get Visit" tasks
            if (task.partyName?.partyTag === "NEW") {
              newPartyCount++;
            } else if (task.partyName?.partyTag === "CUSTOMER") {
              customerPartyCount++;
            }
          }
        });

        const completedLeads = await Lead.countDocuments({
          assignedTo: staff._id,
          companyName: company._id,
          status: { $regex: "^completed$", $options: "i" },
          ...taskLeadDateFilter,
        });
        const cancelledLeads = await Lead.countDocuments({
          assignedTo: staff._id,
          companyName: company._id,
          status: { $regex: "^cancelled$", $options: "i" },
          ...taskLeadDateFilter,
        });
        const rescheduledLeads = await Lead.countDocuments({
          assignedTo: staff._id,
          companyName: company._id,
          status: { $regex: "^rescheduled$", $options: "i" },
          ...taskLeadDateFilter,
        });
        const totalLeads = await Lead.countDocuments({
          assignedTo: staff._id,
          companyName: company._id,
          ...taskLeadDateFilter,
        });
        const qpOrders = await QpData.countDocuments({
          createdBy: staff._id,
          companyName: company._id,
          ...otherModelsDateFilter,
        });
        const sakshiOrders = await Order.countDocuments({
          createdBy: staff._id,
          companyName: company._id,
          ...otherModelsDateFilter,
        });
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
                $divide: [{ $multiply: ["$unitPrice", "$qty", "$gst"] }, 100],
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

        const totalSale =
          totalSaleData.length > 0 ? totalSaleData[0].totalSale : 0;

        const qpOrderParties = await QpData.find({
          createdBy: staff._id,
          companyName: company._id,
          ...otherModelsDateFilter,
        }).distinct("party");
        const sakshiOrderParties = await Order.find({
          createdBy: staff._id,
          companyName: company._id,
          ...otherModelsDateFilter,
        }).distinct("party");

        const createdParties = await AccountMaster.find({
          createdBy: staff._id,
          companyName: company._id,
          ...otherModelsDateFilter,
        }).distinct("party");

        const newToCustomerParties = await Party.countDocuments({
          _id: { $in: [...new Set([...sakshiOrderParties])] },
          partyTag: "CUSTOMER",
          createdBy: staff._id,
        });
        const newPartiesStillNew = await Party.countDocuments({
          _id: { $in: createdParties },
          partyTag: "NEW",
          createdBy: staff._id,
        });

        // Count NEW parties for this staff
        const newparty = await Party.countDocuments({
          _id: { $in: createdParties },
          partyTag: "NEW",
        });

        // Count CUSTOMER parties for this staff
        const customerparty = await Party.countDocuments({
          _id: { $in: createdParties },
          partyTag: "CUSTOMER",
        });

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
      })
    );

    res.status(200).json({
      success: true,
      data: reports,
      filters: { startDate, endDate, companyName: company.companyName },
    });
  } catch (error) {
    console.error("Error generating SC report:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

const getQPReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    const company = await CompanyName.findOne({
      companyName: "Quality Packaging",
    }).select("_id companyName");
    if (!company)
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });

    const salesRoles = await Role.find({
      roleName: { $regex: "Sales Staff", $options: "i" },
      isDelete: false,
    }).select("_id");
    const salesRoleIds = salesRoles.map((r) => r._id);

    const staffList = await Staff.find({ role: { $in: salesRoleIds } }).select(
      "firstName lastName _id"
    );

    const taskLeadDateFilter = buildDateFilter(startDate, endDate, false);
    const otherModelsDateFilter = buildDateFilter(startDate, endDate, true);

    const taskReasons = [
      "Delivery",
      "Get Payment",
      "Get Visit",
      "Order",
      "Complain",
      "Sample Approval",
    ];

    const leadReasons = [
      "Cold Call",
      "Proof Approval",
      "Inquiry Call",
      "Confirmation Call",
    ];

    const reports = await Promise.all(
      staffList.map(async (staff) => {
        const completedTasks = await AssignTask.countDocuments({
          assignTo: staff._id,
          companyName: company._id,
          status: { $regex: "^completed$", $options: "i" },
          ...taskLeadDateFilter,
        });
        const cancelledTasks = await AssignTask.countDocuments({
          assignTo: staff._id,
          companyName: company._id,
          status: { $regex: "^cancelled$", $options: "i" },
          ...taskLeadDateFilter,
        });
        const rescheduledTasks = await AssignTask.countDocuments({
          assignTo: staff._id,
          companyName: company._id,
          status: { $regex: "^rescheduled$", $options: "i" },
          ...taskLeadDateFilter,
        });
        const pendingTasks = await AssignTask.countDocuments({
          assignTo: staff._id,
          companyName: company._id,
          status: { $regex: "^pending$", $options: "i" },
          ...taskLeadDateFilter,
        });

        // Total tasks = sum of all tasks (or just count all)
        const totalTasks = await AssignTask.countDocuments({
          assignTo: staff._id,
          companyName: company._id,
          ...taskLeadDateFilter,
        });
        // tasksByReason
        const tasks = await AssignTask.find({
          assignTo: staff._id,
          companyName: company._id,
          ...taskLeadDateFilter,
        }).select("reasonForVisit status");
        const tasksByReason = {};
        taskReasons.forEach(
          (r) =>
            (tasksByReason[r.toLowerCase().replace(/\s+/g, "")] = {
              reason: r,
              total: 0,
              completed: 0,
              cancelled: 0,
              rescheduled: 0,
            })
        );
        tasksByReason["other"] = {
          reason: "Other",
          total: 0,
          completed: 0,
          cancelled: 0,
          rescheduled: 0,
        };

        tasks.forEach((task) => {
          const key = taskReasons.find(
            (r) => r.toLowerCase() === (task.reasonForVisit || "").toLowerCase()
          )
            ? task.reasonForVisit.toLowerCase().replace(/\s+/g, "")
            : "other";
          tasksByReason[key].total++;
          if (/^completed$/i.test(task.status)) tasksByReason[key].completed++;
          else if (/^cancelled$/i.test(task.status))
            tasksByReason[key].cancelled++;
          else if (/^rescheduled$/i.test(task.status))
            tasksByReason[key].rescheduled++;
        });

        // leadsByReason
        const leads = await Lead.find({
          assignedTo: staff._id,
          companyName: company._id,
          ...taskLeadDateFilter,
        }).select("reason status");
        const leadsByReason = {};
        leadReasons.forEach(
          (r) =>
            (leadsByReason[r.toLowerCase().replace(/\s+/g, "")] = {
              reason: r,
              total: 0,
              completed: 0,
              cancelled: 0,
              rescheduled: 0,
            })
        );
        leadsByReason["other"] = {
          reason: "Other",
          total: 0,
          completed: 0,
          cancelled: 0,
          rescheduled: 0,
        };

        leads.forEach((lead) => {
          const key = leadReasons.find(
            (r) => r.toLowerCase() === (lead.reason || "").toLowerCase()
          )
            ? lead.reason.toLowerCase().replace(/\s+/g, "")
            : "other";
          leadsByReason[key].total++;
          if (/^completed$/i.test(lead.status)) leadsByReason[key].completed++;
          else if (/^cancelled$/i.test(lead.status))
            leadsByReason[key].cancelled++;
          else if (/^rescheduled$/i.test(lead.status))
            leadsByReason[key].rescheduled++;
        });

        // visit party task nem customer count
        const visitTasks = await AssignTask.find({
          assignTo: staff._id,
          companyName: company._id,
          ...taskLeadDateFilter,
        }).populate("partyName", "partyTag"); // populate the party to get partyTag

        let getVisitCount = 0;
        let newPartyCount = 0;
        let customerPartyCount = 0;

        visitTasks.forEach((task) => {
          // Sirf ek baar check karein
          if (/^get visit$/i.test(task.reasonForVisit)) {
            getVisitCount++;

            // Count partyTag NEW / CUSTOMER only for "Get Visit" tasks
            if (task.partyName?.partyTag === "NEW") {
              newPartyCount++;
            } else if (task.partyName?.partyTag === "CUSTOMER") {
              customerPartyCount++;
            }
          }
        });

        const completedLeads = await Lead.countDocuments({
          assignedTo: staff._id,
          companyName: company._id,
          status: { $regex: "^completed$", $options: "i" },
          ...taskLeadDateFilter,
        });
        const cancelledLeads = await Lead.countDocuments({
          assignedTo: staff._id,
          companyName: company._id,
          status: { $regex: "^cancelled$", $options: "i" },
          ...taskLeadDateFilter,
        });
        const rescheduledLeads = await Lead.countDocuments({
          assignedTo: staff._id,
          companyName: company._id,
          status: { $regex: "^rescheduled$", $options: "i" },
          ...taskLeadDateFilter,
        });

        const totalLeads = await Lead.countDocuments({
          assignedTo: staff._id,
          companyName: company._id,
          ...taskLeadDateFilter,
        });
        const qpOrders = await QpData.countDocuments({
          createdBy: staff._id,
          companyName: company._id,
          ...otherModelsDateFilter,
        });
        const sakshiOrders = await Order.countDocuments({
          createdBy: staff._id,
          companyName: company._id,
          ...otherModelsDateFilter,
        });
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

        const totalSale =
          qpTotalSaleData.length > 0 ? qpTotalSaleData[0].totalSale : 0;

        const qpOrderParties = await QpData.find({
          createdBy: staff._id,
          companyName: company._id,
          ...otherModelsDateFilter,
        }).distinct("party");
        const sakshiOrderParties = await Order.find({
          createdBy: staff._id,
          companyName: company._id,
          ...otherModelsDateFilter,
        }).distinct("party");

        const createdParties = await AccountMaster.find({
          createdBy: staff._id,
          companyName: company._id,
          ...otherModelsDateFilter,
        }).distinct("party");

        const newToCustomerParties = await Party.countDocuments({
          _id: { $in: [...new Set([...qpOrderParties])] },
          partyTag: "CUSTOMER",
        });
        const newPartiesStillNew = await Party.countDocuments({
          _id: { $in: createdParties },
          partyTag: "NEW",
        });

        // Count NEW parties for this staff
        const newparty = await Party.countDocuments({
          _id: { $in: createdParties },
          partyTag: "NEW",
        });

        // Count CUSTOMER parties for this staff
        const customerparty = await Party.countDocuments({
          _id: { $in: createdParties },
          partyTag: "CUSTOMER",
        });

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
      })
    );

    res.status(200).json({
      success: true,
      data: reports,
      filters: { startDate, endDate, companyName: company.companyName },
    });
  } catch (error) {
    console.error("Error generating QP report:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
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
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
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
      {
        $unwind: { path: "$accountDetails", preserveNullAndEmptyArrays: true },
      },

      // Lookup creator staff from AccountMaster
      {
        $lookup: {
          from: "staffs",
          localField: "accountDetails.createdBy",
          foreignField: "_id",
          as: "createdByDetails",
        },
      },
      {
        $unwind: {
          path: "$createdByDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

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
        select:
          "_id ply length width height deckal paper1GSM paper2GSM paper3GSM noOfPieces ratePerPiece",
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
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
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
      {
        $unwind: { path: "$accountDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "staffs",
          localField: "accountDetails.createdBy",
          foreignField: "_id",
          as: "createdByDetails",
        },
      },
      {
        $unwind: {
          path: "$createdByDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

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

const getscDesigner = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    // Validate input dates
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Set end date to end of day for proper filtering
    end.setHours(23, 59, 59, 999);

    // Fetch designer roles
    const designerRoles = await Role.find({
      roleName: { $regex: "Designer", $options: "i" },
      isDelete: false,
    }).select("_id");

    // Extract role IDs
    const designerRoleIds = designerRoles.map((role) => role._id);

    // Fetch staff members with designer roles
    const staffList = await Staff.find({
      role: { $in: designerRoleIds },
    }).select("firstName lastName _id");

    // If no staff found with designer role
    if (staffList.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No staff found with designer role",
      });
    }

    // Create an array to hold designer performance data
    const designerPerformance = [];

    // Process each designer
    for (const staff of staffList) {
      // Find orders assigned to this designer within date range
      const orders = await Order.find({
        designer: staff._id,
        $or: [
          // Orders where designer was assigned within date range
          {
            designerAssignedAt: {
              $gte: start,
              $lte: end,
            },
          },
          // OR orders with design approval within date range
          {
            designApproved: {
              $gte: start,
              $lte: end,
            },
          },
          // OR orders with status changes within date range
          {
            statusHistory: {
              $elemMatch: {
                status: { $in: ["Designer", "Approved"] },
                changedAt: {
                  $gte: start,
                  $lte: end,
                },
              },
            },
          },
        ],
      })
        .populate("companyName", "companyName")
        .populate("party", "fullName")
        .populate("productItem", "itemName");

      // Count design approvals within date range
      const designApprovedCount = await Order.countDocuments({
        designer: staff._id,
        designApproved: {
          $gte: start,
          $lte: end,
        },
        designApproved: { $ne: null },
      });

      // Count rework orders within date range
      const reworkOrders = await Order.find({
        designer: staff._id,
        "reworkHistory.date": {
          $gte: start,
          $lte: end,
        },
      });

      // Count new design creations within date range (using designFiles.uploadedAt)
      const newDesignCreationCount = await Order.countDocuments({
        designer: staff._id,
        "designFiles.uploadedAt": {
          $gte: start,
          $lte: end,
        },
      });

      // Get detailed new design creation data
      const newDesignOrders = await Order.find({
        designer: staff._id,
        "designFiles.uploadedAt": {
          $gte: start,
          $lte: end,
        },
      }).select("orderNumber designFiles designerAssignedAt");

      // Process rework history count for this designer
      let reworkCount = 0;
      const reworkDetails = [];

      reworkOrders.forEach((order) => {
        order.reworkHistory.forEach((rework) => {
          const reworkDate = rework.uploadedAt || rework.date;
          if (reworkDate >= start && reworkDate <= end) {
            reworkCount++;
            reworkDetails.push({
              orderId: order._id,
              orderNumber: order.orderNumber,
              reworkDate: reworkDate,
              remarks: rework.remark,
              filesCount: rework.files ? rework.files.length : 0,
            });
          }
        });
      });

      // Process new design creation details
      const newDesignDetails = [];
      newDesignOrders.forEach((order) => {
        order.designFiles.forEach((file) => {
          if (file.uploadedAt >= start && file.uploadedAt <= end) {
            newDesignDetails.push({
              orderId: order._id,
              orderNumber: order.orderNumber,
              filePath: file.path,
              uploadedAt: file.uploadedAt,
              remark: file.remark || "",
              designerAssignedAt: order.designerAssignedAt,
            });
          }
        });
      });

      // Calculate pending designs count (assigned but not approved)
      const pendingDesignsCount = await Order.countDocuments({
        designer: staff._id,
        designerStatus: { $in: ["Pending", "In Progress", "Rework"] },
        designerAssignedAt: { $ne: null },
        $or: [{ designApproved: null }, { designerStatus: "Rework" }],
        designerAssignedAt: {
          $gte: start,
          $lte: end,
        },
      });

      // Calculate average approval time (in hours)
      const completedOrders = await Order.find({
        designer: staff._id,
        designApproved: {
          $gte: start,
          $lte: end,
        },
        designerAssignedAt: { $ne: null },
        designApproved: { $ne: null },
      }).select("designerAssignedAt designApproved");

      let totalApprovalTime = 0;
      let avgApprovalTime = 0;

      if (completedOrders.length > 0) {
        completedOrders.forEach((order) => {
          const approvalTime =
            (order.designApproved - order.designerAssignedAt) /
            (1000 * 60 * 60); // Convert to hours
          totalApprovalTime += approvalTime;
        });
        avgApprovalTime = totalApprovalTime / completedOrders.length;
      }

      // Prepare designer data
      const designerData = {
        designerId: staff._id,
        name: `${staff.firstName} ${staff.lastName}`,
        firstName: staff.firstName,
        lastName: staff.lastName,
        totalOrders: orders.length,
        approved: designApprovedCount,
        newDesigns: newDesignCreationCount,
        rework: reworkCount,
        pending: pendingDesignsCount,
        inProgress: await Order.countDocuments({
          designer: staff._id,
          designerStatus: "In Progress",
          designerAssignedAt: {
            $gte: start,
            $lte: end,
          },
        }),
        dateRange: {
          startDate: startDate,
          endDate: endDate,
        },
      };

      designerPerformance.push(designerData);
    }

    // Sort designers by designApprovedCount (highest first)
    designerPerformance.sort(
      (a, b) => b.designApprovedCount - a.designApprovedCount
    );

    // Calculate overall statistics
    // const overallStats = {
    //   totalDesigners: designerPerformance.length,
    //   totalDesignApproved: designerPerformance.reduce(
    //     (sum, designer) => sum + designer.designApprovedCount,
    //     0
    //   ),
    //   totalNewDesigns: designerPerformance.reduce(
    //     (sum, designer) => sum + designer.newDesignCreationCount,
    //     0
    //   ),
    //   totalRework: designerPerformance.reduce(
    //     (sum, designer) => sum + designer.reworkCount,
    //     0
    //   ),
    //   totalPending: designerPerformance.reduce(
    //     (sum, designer) => sum + designer.pendingDesignsCount,
    //     0
    //   ),
    //   averageCompletionRate:
    //     designerPerformance.length > 0
    //       ? (
    //           designerPerformance.reduce((sum, designer) => {
    //             const rate = parseFloat(designer.completionRate);
    //             return sum + (isNaN(rate) ? 0 : rate);
    //           }, 0) / designerPerformance.length
    //         ).toFixed(2) + "%"
    //       : "0%",
    //   averageNewDesignRate:
    //     designerPerformance.length > 0
    //       ? (
    //           designerPerformance.reduce((sum, designer) => {
    //             const rate = parseFloat(designer.newDesignRate);
    //             return sum + (isNaN(rate) ? 0 : rate);
    //           }, 0) / designerPerformance.length
    //         ).toFixed(2) + "%"
    //       : "0%",
    // };

    return res.status(200).json({
      success: true,
      data: designerPerformance,
      // overallStats: overallStats,
      message: "Designer performance data retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getscDesigner:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getscPrinter = async (req, res) => {
  try {
    // Implementation for SC Printer Report
    const { startDate, endDate } = req.body;

    // Validate input dates
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Set end date to end of day for proper filtering
    end.setHours(23, 59, 59, 999);

    // Fetch printer roles
    const printerRoles = await Role.find({
      roleName: { $regex: "Printer", $options: "i" },
      isDelete: false,
    }).select("_id");

    // Extract role IDs
    const printerRoleIds = printerRoles.map((role) => role._id);

    // Fetch staff members with printer roles
    const staffList = await Staff.find({
      role: { $in: printerRoleIds },
    }).select("firstName lastName _id");

    // If no staff found with printer role
    if (staffList.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No staff found with printer role",
      });
    }

    // Create an array to hold printer performance data
    const printerPerformance = [];

    // Process each printer
    for (const staff of staffList) {
      // Find orders assigned to this printer within date range
      const orders = await Order.find({
        printer: staff._id,
        $or: [
          // Orders where printer was assigned within date range
          {
            printerAssignedAt: {
              $gte: start,
              $lte: end,
            },
          },
          // OR orders with printing started within date range
          {
            printingStartedAt: {
              $gte: start,
              $lte: end,
            },
          },
          // OR orders with printing completed within date range
          {
            printingCompletedAt: {
              $gte: start,
              $lte: end,
            },
          },
          // OR orders with status changes within date range
          {
            statusHistory: {
              $elemMatch: {
                status: "Printer",
                changedAt: {
                  $gte: start,
                  $lte: end,
                },
              },
            },
          },
        ],
      })
        .populate("companyName", "companyName")
        .populate("party", "fullName")
        .populate("productItem", "itemName");

      // Count printing completed orders within date range
      const printingCompletedCount = await Order.countDocuments({
        printer: staff._id,
        printingCompletedAt: {
          $gte: start,
          $lte: end,
        },
        printingCompletedAt: { $ne: null },
      });

      // Count pending orders (assigned but not started)
      const pendingOrders = await Order.find({
        printer: staff._id,
        printerStatus: "Pending",
        printerAssignedAt: { $ne: null },
        $or: [{ printingStartedAt: null }, { printingCompletedAt: null }],
        printerAssignedAt: {
          $gte: start,
          $lte: end,
        },
      });

      // Count in-progress orders (started but not completed)
      const inProgressOrders = await Order.find({
        printer: staff._id,
        printerStatus: "In Progress",
        printingStartedAt: { $ne: null },
        printingCompletedAt: null,
        printingStartedAt: {
          $gte: start,
          $lte: end,
        },
      });

      // Calculate pending days for pending orders
      const pendingOrdersWithDays = await Promise.all(
        pendingOrders.map(async (order) => {
          const pendingDays = calculateDaysDifference(
            order.printerAssignedAt,
            new Date() // current date
          );
          return {
            orderId: order._id,
            orderNumber: order.orderNumber,
            assignedDate: order.printerAssignedAt,
            pendingDays: pendingDays,
            qty: order.qty,
            companyName: order.companyName?.companyName || "N/A",
            partyName: order.party?.fullName || "N/A",
          };
        })
      );

      // Calculate in-progress days for in-progress orders
      const inProgressOrdersWithDays = await Promise.all(
        inProgressOrders.map(async (order) => {
          const inProgressDays = calculateDaysDifference(
            order.printingStartedAt,
            new Date() // current date
          );
          return {
            orderId: order._id,
            orderNumber: order.orderNumber,
            startedDate: order.printingStartedAt,
            inProgressDays: inProgressDays,
            qty: order.qty,
            companyName: order.companyName?.companyName || "N/A",
            partyName: order.party?.fullName || "N/A",
          };
        })
      );

      // Calculate completed days for completed orders
      const completedOrders = await Order.find({
        printer: staff._id,
        printingCompletedAt: {
          $gte: start,
          $lte: end,
        },
        printerAssignedAt: { $ne: null },
        printingCompletedAt: { $ne: null },
      }).select("orderNumber printerAssignedAt printingCompletedAt qty");

      const completedOrdersWithDays = completedOrders.map((order) => {
        const completedDays = calculateDaysDifference(
          order.printerAssignedAt,
          order.printingCompletedAt
        );
        return {
          orderId: order._id,
          orderNumber: order.orderNumber,
          assignedDate: order.printerAssignedAt,
          completedDate: order.printingCompletedAt,
          completedDays: completedDays,
          qty: order.qty,
        };
      });

      // Calculate average completion time
      let totalCompletionDays = 0;
      let avgCompletionDays = 0;

      if (completedOrdersWithDays.length > 0) {
        totalCompletionDays = completedOrdersWithDays.reduce(
          (sum, order) => sum + order.completedDays,
          0
        );
        avgCompletionDays =
          totalCompletionDays / completedOrdersWithDays.length;
      }

      // Calculate total pending days average
      const totalPendingDays = pendingOrdersWithDays.reduce(
        (sum, order) => sum + order.pendingDays,
        0
      );
      const avgPendingDays =
        pendingOrdersWithDays.length > 0
          ? totalPendingDays / pendingOrdersWithDays.length
          : 0;

      // Calculate total in-progress days average
      const totalInProgressDays = inProgressOrdersWithDays.reduce(
        (sum, order) => sum + order.inProgressDays,
        0
      );
      const avgInProgressDays =
        inProgressOrdersWithDays.length > 0
          ? totalInProgressDays / inProgressOrdersWithDays.length
          : 0;

      // Calculate paper usage and wastage
      const printerPapersOrders = await Order.find({
        printer: staff._id,
        printerAssignedAt: {
          $gte: start,
          $lte: end,
        },
      }).select("printerPapers printerWastedSheet");

      let totalSheetsUsed = 0;
      let totalWastedSheets = 0;

      printerPapersOrders.forEach((order) => {
        // Calculate sheets used from printerPapers array
        order.printerPapers.forEach((paper) => {
          if (paper.numberOfSheetsUsed && !isNaN(paper.numberOfSheetsUsed)) {
            totalSheetsUsed += parseInt(paper.numberOfSheetsUsed) || 0;
          }
        });
        // Add wasted sheets
        totalWastedSheets += order.printerWastedSheet || 0;
      });

      // Get recent 5 orders for this printer
      const recentOrders = await Order.find({
        printer: staff._id,
        printerAssignedAt: {
          $gte: start,
          $lte: end,
        },
      })
        .sort({ printerAssignedAt: -1 })
        .limit(5)
        .select(
          "orderNumber companyName party productItem qty printerStatus printingStartedAt printingCompletedAt"
        );

      // Prepare printer data
      const printerData = {
        printerId: staff._id,
        name: `${staff.firstName} ${staff.lastName}`,
        firstName: staff.firstName,
        lastName: staff.lastName,
        totalAssignedOrders: orders.length,
        printingCompletedCount: printingCompletedCount,
        pendingOrdersCount: pendingOrders.length,
        inProgressOrdersCount: inProgressOrders.length,
        completionRate:
          orders.length > 0
            ? ((printingCompletedCount / orders.length) * 100).toFixed(2) + "%"
            : "0%",
        avgCompletionDays: avgCompletionDays.toFixed(2) + " days",
        avgPendingDays: avgPendingDays.toFixed(2) + " days",
        avgInProgressDays: avgInProgressDays.toFixed(2) + " days",
        paperUsage: {
          totalSheetsUsed: totalSheetsUsed,
          totalWastedSheets: totalWastedSheets,
          wastagePercentage:
            totalSheetsUsed > 0
              ? ((totalWastedSheets / totalSheetsUsed) * 100).toFixed(2) + "%"
              : "0%",
        },
        pendingOrdersDetails: pendingOrdersWithDays,
        inProgressOrdersDetails: inProgressOrdersWithDays,
        completedOrdersDetails: completedOrdersWithDays,
        performanceMetrics: {
          totalOrders: orders.length,
          completed: printingCompletedCount,
          pending: pendingOrders.length,
          inProgress: inProgressOrders.length,
          efficiency:
            orders.length > 0
              ? ((printingCompletedCount / orders.length) * 100).toFixed(2) +
                "%"
              : "0%",
          avgProcessingTime: avgCompletionDays.toFixed(2) + " days",
        },
        recentOrders: recentOrders.map((order) => ({
          orderNumber: order.orderNumber,
          status: order.printerStatus,
          startedDate: order.printingStartedAt,
          completedDate: order.printingCompletedAt,
          quantity: order.qty,
          companyName: order.companyName?.companyName,
          partyName: order.party?.fullName,
        })),
        dateRange: {
          startDate: startDate,
          endDate: endDate,
        },
      };

      printerPerformance.push(printerData);
    }

    // Sort printers by printingCompletedCount (highest first)
    printerPerformance.sort(
      (a, b) => b.printingCompletedCount - a.printingCompletedCount
    );

    // Calculate overall statistics
    const overallStats = {
      totalPrinters: printerPerformance.length,
      totalCompleted: printerPerformance.reduce(
        (sum, printer) => sum + printer.printingCompletedCount,
        0
      ),
      totalPending: printerPerformance.reduce(
        (sum, printer) => sum + printer.pendingOrdersCount,
        0
      ),
      totalInProgress: printerPerformance.reduce(
        (sum, printer) => sum + printer.inProgressOrdersCount,
        0
      ),
      totalAssigned: printerPerformance.reduce(
        (sum, printer) => sum + printer.totalAssignedOrders,
        0
      ),
      avgCompletionRate:
        printerPerformance.length > 0
          ? (
              printerPerformance.reduce((sum, printer) => {
                const rate = parseFloat(printer.completionRate);
                return sum + (isNaN(rate) ? 0 : rate);
              }, 0) / printerPerformance.length
            ).toFixed(2) + "%"
          : "0%",
      avgCompletionDays:
        printerPerformance.length > 0
          ? (
              printerPerformance.reduce((sum, printer) => {
                const days = parseFloat(printer.avgCompletionDays);
                return sum + (isNaN(days) ? 0 : days);
              }, 0) / printerPerformance.length
            ).toFixed(2) + " days"
          : "0 days",
    };

    return res.status(200).json({
      success: true,
      data: printerPerformance,
      overallStats: overallStats,
      message: "Printer performance data retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getscPrinter:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Helper function to calculate days difference
function calculateDaysDifference(startDate, endDate) {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Calculate difference in milliseconds
  const diffTime = Math.abs(end - start);

  // Convert milliseconds to days
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

const getscBinder = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    // Validate input dates
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Set end date to end of day for proper filtering
    end.setHours(23, 59, 59, 999);

    // Fetch binder roles
    const binderRoles = await Role.find({
      roleName: { $regex: "^Binder$", $options: "i" },
      isDelete: false,
    }).select("_id");

    // Extract role IDs
    const binderRoleIds = binderRoles.map((role) => role._id);

    // Fetch staff members with binder roles
    const staffList = await Staff.find({
      role: { $in: binderRoleIds },
    }).select("firstName lastName _id");

    // If no staff found with binder role
    if (staffList.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No staff found with binder role",
      });
    }

    // Create an array to hold binder performance data
    const binderPerformance = [];

    // Process each binder
    for (const staff of staffList) {
      // Find orders assigned to this binder within date range
      const orders = await Order.find({
        binder: staff._id,
        $or: [
          // Orders where binder was assigned within date range
          {
            binderAssignedAt: {
              $gte: start,
              $lte: end,
            },
          },
          // OR orders with binding started within date range
          {
            bindingStartedAt: {
              $gte: start,
              $lte: end,
            },
          },
          // OR orders with binding completed within date range
          {
            bindingCompletedAt: {
              $gte: start,
              $lte: end,
            },
          },
          // OR orders with status changes within date range
          {
            statusHistory: {
              $elemMatch: {
                status: "Binder",
                changedAt: {
                  $gte: start,
                  $lte: end,
                },
              },
            },
          },
        ],
      })
        .populate("companyName", "companyName")
        .populate("party", "fullName")
        .populate("productItem", "itemName");

      // Count binding completed orders within date range
      const bindingCompletedCount = await Order.countDocuments({
        binder: staff._id,
        bindingCompletedAt: {
          $gte: start,
          $lte: end,
        },
        bindingCompletedAt: { $ne: null },
      });

      // Count pending orders (assigned but not started)
      const pendingOrders = await Order.find({
        binder: staff._id,
        binderStatus: "Pending",
        binderAssignedAt: { $ne: null },
        $or: [{ bindingStartedAt: null }, { bindingCompletedAt: null }],
        binderAssignedAt: {
          $gte: start,
          $lte: end,
        },
      });

      // Count in-progress orders (started but not completed)
      const inProgressOrders = await Order.find({
        binder: staff._id,
        binderStatus: "In Progress",
        bindingStartedAt: { $ne: null },
        bindingCompletedAt: null,
        bindingStartedAt: {
          $gte: start,
          $lte: end,
        },
      });

      // Calculate pending days for pending orders
      const pendingOrdersWithDays = await Promise.all(
        pendingOrders.map(async (order) => {
          const pendingDays = calculateDaysDifference(
            order.binderAssignedAt,
            new Date() // current date
          );
          return {
            orderId: order._id,
            orderNumber: order.orderNumber,
            assignedDate: order.binderAssignedAt,
            pendingDays: pendingDays,
            qty: order.qty,
            companyName: order.companyName?.companyName || "N/A",
            partyName: order.party?.fullName || "N/A",
            bindingType: order.bindingType,
          };
        })
      );

      // Calculate in-progress days for in-progress orders
      const inProgressOrdersWithDays = await Promise.all(
        inProgressOrders.map(async (order) => {
          const inProgressDays = calculateDaysDifference(
            order.bindingStartedAt,
            new Date() // current date
          );
          return {
            orderId: order._id,
            orderNumber: order.orderNumber,
            startedDate: order.bindingStartedAt,
            inProgressDays: inProgressDays,
            qty: order.qty,
            companyName: order.companyName?.companyName || "N/A",
            partyName: order.party?.fullName || "N/A",
            bindingType: order.bindingType,
          };
        })
      );

      // Calculate completed days for completed orders
      const completedOrders = await Order.find({
        binder: staff._id,
        bindingCompletedAt: {
          $gte: start,
          $lte: end,
        },
        binderAssignedAt: { $ne: null },
        bindingCompletedAt: { $ne: null },
      }).select(
        "orderNumber binderAssignedAt bindingCompletedAt qty bindingType"
      );

      const completedOrdersWithDays = completedOrders.map((order) => {
        const completedDays = calculateDaysDifference(
          order.binderAssignedAt,
          order.bindingCompletedAt
        );
        return {
          orderId: order._id,
          orderNumber: order.orderNumber,
          assignedDate: order.binderAssignedAt,
          completedDate: order.bindingCompletedAt,
          completedDays: completedDays,
          qty: order.qty,
          bindingType: order.bindingType,
        };
      });

      // Calculate average completion time
      let totalCompletionDays = 0;
      let avgCompletionDays = 0;

      if (completedOrdersWithDays.length > 0) {
        totalCompletionDays = completedOrdersWithDays.reduce(
          (sum, order) => sum + order.completedDays,
          0
        );
        avgCompletionDays =
          totalCompletionDays / completedOrdersWithDays.length;
      }

      // Calculate total pending days average
      const totalPendingDays = pendingOrdersWithDays.reduce(
        (sum, order) => sum + order.pendingDays,
        0
      );
      const avgPendingDays =
        pendingOrdersWithDays.length > 0
          ? totalPendingDays / pendingOrdersWithDays.length
          : 0;

      // Calculate total in-progress days average
      const totalInProgressDays = inProgressOrdersWithDays.reduce(
        (sum, order) => sum + order.inProgressDays,
        0
      );
      const avgInProgressDays =
        inProgressOrdersWithDays.length > 0
          ? totalInProgressDays / inProgressOrdersWithDays.length
          : 0;

      // Calculate paper usage and wastage
      const binderPapersOrders = await Order.find({
        binder: staff._id,
        binderAssignedAt: {
          $gte: start,
          $lte: end,
        },
      }).select("binderPapers binderWastedSheet");

      let totalSheetsUsed = 0;
      let totalWastedSheets = 0;

      binderPapersOrders.forEach((order) => {
        // Calculate sheets used from binderPapers array
        order.binderPapers.forEach((paper) => {
          if (paper.numberOfSheetsUsed && !isNaN(paper.numberOfSheetsUsed)) {
            totalSheetsUsed += parseInt(paper.numberOfSheetsUsed) || 0;
          }
        });
        // Add wasted sheets
        totalWastedSheets += order.binderWastedSheet || 0;
      });

      // Get recent 5 orders for this binder
      const recentOrders = await Order.find({
        binder: staff._id,
        binderAssignedAt: {
          $gte: start,
          $lte: end,
        },
      })
        .sort({ binderAssignedAt: -1 })
        .limit(5)
        .select(
          "orderNumber companyName party productItem qty binderStatus bindingStartedAt bindingCompletedAt bindingType"
        );

      // Prepare binder data
      const binderData = {
        binderId: staff._id,
        name: `${staff.firstName} ${staff.lastName}`,
        firstName: staff.firstName,
        lastName: staff.lastName,
        totalAssignedOrders: orders.length,
        bindingCompletedCount: bindingCompletedCount,
        pendingOrdersCount: pendingOrders.length,
        inProgressOrdersCount: inProgressOrders.length,
        completionRate:
          orders.length > 0
            ? ((bindingCompletedCount / orders.length) * 100).toFixed(2) + "%"
            : "0%",
        avgCompletionDays: avgCompletionDays.toFixed(2) + " days",
        avgPendingDays: avgPendingDays.toFixed(2) + " days",
        avgInProgressDays: avgInProgressDays.toFixed(2) + " days",
        paperUsage: {
          totalSheetsUsed: totalSheetsUsed,
          totalWastedSheets: totalWastedSheets,
          wastagePercentage:
            totalSheetsUsed > 0
              ? ((totalWastedSheets / totalSheetsUsed) * 100).toFixed(2) + "%"
              : "0%",
        },
        pendingOrdersDetails: pendingOrdersWithDays,
        inProgressOrdersDetails: inProgressOrdersWithDays,
        completedOrdersDetails: completedOrdersWithDays,
        performanceMetrics: {
          totalOrders: orders.length,
          completed: bindingCompletedCount,
          pending: pendingOrders.length,
          inProgress: inProgressOrders.length,
          efficiency:
            orders.length > 0
              ? ((bindingCompletedCount / orders.length) * 100).toFixed(2) + "%"
              : "0%",
          avgProcessingTime: avgCompletionDays.toFixed(2) + " days",
        },
        recentOrders: recentOrders.map((order) => ({
          orderNumber: order.orderNumber,
          status: order.binderStatus,
          startedDate: order.bindingStartedAt,
          completedDate: order.bindingCompletedAt,
          quantity: order.qty,
          bindingType: order.bindingType,
          companyName: order.companyName?.companyName,
          partyName: order.party?.fullName,
        })),
        dateRange: {
          startDate: startDate,
          endDate: endDate,
        },
      };

      binderPerformance.push(binderData);
    }

    // Sort binders by bindingCompletedCount (highest first)
    binderPerformance.sort(
      (a, b) => b.bindingCompletedCount - a.bindingCompletedCount
    );

    // Calculate overall statistics
    const overallStats = {
      totalBinders: binderPerformance.length,
      totalCompleted: binderPerformance.reduce(
        (sum, binder) => sum + binder.bindingCompletedCount,
        0
      ),
      totalPending: binderPerformance.reduce(
        (sum, binder) => sum + binder.pendingOrdersCount,
        0
      ),
      totalInProgress: binderPerformance.reduce(
        (sum, binder) => sum + binder.inProgressOrdersCount,
        0
      ),
      totalAssigned: binderPerformance.reduce(
        (sum, binder) => sum + binder.totalAssignedOrders,
        0
      ),
      avgCompletionRate:
        binderPerformance.length > 0
          ? (
              binderPerformance.reduce((sum, binder) => {
                const rate = parseFloat(binder.completionRate);
                return sum + (isNaN(rate) ? 0 : rate);
              }, 0) / binderPerformance.length
            ).toFixed(2) + "%"
          : "0%",
      avgCompletionDays:
        binderPerformance.length > 0
          ? (
              binderPerformance.reduce((sum, binder) => {
                const days = parseFloat(binder.avgCompletionDays);
                return sum + (isNaN(days) ? 0 : days);
              }, 0) / binderPerformance.length
            ).toFixed(2) + " days"
          : "0 days",
    };

    return res.status(200).json({
      success: true,
      data: binderPerformance,
      overallStats: overallStats,
      message: "Binder performance data retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getscBinder:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getscBookletBinder = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    // Validate input dates
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Set end date to end of day for proper filtering
    end.setHours(23, 59, 59, 999);

    // Fetch booklet binder roles (you may need to adjust the regex based on your role names)
    const bookletBinderRoles = await Role.find({
      $or: [
        { roleName: { $regex: "Booklet", $options: "i" } },
      ],
      isDelete: false,
    }).select("_id");

    // Extract role IDs
    const bookletBinderRoleIds = bookletBinderRoles.map((role) => role._id);

    // Fetch staff members with booklet binder roles
    const staffList = await Staff.find({
      role: { $in: bookletBinderRoleIds },
    }).select("firstName lastName _id");

    // If no staff found with booklet binder role
    if (staffList.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No staff found with booklet binder role",
      });
    }

    // Create an array to hold booklet binder performance data
    const bookletBinderPerformance = [];

    // Process each booklet binder
    for (const staff of staffList) {
      // Find orders assigned to this booklet binder within date range
      const orders = await Order.find({
        bookletBinder: staff._id,
        $or: [
          // Orders where booklet binder was assigned within date range
          {
            bookletBinderAssignedAt: {
              $gte: start,
              $lte: end,
            },
          },
          // OR orders with booklet binding started within date range
          {
            bookletBindingStartedAt: {
              $gte: start,
              $lte: end,
            },
          },
          // OR orders with booklet binding completed within date range
          {
            bookletBindingCompletedAt: {
              $gte: start,
              $lte: end,
            },
          },
          // OR orders with status changes within date range
          {
            statusHistory: {
              $elemMatch: {
                status: "Booklet & Folder Binder",
                changedAt: {
                  $gte: start,
                  $lte: end,
                },
              },
            },
          },
        ],
      })
        .populate("companyName", "companyName")
        .populate("party", "fullName")
        .populate("productItem", "itemName");

      // Count booklet binding completed orders within date range
      const bookletBindingCompletedCount = await Order.countDocuments({
        bookletBinder: staff._id,
        bookletBindingCompletedAt: {
          $gte: start,
          $lte: end,
        },
        bookletBindingCompletedAt: { $ne: null },
      });

      // Count pending orders (assigned but not started)
      const pendingOrders = await Order.find({
        bookletBinder: staff._id,
        bookletBinderStatus: "Pending",
        bookletBinderAssignedAt: { $ne: null },
        $or: [
          { bookletBindingStartedAt: null },
          { bookletBindingCompletedAt: null },
        ],
        bookletBinderAssignedAt: {
          $gte: start,
          $lte: end,
        },
      });

      // Count in-progress orders (started but not completed)
      const inProgressOrders = await Order.find({
        bookletBinder: staff._id,
        bookletBinderStatus: "In Progress",
        bookletBindingStartedAt: { $ne: null },
        bookletBindingCompletedAt: null,
        bookletBindingStartedAt: {
          $gte: start,
          $lte: end,
        },
      });

      // Calculate pending days for pending orders
      const pendingOrdersWithDays = await Promise.all(
        pendingOrders.map(async (order) => {
          const pendingDays = calculateDaysDifference(
            order.bookletBinderAssignedAt,
            new Date() // current date
          );
          return {
            orderId: order._id,
            orderNumber: order.orderNumber,
            assignedDate: order.bookletBinderAssignedAt,
            pendingDays: pendingDays,
            qty: order.qty,
            companyName: order.companyName?.companyName || "N/A",
            partyName: order.party?.fullName || "N/A",
            bookletFolderType: order.bookletFolderType,
          };
        })
      );

      // Calculate in-progress days for in-progress orders
      const inProgressOrdersWithDays = await Promise.all(
        inProgressOrders.map(async (order) => {
          const inProgressDays = calculateDaysDifference(
            order.bookletBindingStartedAt,
            new Date() // current date
          );
          return {
            orderId: order._id,
            orderNumber: order.orderNumber,
            startedDate: order.bookletBindingStartedAt,
            inProgressDays: inProgressDays,
            qty: order.qty,
            companyName: order.companyName?.companyName || "N/A",
            partyName: order.party?.fullName || "N/A",
            bookletFolderType: order.bookletFolderType,
          };
        })
      );

      // Calculate completed days for completed orders
      const completedOrders = await Order.find({
        bookletBinder: staff._id,
        bookletBindingCompletedAt: {
          $gte: start,
          $lte: end,
        },
        bookletBinderAssignedAt: { $ne: null },
        bookletBindingCompletedAt: { $ne: null },
      }).select(
        "orderNumber bookletBinderAssignedAt bookletBindingCompletedAt qty bookletFolderType"
      );

      const completedOrdersWithDays = completedOrders.map((order) => {
        const completedDays = calculateDaysDifference(
          order.bookletBinderAssignedAt,
          order.bookletBindingCompletedAt
        );
        return {
          orderId: order._id,
          orderNumber: order.orderNumber,
          assignedDate: order.bookletBinderAssignedAt,
          completedDate: order.bookletBindingCompletedAt,
          completedDays: completedDays,
          qty: order.qty,
          bookletFolderType: order.bookletFolderType,
        };
      });

      // Calculate average completion time
      let totalCompletionDays = 0;
      let avgCompletionDays = 0;

      if (completedOrdersWithDays.length > 0) {
        totalCompletionDays = completedOrdersWithDays.reduce(
          (sum, order) => sum + order.completedDays,
          0
        );
        avgCompletionDays =
          totalCompletionDays / completedOrdersWithDays.length;
      }

      // Calculate total pending days average
      const totalPendingDays = pendingOrdersWithDays.reduce(
        (sum, order) => sum + order.pendingDays,
        0
      );
      const avgPendingDays =
        pendingOrdersWithDays.length > 0
          ? totalPendingDays / pendingOrdersWithDays.length
          : 0;

      // Calculate total in-progress days average
      const totalInProgressDays = inProgressOrdersWithDays.reduce(
        (sum, order) => sum + order.inProgressDays,
        0
      );
      const avgInProgressDays =
        inProgressOrdersWithDays.length > 0
          ? totalInProgressDays / inProgressOrdersWithDays.length
          : 0;

      // Calculate paper usage and wastage
      const bookletPapersOrders = await Order.find({
        bookletBinder: staff._id,
        bookletBinderAssignedAt: {
          $gte: start,
          $lte: end,
        },
      }).select("bookletPapers bookletBinderWastedSheet");

      let totalSheetsUsed = 0;
      let totalWastedSheets = 0;

      bookletPapersOrders.forEach((order) => {
        // Calculate sheets used from bookletPapers array
        order.bookletPapers.forEach((paper) => {
          if (paper.numberOfSheetsUsed && !isNaN(paper.numberOfSheetsUsed)) {
            totalSheetsUsed += parseInt(paper.numberOfSheetsUsed) || 0;
          }
        });
        // Add wasted sheets
        totalWastedSheets += order.bookletBinderWastedSheet || 0;
      });

      // Get process details (checkboxes)
      const processDetailsOrders = await Order.find({
        bookletBinder: staff._id,
        bookletBinderAssignedAt: {
          $gte: start,
          $lte: end,
        },
      }).select("isPasting isCutting isCreasing isFoil isPunching");

      const processStats = {
        pasting: processDetailsOrders.filter((order) => order.isPasting).length,
        cutting: processDetailsOrders.filter((order) => order.isCutting).length,
        creasing: processDetailsOrders.filter((order) => order.isCreasing)
          .length,
        foil: processDetailsOrders.filter((order) => order.isFoil).length,
        punching: processDetailsOrders.filter((order) => order.isPunching)
          .length,
      };

      // Get recent 5 orders for this booklet binder
      const recentOrders = await Order.find({
        bookletBinder: staff._id,
        bookletBinderAssignedAt: {
          $gte: start,
          $lte: end,
        },
      })
        .sort({ bookletBinderAssignedAt: -1 })
        .limit(5)
        .select(
          "orderNumber companyName party productItem qty bookletBinderStatus bookletBindingStartedAt bookletBindingCompletedAt bookletFolderType isPasting isCutting isCreasing isFoil isPunching"
        );

      // Prepare booklet binder data
      const bookletBinderData = {
        bookletBinderId: staff._id,
        name: `${staff.firstName} ${staff.lastName}`,
        firstName: staff.firstName,
        lastName: staff.lastName,
        totalAssignedOrders: orders.length,
        bookletBindingCompletedCount: bookletBindingCompletedCount,
        pendingOrdersCount: pendingOrders.length,
        inProgressOrdersCount: inProgressOrders.length,
        completionRate:
          orders.length > 0
            ? ((bookletBindingCompletedCount / orders.length) * 100).toFixed(
                2
              ) + "%"
            : "0%",
        avgCompletionDays: avgCompletionDays.toFixed(2) + " days",
        avgPendingDays: avgPendingDays.toFixed(2) + " days",
        avgInProgressDays: avgInProgressDays.toFixed(2) + " days",
        paperUsage: {
          totalSheetsUsed: totalSheetsUsed,
          totalWastedSheets: totalWastedSheets,
          wastagePercentage:
            totalSheetsUsed > 0
              ? ((totalWastedSheets / totalSheetsUsed) * 100).toFixed(2) + "%"
              : "0%",
        },
        processStats: processStats,
        pendingOrdersDetails: pendingOrdersWithDays,
        inProgressOrdersDetails: inProgressOrdersWithDays,
        completedOrdersDetails: completedOrdersWithDays,
        performanceMetrics: {
          totalOrders: orders.length,
          completed: bookletBindingCompletedCount,
          pending: pendingOrders.length,
          inProgress: inProgressOrders.length,
          efficiency:
            orders.length > 0
              ? ((bookletBindingCompletedCount / orders.length) * 100).toFixed(
                  2
                ) + "%"
              : "0%",
          avgProcessingTime: avgCompletionDays.toFixed(2) + " days",
        },
        recentOrders: recentOrders.map((order) => ({
          orderNumber: order.orderNumber,
          status: order.bookletBinderStatus,
          startedDate: order.bookletBindingStartedAt,
          completedDate: order.bookletBindingCompletedAt,
          quantity: order.qty,
          bookletFolderType: order.bookletFolderType,
          processes: {
            pasting: order.isPasting,
            cutting: order.isCutting,
            creasing: order.isCreasing,
            foil: order.isFoil,
            punching: order.isPunching,
          },
          companyName: order.companyName?.companyName,
          partyName: order.party?.fullName,
        })),
        dateRange: {
          startDate: startDate,
          endDate: endDate,
        },
      };

      bookletBinderPerformance.push(bookletBinderData);
    }

    // Sort booklet binders by bookletBindingCompletedCount (highest first)
    bookletBinderPerformance.sort(
      (a, b) => b.bookletBindingCompletedCount - a.bookletBindingCompletedCount
    );

    // Calculate overall statistics
    const overallStats = {
      totalBookletBinders: bookletBinderPerformance.length,
      totalCompleted: bookletBinderPerformance.reduce(
        (sum, binder) => sum + binder.bookletBindingCompletedCount,
        0
      ),
      totalPending: bookletBinderPerformance.reduce(
        (sum, binder) => sum + binder.pendingOrdersCount,
        0
      ),
      totalInProgress: bookletBinderPerformance.reduce(
        (sum, binder) => sum + binder.inProgressOrdersCount,
        0
      ),
      totalAssigned: bookletBinderPerformance.reduce(
        (sum, binder) => sum + binder.totalAssignedOrders,
        0
      ),
      avgCompletionRate:
        bookletBinderPerformance.length > 0
          ? (
              bookletBinderPerformance.reduce((sum, binder) => {
                const rate = parseFloat(binder.completionRate);
                return sum + (isNaN(rate) ? 0 : rate);
              }, 0) / bookletBinderPerformance.length
            ).toFixed(2) + "%"
          : "0%",
      avgCompletionDays:
        bookletBinderPerformance.length > 0
          ? (
              bookletBinderPerformance.reduce((sum, binder) => {
                const days = parseFloat(binder.avgCompletionDays);
                return sum + (isNaN(days) ? 0 : days);
              }, 0) / bookletBinderPerformance.length
            ).toFixed(2) + " days"
          : "0 days",
    };

    return res.status(200).json({
      success: true,
      data: bookletBinderPerformance,
      overallStats: overallStats,
      message: "Booklet binder performance data retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getscBookletBinder:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  getStaffReport,
  getSCReport,
  getQPReport,
  getqpInactiveParties,
  getscOrderInactiveParties,
  getscDesigner,
  getscPrinter,
  getscBinder,
  getscBookletBinder,
};
