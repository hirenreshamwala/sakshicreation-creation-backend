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
    }).select("_id companyName").lean();
    if (!company)
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });

    const salesRoles = await Role.find({
      roleName: { $regex: "Sales Staff", $options: "i" },
      isDelete: false,
    }).select("_id").lean();
    const salesRoleIds = salesRoles.map((r) => r._id);

    const staffList = await Staff.find({ role: { $in: salesRoleIds } }).select(
      "firstName lastName _id"
    ).lean();

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

    // Initialize totals for the report
    let totalCompletedTasks = 0;
    let totalNewPartyVisits = 0;
    let totalNewToCustomer = 0;
    let totalStationaryOrders = 0;
    let totalBookletOrders = 0;
    let totalStationarySales = 0;
    let totalBookletSales = 0;
    
    // New totals for itemwise data
    let totalStationaryItemwise = {};
    let totalBookletItemwise = {};

    const reports = await Promise.all(
      staffList.map(async (staff) => {
        // Get all tasks for this staff in the date range
        const allTasks = await AssignTask.find({
          assignTo: staff._id,
          companyName: company._id,
          ...taskLeadDateFilter,
        }).populate("partyName", "partyTag").lean();

        // 1. Total Visits - Count all completed tasks
        const visitCount = allTasks.filter(task => 
          /^completed$/i.test(task.status)
        ).length;

        // Task counts (using allTasks for efficiency)
        const completedTasks = allTasks.filter(task => 
          /^completed$/i.test(task.status)
        ).length;
        
        const cancelledTasks = allTasks.filter(task => 
          /^cancelled$/i.test(task.status)
        ).length;
        
        const rescheduledTasks = allTasks.filter(task => 
          /^rescheduled$/i.test(task.status)
        ).length;
        
        const pendingTasks = allTasks.filter(task => 
          /^pending$/i.test(task.status)
        ).length;

        // Total tasks
        const totalTasks = allTasks.length;

        // tasksByReason
        const tasksByReason = {};

        taskReasons.forEach(
          (r) =>
            (tasksByReason[r.toLowerCase().replace(/\s+/g, "")] = {
              reason: r,
              total: 0,
              completed: 0,
              cancelled: 0,
              rescheduled: 0,
              pending: 0,
            })
        );
        tasksByReason["other"] = {
          reason: "Other",
          total: 0,
          completed: 0,
          cancelled: 0,
          rescheduled: 0,
          pending: 0,
        };

        allTasks.forEach((task) => {
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
          else if (/^pending$/i.test(task.status))
            tasksByReason[key].pending++;
        });

        // leadsByReason
        const leads = await Lead.find({
          assignedTo: staff._id,
          companyName: company._id,
          ...taskLeadDateFilter,
        }).select("reason status").lean();
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

        // Visit party task - new customer count
        let getVisitCount = 0;
        let newPartyCount = 0;
        let customerPartyCount = 0;

        allTasks.forEach((task) => {
          if (/^get visit$/i.test(task.reasonForVisit)) {
            getVisitCount++;

            if (task.partyName?.partyTag === "NEW") {
              newPartyCount++;
            } else if (task.partyName?.partyTag === "CUSTOMER") {
              customerPartyCount++;
            }
          }
        });

        // 2. New party visits - Get parties where partyTag is NEW
        const newPartyVisits = allTasks.filter(task => 
          task.partyName?.partyTag === "NEW" && 
          /^completed$/i.test(task.status)
        ).length;

        // New party visit to customer (NEW parties that became CUSTOMER within date range)
        const newToCustomerParties = await Party.countDocuments({
          createdBy: staff._id,
          companyName: company._id,
          partyTag: "CUSTOMER",
          updatedAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        });

        // 3. New party to customer - Count of NEW parties converted to CUSTOMER
        // We need to find parties that were created as NEW and later became CUSTOMER
        const newToCustomer = await Party.aggregate([
          {
            $match: {
              createdBy: staff._id,
              companyName: company._id,
              partyTag: "CUSTOMER",
              createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
              }
            }
          },
          {
            $lookup: {
              from: "orders",
              let: { partyId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$party", "$$partyId"] },
                        { $eq: ["$companyName", company._id] }
                      ]
                    }
                  }
                },
                { $limit: 1 }
              ],
              as: "firstOrder"
            }
          },
          {
            $match: {
              firstOrder: { $ne: [] },
              $expr: {
                $gt: [
                  { $arrayElemAt: ["$firstOrder.createdAt", 0] },
                  "$createdAt"
                ]
              }
            }
          },
          {
            $count: "count"
          }
        ]);

        const newPartyToCustomer = newToCustomer.length > 0 ? newToCustomer[0].count : 0;

        // Lead counts
        const completedLeads = leads.filter(lead => 
          /^completed$/i.test(lead.status)
        ).length;
        
        const cancelledLeads = leads.filter(lead => 
          /^cancelled$/i.test(lead.status)
        ).length;
        
        const rescheduledLeads = leads.filter(lead => 
          /^rescheduled$/i.test(lead.status)
        ).length;
        
        const totalLeads = leads.length;

        // QP Orders
        const qpOrders = await QpData.countDocuments({
          createdBy: staff._id,
          companyName: company._id,
          ...otherModelsDateFilter,
        });

        // Sakshi Orders (Stationary & Booklet)
        const sakshiOrders = await Order.find({
          createdBy: staff._id,
          companyName: company._id,
          ...otherModelsDateFilter,
        }).lean();

        // Separate Stationary and Booklet orders
        const stationaryOrders = sakshiOrders.filter(order => 
          order.category === "STATIONARY" || !order.category // Assuming some default
        );
        const bookletOrders = sakshiOrders.filter(order => 
          order.category === "BOOKLET"
        );

        const ordersGiven = sakshiOrders.length;
        const stationaryOrderCount = stationaryOrders.length;
        const bookletOrderCount = bookletOrders.length;

        // Stationary Order Itemwise Total
        const stationaryItemwise = {};
        stationaryOrders.forEach(order => {
          order.quotation?.forEach(item => {
            const itemName = item.productName || "Unknown";
            if (!stationaryItemwise[itemName]) {
              stationaryItemwise[itemName] = {
                itemName,
                quantity: 0,
                totalAmount: 0
              };
            }
            const qty = parseFloat(item.qty) || 0;
            const price = parseFloat(item.unitPrice) || 0;
            const gst = parseFloat(item.gst) || 0;
            const total = qty * price * (1 + gst/100);
            
            stationaryItemwise[itemName].quantity += qty;
            stationaryItemwise[itemName].totalAmount += total;
            
            // Also add to the total itemwise for all staff
            if (!totalStationaryItemwise[itemName]) {
              totalStationaryItemwise[itemName] = {
                itemName,
                quantity: 0,
                totalAmount: 0
              };
            }
            totalStationaryItemwise[itemName].quantity += qty;
            totalStationaryItemwise[itemName].totalAmount += total;
          });
        });

        // Booklet Order Itemwise Total
        const bookletItemwise = {};
        bookletOrders.forEach(order => {
          order.quotation?.forEach(item => {
            const itemName = item.productName || "Unknown";
            if (!bookletItemwise[itemName]) {
              bookletItemwise[itemName] = {
                itemName,
                quantity: 0,
                totalAmount: 0
              };
            }
            const qty = parseFloat(item.qty) || 0;
            const price = parseFloat(item.unitPrice) || 0;
            const gst = parseFloat(item.gst) || 0;
            const total = qty * price * (1 + gst/100);
            
            bookletItemwise[itemName].quantity += qty;
            bookletItemwise[itemName].totalAmount += total;
            
            // Also add to the total itemwise for all staff
            if (!totalBookletItemwise[itemName]) {
              totalBookletItemwise[itemName] = {
                itemName,
                quantity: 0,
                totalAmount: 0
              };
            }
            totalBookletItemwise[itemName].quantity += qty;
            totalBookletItemwise[itemName].totalAmount += total;
          });
        });

        // Total Sales Calculation with category separation
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
              category: 1,
              lastQuotation: { $arrayElemAt: ["$quotation", -1] },
            },
          },
          {
            $project: {
              category: 1,
              unitPrice: { $toDouble: "$lastQuotation.unitPrice" },
              qty: { $toDouble: "$lastQuotation.qty" },
              gst: { $toDouble: "$lastQuotation.gst" },
            },
          },
          {
            $project: {
              category: 1,
              total: { $multiply: ["$unitPrice", "$qty"] },
              gstAmount: {
                $divide: [{ $multiply: ["$unitPrice", "$qty", "$gst"] }, 100],
              },
            },
          },
          {
            $project: {
              category: 1,
              grandTotal: { $add: ["$total", "$gstAmount"] },
            },
          },
          {
            $group: {
              _id: "$category",
              totalSale: { $sum: "$grandTotal" },
            },
          },
        ]);

        // Calculate separate sales for Stationary and Booklet
        let totalSale = 0;
        let totalStationarySale = 0;
        let totalBookletSale = 0;
        
        totalSaleData.forEach(cat => {
          const category = cat._id || "STATIONARY"; // Default to STATIONARY if no category
          const sale = cat.totalSale || 0;
          
          totalSale += sale;
          
          if (category === "STATIONARY") {
            totalStationarySale = sale;
          } else if (category === "BOOKLET") {
            totalBookletSale = sale;
          }
        });

        // Party counts
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
        }).distinct("party").lean();

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

        // Add to totals
        totalCompletedTasks += completedTasks;
        totalNewPartyVisits += newPartyCount;
        totalNewToCustomer += newToCustomerParties;
        totalStationaryOrders += stationaryOrderCount;
        totalBookletOrders += bookletOrderCount;
        totalStationarySales += totalStationarySale;
        totalBookletSales += totalBookletSale;

        return {
          staffId: staff._id,
          staffName: `${staff.firstName} ${staff.lastName}`,
          companyId: company._id,
          companyName: company.companyName,
          // 3 new fields added here
          visit: visitCount,                    // Total completed visits
          newPartyVisit: newPartyVisits,       // New party visits
          newPartyToCustomer: newPartyToCustomer, // New parties converted to customer
          
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
          stationaryOrderCount,
          bookletOrderCount,
          stationaryItemwise: Object.values(stationaryItemwise),
          bookletItemwise: Object.values(bookletItemwise),
          newToCustomerParties,
          createdParties: createdParties.length,
          newPartiesStillNew,
          totalSale,
          totalStationarySale,
          totalBookletSale,
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

    // Add totals to the response
    const summary = {
      totalCompletedTasks,
      totalNewPartyVisits,
      totalNewToCustomer,
      totalStationaryOrders,
      totalBookletOrders,
      totalStationarySales,
      totalBookletSales,
      totalSales: totalStationarySales + totalBookletSales,
      totalStaff: staffList.length,
      // Add the new itemwise totals
      totalStationaryItemwise: Object.values(totalStationaryItemwise),
      totalBookletItemwise: Object.values(totalBookletItemwise),
    };

    res.status(200).json({
      success: true,
      data: reports,
      summary,
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
        .status(200)
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
    const cutoffDate = new Date(); // ✅ नाम change किया
    cutoffDate.setDate(cutoffDate.getDate() - days);

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
          // ✅ नया field: actualLastOrderDate जो lastOrderDate या createdAt use करे
          actualLastOrderDate: {
            $cond: {
              if: { $eq: [{ $max: "$orders.createdAt" }, null] },
              then: "$createdAt", // Party का createdAt
              else: { $max: "$orders.createdAt" }
            }
          }
        },
      },

      // Only include inactive parties
      {
        $match: {
          // ✅ Filter update किया
          $or: [
            { actualLastOrderDate: { $lt: cutoffDate } },
            {
              $and: [
                { actualLastOrderDate: { $eq: null } },
                { createdAt: { $lt: cutoffDate } }
              ]
            }
          ]
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
          partyTag: 1, // ✅ partyTag include करें
          lastOrderDate: 1,
          actualLastOrderDate: 1, // ✅ नया field
          lastOrderId: 1,
          createdAt: 1, // ✅ Party creation date
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
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

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
          // नया field: actualLastOrderDate जो lastOrderDate या createdAt use करे
          actualLastOrderDate: {
            $cond: {
              if: { $eq: [{ $max: "$orders.createdAt" }, null] },
              then: "$createdAt", // Party का createdAt
              else: { $max: "$orders.createdAt" }
            }
          }
        },
      },
      {
        $match: {
          // Filter: actualLastOrderDate cutoffDate से पहले हो या null हो
          $or: [
            { actualLastOrderDate: { $lt: cutoffDate } },
            {
              $and: [
                { actualLastOrderDate: { $eq: null } },
                { createdAt: { $lt: cutoffDate } }
              ]
            }
          ]
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

      // Final projection - partyTag को include करें
      {
        $project: {
          _id: 1,
          partyName: 1,
          ownerName: 1,
          ownerMobileNo: 1,
          partyTag: 1, // ✅ partyTag include करें
          lastOrderDate: 1,
          actualLastOrderDate: 1, // ✅ नया field
          lastOrderId: 1,
          createdAt: 1, // ✅ Party creation date
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
      select: "_id orderNumber qty createdAt productItem quotation finalAmount",
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

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    console.log("start", start);
    console.log("end", end);
    end.setHours(23, 59, 59, 999);

    const designerRoles = await Role.find({
      roleName: { $regex: "Designer", $options: "i" },
      isDelete: false,
    }).select("_id").lean();

    const designerRoleIds = designerRoles.map((r) => r._id);

    const staffList = await Staff.find({
      role: { $in: designerRoleIds },
    }).select("firstName lastName _id").lean();

    if (!staffList.length) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No staff found with designer role",
      });
    }

    // 🚀 PARALLEL execution for all designers
    const designerPerformance = await Promise.all(
      staffList.map(async (staff) => {
        const baseMatch = {
          designer: staff._id,
          designerAssignedAt: { $gte: start, $lte: end },
        };

        // 🔥 All DB calls in parallel
        const [
          orders,
          designApprovedCount,
          reworkOrders,
          newDesignCreationCount,
          newDesignOrders,
          pendingDesignsCount,
          inProgressCount,
          completedOrders,
        ] = await Promise.all([
          Order.find({
            designer: staff._id,
            $or: [{ designerAssignedAt: { $gte: start, $lte: end } }],
          })
            .populate("companyName", "companyName")
            .populate("party", "fullName")
            .populate("productItem", "itemName")
            .lean(),

          Order.countDocuments({
            designer: staff._id,
            designApproved: { $gte: start, $lte: end },
            designApproved: { $ne: null },
          }),

          Order.find({
            designer: staff._id,
            "reworkHistory.date": { $gte: start, $lte: end },
          }).lean(),

          Order.countDocuments({
            designer: staff._id,
            "designFiles.uploadedAt": { $gte: start, $lte: end },
          }),

          Order.find({
            designer: staff._id,
            "designFiles.uploadedAt": { $gte: start, $lte: end },
          })
            .select("orderNumber designFiles designerAssignedAt")
            .lean(),

          Order.countDocuments({
            designer: staff._id,
            designerStatus: { $in: ["Pending", "In Progress", "Rework"] },
            designerAssignedAt: { $gte: start, $lte: end },
            $or: [{ designApproved: null }, { designerStatus: "Rework" }],
          }),

          Order.countDocuments({
            designer: staff._id,
            designerStatus: "In Progress",
            designerAssignedAt: { $gte: start, $lte: end },
          }),

          Order.find({
            designer: staff._id,
            designApproved: { $gte: start, $lte: end, $ne: null },
            designerAssignedAt: { $ne: null },
          })
            .select("designerAssignedAt designApproved")
            .lean(),
        ]);

        // 🔁 SAME logic
        let reworkCount = 0;
        reworkOrders.forEach((order) => {
          order.reworkHistory.forEach((r) => {
            const d = r.uploadedAt || r.date;
            if (d >= start && d <= end) reworkCount++;
          });
        });

        let totalApprovalTime = 0;
        completedOrders.forEach((o) => {
          totalApprovalTime +=
            (o.designApproved - o.designerAssignedAt) / (1000 * 60 * 60);
        });

        return {
          designerId: staff._id,
          name: `${staff.firstName} ${staff.lastName}`,
          firstName: staff.firstName,
          lastName: staff.lastName,
          totalOrders: orders.length,
          approved: designApprovedCount,
          newDesigns: newDesignCreationCount,
          rework: reworkCount,
          pending: pendingDesignsCount,
          inProgress: inProgressCount,
          dateRange: { startDate, endDate },
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: designerPerformance,
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
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 1️⃣ Get Printer Roles
    const printerRoles = await Role.find({
      roleName: { $regex: "Printer", $options: "i" },
      isDelete: false,
    })
      .select("_id")
      .lean();

    const printerRoleIds = printerRoles.map((r) => r._id);

    // 2️⃣ Get Printer Staff
    const staffList = await Staff.find({
      role: { $in: printerRoleIds },
    })
      .select("_id firstName lastName")
      .lean();

    if (!staffList.length) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No staff found with printer role",
      });
    }

    const staffIds = staffList.map((s) => s._id);

    // 3️⃣ Get ALL Orders in ONE query
    const orders = await Order.find({
      printer: { $in: staffIds },
      printerAssignedAt: { $gte: start, $lte: end },
    })
      .populate("companyName", "companyName")
      .populate("party", "fullName")
      .populate("productItem", "itemName")
      .lean();

    // 4️⃣ Group Orders by Printer
    const ordersByPrinter = {};
    for (const order of orders) {
      const pid = order.printer.toString();
      if (!ordersByPrinter[pid]) ordersByPrinter[pid] = [];
      ordersByPrinter[pid].push(order);
    }

    const printerPerformance = [];

    // 5️⃣ Process each printer (NO DB CALLS HERE)
    for (const staff of staffList) {
      const printerOrders = ordersByPrinter[staff._id.toString()] || [];

      const completedOrders = printerOrders.filter(
        (o) => o.printingCompletedAt
      );

      const pendingOrders = printerOrders.filter(
        (o) => o.printerStatus === "Pending"
      );

      const inProgressOrders = printerOrders.filter(
        (o) => o.printerStatus === "In Progress"
      );

      // Pending days
      const pendingOrdersWithDays = pendingOrders.map((o) => ({
        orderId: o._id,
        orderNumber: o.orderNumber,
        assignedDate: o.printerAssignedAt,
        pendingDays: calculateDaysDifference(
          o.printerAssignedAt,
          new Date()
        ),
        qty: o.qty,
        companyName: o.companyName?.companyName || "N/A",
        partyName: o.party?.fullName || "N/A",
      }));

      // In-progress days
      const inProgressOrdersWithDays = inProgressOrders.map((o) => ({
        orderId: o._id,
        orderNumber: o.orderNumber,
        startedDate: o.printingStartedAt,
        inProgressDays: calculateDaysDifference(
          o.printingStartedAt,
          new Date()
        ),
        qty: o.qty,
        companyName: o.companyName?.companyName || "N/A",
        partyName: o.party?.fullName || "N/A",
      }));

      // Completed days
      const completedOrdersWithDays = completedOrders.map((o) => ({
        orderId: o._id,
        orderNumber: o.orderNumber,
        assignedDate: o.printerAssignedAt,
        completedDate: o.printingCompletedAt,
        completedDays: calculateDaysDifference(
          o.printerAssignedAt,
          o.printingCompletedAt
        ),
        qty: o.qty,
      }));

      // Averages
      const avg = (arr) =>
        arr.length
          ? (
              arr.reduce((s, o) => s + o, 0) / arr.length
            ).toFixed(2)
          : "0.00";

      const avgCompletionDays = avg(
        completedOrdersWithDays.map((o) => o.completedDays)
      );

      const avgPendingDays = avg(
        pendingOrdersWithDays.map((o) => o.pendingDays)
      );

      const avgInProgressDays = avg(
        inProgressOrdersWithDays.map((o) => o.inProgressDays)
      );

      // Paper usage
      let totalSheetsUsed = 0;
      let totalWastedSheets = 0;

      printerOrders.forEach((o) => {
        o.printerPapers?.forEach((p) => {
          totalSheetsUsed += Number(p.numberOfSheetsUsed || 0);
        });
        totalWastedSheets += o.printerWastedSheet || 0;
      });

      // Recent 5 Orders
      const recentOrders = [...printerOrders]
        .sort((a, b) => b.printerAssignedAt - a.printerAssignedAt)
        .slice(0, 5)
        .map((o) => ({
          orderNumber: o.orderNumber,
          status: o.printerStatus,
          startedDate: o.printingStartedAt,
          completedDate: o.printingCompletedAt,
          quantity: o.qty,
          companyName: o.companyName?.companyName,
          partyName: o.party?.fullName,
        }));

      printerPerformance.push({
        printerId: staff._id,
        name: `${staff.firstName} ${staff.lastName}`,
        totalAssignedOrders: printerOrders.length,
        printingCompletedCount: completedOrders.length,
        pendingOrdersCount: pendingOrders.length,
        inProgressOrdersCount: inProgressOrders.length,
        completionRate:
          printerOrders.length > 0
            ? (
                (completedOrders.length / printerOrders.length) *
                100
              ).toFixed(2) + "%"
            : "0%",
        avgCompletionDays: `${avgCompletionDays} days`,
        avgPendingDays: `${avgPendingDays} days`,
        avgInProgressDays: `${avgInProgressDays} days`,
        paperUsage: {
          totalSheetsUsed,
          totalWastedSheets,
          wastagePercentage:
            totalSheetsUsed > 0
              ? (
                  (totalWastedSheets / totalSheetsUsed) *
                  100
                ).toFixed(2) + "%"
              : "0%",
        },
        pendingOrdersDetails: pendingOrdersWithDays,
        inProgressOrdersDetails: inProgressOrdersWithDays,
        completedOrdersDetails: completedOrdersWithDays,
        recentOrders,
        dateRange: { startDate, endDate },
      });
    }

    // Sort by best printer
    printerPerformance.sort(
      (a, b) => b.printingCompletedCount - a.printingCompletedCount
    );

    // Overall stats
    const overallStats = {
      totalPrinters: printerPerformance.length,
      totalCompleted: printerPerformance.reduce(
        (s, p) => s + p.printingCompletedCount,
        0
      ),
      totalPending: printerPerformance.reduce(
        (s, p) => s + p.pendingOrdersCount,
        0
      ),
      totalInProgress: printerPerformance.reduce(
        (s, p) => s + p.inProgressOrdersCount,
        0
      ),
      totalAssigned: printerPerformance.reduce(
        (s, p) => s + p.totalAssignedOrders,
        0
      ),
    };

    return res.status(200).json({
      success: true,
      data: printerPerformance,
      overallStats,
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

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 1️⃣ Get Binder Roles
    const binderRoles = await Role.find({
      roleName: { $regex: "^Binder$", $options: "i" },
      isDelete: false,
    })
      .select("_id")
      .lean();

    const binderRoleIds = binderRoles.map((r) => r._id);

    // 2️⃣ Get Binder Staff
    const staffList = await Staff.find({
      role: { $in: binderRoleIds },
    })
      .select("_id firstName lastName")
      .lean();

    if (!staffList.length) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No staff found with binder role",
      });
    }

    const staffIds = staffList.map((s) => s._id);

    // 3️⃣ Get ALL Orders in ONE query
    const orders = await Order.find({
      binder: { $in: staffIds },
      binderAssignedAt: { $gte: start, $lte: end },
    })
      .populate("companyName", "companyName")
      .populate("party", "fullName")
      .populate("productItem", "itemName")
      .lean();

    // 4️⃣ Group orders by binder
    const ordersByBinder = {};
    for (const order of orders) {
      const bid = order.binder.toString();
      if (!ordersByBinder[bid]) ordersByBinder[bid] = [];
      ordersByBinder[bid].push(order);
    }

    const binderPerformance = [];

    // 5️⃣ Process binders (NO DB QUERIES)
    for (const staff of staffList) {
      const binderOrders = ordersByBinder[staff._id.toString()] || [];

      const completedOrders = binderOrders.filter(
        (o) => o.bindingCompletedAt
      );

      const pendingOrders = binderOrders.filter(
        (o) => o.binderStatus === "Pending"
      );

      const inProgressOrders = binderOrders.filter(
        (o) => o.binderStatus === "In Progress"
      );

      // Pending days
      const pendingOrdersWithDays = pendingOrders.map((o) => ({
        orderId: o._id,
        orderNumber: o.orderNumber,
        assignedDate: o.binderAssignedAt,
        pendingDays: calculateDaysDifference(
          o.binderAssignedAt,
          new Date()
        ),
        qty: o.qty,
        companyName: o.companyName?.companyName || "N/A",
        partyName: o.party?.fullName || "N/A",
        bindingType: o.bindingType,
      }));

      // In-progress days
      const inProgressOrdersWithDays = inProgressOrders.map((o) => ({
        orderId: o._id,
        orderNumber: o.orderNumber,
        startedDate: o.bindingStartedAt,
        inProgressDays: calculateDaysDifference(
          o.bindingStartedAt,
          new Date()
        ),
        qty: o.qty,
        companyName: o.companyName?.companyName || "N/A",
        partyName: o.party?.fullName || "N/A",
        bindingType: o.bindingType,
      }));

      // Completed days
      const completedOrdersWithDays = completedOrders.map((o) => ({
        orderId: o._id,
        orderNumber: o.orderNumber,
        assignedDate: o.binderAssignedAt,
        completedDate: o.bindingCompletedAt,
        completedDays: calculateDaysDifference(
          o.binderAssignedAt,
          o.bindingCompletedAt
        ),
        qty: o.qty,
        bindingType: o.bindingType,
      }));

      // Average helper
      const avg = (arr) =>
        arr.length
          ? (
              arr.reduce((s, v) => s + v, 0) / arr.length
            ).toFixed(2)
          : "0.00";

      const avgCompletionDays = avg(
        completedOrdersWithDays.map((o) => o.completedDays)
      );

      const avgPendingDays = avg(
        pendingOrdersWithDays.map((o) => o.pendingDays)
      );

      const avgInProgressDays = avg(
        inProgressOrdersWithDays.map((o) => o.inProgressDays)
      );

      // Paper usage
      let totalSheetsUsed = 0;
      let totalWastedSheets = 0;

      binderOrders.forEach((o) => {
        o.binderPapers?.forEach((p) => {
          totalSheetsUsed += Number(p.numberOfSheetsUsed || 0);
        });
        totalWastedSheets += o.binderWastedSheet || 0;
      });

      // Recent 5 orders
      const recentOrders = [...binderOrders]
        .sort((a, b) => b.binderAssignedAt - a.binderAssignedAt)
        .slice(0, 5)
        .map((o) => ({
          orderNumber: o.orderNumber,
          status: o.binderStatus,
          startedDate: o.bindingStartedAt,
          completedDate: o.bindingCompletedAt,
          quantity: o.qty,
          bindingType: o.bindingType,
          companyName: o.companyName?.companyName,
          partyName: o.party?.fullName,
        }));

      binderPerformance.push({
        binderId: staff._id,
        name: `${staff.firstName} ${staff.lastName}`,
        totalAssignedOrders: binderOrders.length,
        bindingCompletedCount: completedOrders.length,
        pendingOrdersCount: pendingOrders.length,
        inProgressOrdersCount: inProgressOrders.length,
        completionRate:
          binderOrders.length > 0
            ? (
                (completedOrders.length / binderOrders.length) *
                100
              ).toFixed(2) + "%"
            : "0%",
        avgCompletionDays: `${avgCompletionDays} days`,
        avgPendingDays: `${avgPendingDays} days`,
        avgInProgressDays: `${avgInProgressDays} days`,
        paperUsage: {
          totalSheetsUsed,
          totalWastedSheets,
          wastagePercentage:
            totalSheetsUsed > 0
              ? (
                  (totalWastedSheets / totalSheetsUsed) *
                  100
                ).toFixed(2) + "%"
              : "0%",
        },
        pendingOrdersDetails: pendingOrdersWithDays,
        inProgressOrdersDetails: inProgressOrdersWithDays,
        completedOrdersDetails: completedOrdersWithDays,
        recentOrders,
        dateRange: { startDate, endDate },
      });
    }

    // Sort by best binder
    binderPerformance.sort(
      (a, b) => b.bindingCompletedCount - a.bindingCompletedCount
    );

    // Overall stats
    const overallStats = {
      totalBinders: binderPerformance.length,
      totalCompleted: binderPerformance.reduce(
        (s, b) => s + b.bindingCompletedCount,
        0
      ),
      totalPending: binderPerformance.reduce(
        (s, b) => s + b.pendingOrdersCount,
        0
      ),
      totalInProgress: binderPerformance.reduce(
        (s, b) => s + b.inProgressOrdersCount,
        0
      ),
      totalAssigned: binderPerformance.reduce(
        (s, b) => s + b.totalAssignedOrders,
        0
      ),
    };

    return res.status(200).json({
      success: true,
      data: binderPerformance,
      overallStats,
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
    }).select("_id").lean();

    // Extract role IDs
    const bookletBinderRoleIds = bookletBinderRoles.map((role) => role._id);

    // Fetch staff members with booklet binder roles
    const staffList = await Staff.find({
      role: { $in: bookletBinderRoleIds },
    }).select("firstName lastName _id").lean();

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
        ],
      })
        .populate("companyName", "companyName")
        .populate("party", "fullName")
        .populate("productItem", "itemName").lean();

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
      ).lean();

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
      }).select("bookletPapers bookletBinderWastedSheet").lean();

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
      }).select("isPasting isCutting isCreasing isFoil isPunching").lean();

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
        ).lean();

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

