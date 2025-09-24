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
            status: 'Completed',
            ...taskLeadDateFilter,
          });

          // Count cancelled tasks for this staff and company (using date field)
          const cancelledTasks = await AssignTask.countDocuments({
            assignTo: staff._id,
            companyName: company._id,
            status: 'Cancelled',
            ...taskLeadDateFilter,
          });

          // Count completed leads for this staff and company (using date field)
          const completedLeads = await Lead.countDocuments({
            assignedTo: staff._id,
            companyName: company._id,
            status: 'completed',
            ...taskLeadDateFilter,
          });

          // Count cancelled leads for this staff and company (using date field)
          const cancelledLeads = await Lead.countDocuments({
            assignedTo: staff._id,
            companyName: company._id,
            status: 'cancelled',
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
            completedLeads,
            cancelledLeads,
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

module.exports = { getStaffReport };