const getscProductItem = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get sales staff roles
    const salesRoles = await Role.find({
      roleName: { $regex: "Sales Staff", $options: "i" },
      isDelete: false,
    }).select("_id");

    const salesRoleIds = salesRoles.map((role) => role._id);

    // Get all sales staff
    const staffList = await Staff.find({
      role: { $in: salesRoleIds },
    }).select("firstName lastName _id");

    if (staffList.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No sales staff found",
      });
    }

    const staffIds = staffList.map(staff => staff._id);

    // Get orders
    const orders = await Order.find({
      createdBy: { $in: staffIds },
      createdAt: { $gte: start, $lte: end }
    })
      .populate('productItem', 'itemName')
      .populate('createdBy', 'firstName lastName')
      .select('orderNumber productItem createdBy')
      .lean();

    // Create simple count map
    const resultMap = {};

    orders.forEach(order => {
      const staffId = order.createdBy._id.toString();
      const staffName = `${order.createdBy.firstName} ${order.createdBy.lastName}`;
      const productId = order.productItem?._id?.toString();
      const productName = order.productItem?.itemName || 'Unknown';

      if (!resultMap[staffId]) {
        resultMap[staffId] = {
          staffId: staffId,
          staffName: staffName,
          products: {}
        };
      }

      if (!resultMap[staffId].products[productId]) {
        resultMap[staffId].products[productId] = {
          productId: productId,
          productName: productName,
          orderCount: 0
        };
      }

      resultMap[staffId].products[productId].orderCount += 1;
    });

    // Format response
    const formattedResult = Object.values(resultMap).map(staff => ({
      staffName: staff.staffName,
      products: Object.values(staff.products)
        .sort((a, b) => b.orderCount - a.orderCount)
        .map(product => ({
          productName: product.productName,
          orderCount: product.orderCount
        }))
    }));

    return res.status(200).json({
      success: true,
      data: formattedResult,
      message: "Sales staff product item count retrieved successfully",
    });

  } catch (error) {
    console.error("Error in getscProductItem:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
const getscsalescredit = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    // Input validation
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format for startDate or endDate",
      });
    }

    // Set end date to end of day
    end.setHours(23, 59, 59, 999);

    const salesCreditReport = await Order.aggregate([
      // Stage 1: Date range filter
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          salecredit: { $exists: true, $ne: null }
        }
      },
      // Stage 2: Join staff details
      {
        $lookup: {
          from: "staffs",
          let: { saleCreditId: "$salecredit" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$saleCreditId"] }
              }
            },
            {
              $project: {
                firstName: 1,
                lastName: 1
              }
            }
          ],
          as: "staffDetails"
        }
      },
      // Stage 3: Unwind staffDetails
      {
        $unwind: {
          path: "$staffDetails",
          preserveNullAndEmptyArrays: false
        }
      },
      // Stage 4: Group by salecredit (staff) - એક staff માટે બધા orders નો total કરો
      {
        $group: {
          _id: "$salecredit",
          staffName: {
            $first: {
              $concat: ["$staffDetails.firstName", " ", "$staffDetails.lastName"]
            }
          },
          // દરેક staff ના બધા orders નો total finalAmount
          totalFinalAmount: { $sum: "$finalAmount" },
          // કુલ કેટલા orders છે તેની ગણતરી
          totalOrders: { $sum: 1 },
          // દરેક order ની વિગતો (જો જોઈતી હોય તો)
          orders: {
            $push: {
              orderNumber: "$orderNumber",
              finalAmount: "$finalAmount",
              createdAt: "$createdAt"
            }
          }
        }
      },
      // Stage 5: Sort by totalFinalAmount (જેથી સૌથી વધુ sales કરનાર staff પહેલા આવે)
      {
        $sort: { totalFinalAmount: -1 }
      },
      // Stage 6: Project only required fields
      {
        $project: {
          salecredit: "$_id",
          staffName: 1,
          totalFinalAmount: 1,
          totalOrders: 1,
          orders: {
            $slice: ["$orders", 50] // ફક્ત પ્રથમ 50 orders (જો જોઈતું હોય તો)
          }
        }
      }
    ]);

    if (!salesCreditReport.length) {
      return res.status(200).json({
        success: false,
        message: "No sales credit data found for the given date range",
        data: { report: [], dateRange: { startDate: start, endDate: end } },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Sales credit report fetched successfully",
      data: {
        report: salesCreditReport,
        dateRange: { startDate: start, endDate: end },
      },
    });
  } catch (error) {
    console.error("Error in getscsalescredit:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getQpsalescredit = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    // Input validation
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format for startDate or endDate",
      });
    }

    // Set end date to end of day
    end.setHours(23, 59, 59, 999);

    const salesCreditReport = await QpData.aggregate([
      // Stage 1: Date range filter and ensure createdBy exists
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          createdBy: { $exists: true, $ne: null }
        }
      },
      // Stage 2: Join staff details using createdBy field
      {
        $lookup: {
          from: "staffs",
          let: { staffId: "$createdBy" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$staffId"] }
              }
            },
            {
              $project: {
                firstName: 1,
                lastName: 1
              }
            }
          ],
          as: "staffDetails"
        }
      },
      // Stage 3: Unwind staffDetails
      {
        $unwind: {
          path: "$staffDetails",
          preserveNullAndEmptyArrays: false
        }
      },
      // Stage 4: Group by createdBy (staff)
      {
        $group: {
          _id: "$createdBy",
          staffName: {
            $first: {
              $concat: ["$staffDetails.firstName", " ", "$staffDetails.lastName"]
            }
          },
          // totalKg sum કરો (જો string હોય તો number માં convert કરો)
          totalKgSum: {
            $sum: {
              $cond: {
                if: { $eq: [{ $type: "$totalKg" }, "string"] },
                then: { $toDouble: "$totalKg" },
                else: { $toDouble: { $ifNull: ["$totalKg", 0] } }
              }
            }
          },
          totalOrders: { $sum: 1 },
          orders: {
            $push: {
              orderNumber: "$orderNo",
              totalKg: "$totalKg",
              createdAt: "$createdAt"
            }
          }
        }
      },
      // Stage 5: Sort by totalKgSum descending
      {
        $sort: { totalKgSum: -1 }
      },
      // Stage 6: Project final fields
      {
        $project: {
          createdBy: "$_id",
          staffName: 1,
          totalKgSum: 1,
          totalOrders: 1,
          orders: {
            $slice: ["$orders", 50]
          }
        }
      }
    ]);

    if (!salesCreditReport.length) {
      return res.status(200).json({
        success: false,
        message: "No sales credit data found for the given date range",
        data: { report: [], dateRange: { startDate: start, endDate: end } },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Sales credit report fetched successfully",
      data: {
        report: salesCreditReport,
        dateRange: { startDate: start, endDate: end },
      },
    });
  } catch (error) {
    console.error("Error in getQpsalescredit:", error);
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
  getscProductItem,
  getscsalescredit,
  getQpsalescredit
};
