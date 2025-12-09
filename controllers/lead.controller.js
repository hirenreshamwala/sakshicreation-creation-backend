const Lead = require("../models/lead.model");
const AccountMaster = require("../models/accountMaster.model");
const Staff = require("../models/staff.model");
const mongoose = require("mongoose");
const CompanyName = require("../models/companyName.model");
const Party = require("../models/Party.model");

const normalizeDate = (dateStr) => {
  if (!dateStr) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-");
    return `${day}-${month}-${year}`;
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    return dateStr;
  }

  return null;
};

// Helper function to determine dateType
const getDateType = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const leadDate = new Date(date);
  leadDate.setHours(0, 0, 0, 0);

  if (leadDate.getTime() === today.getTime()) {
    return "today";
  } else if (leadDate.getTime() === yesterday.getTime()) {
    return "yesterday";
  } else {
    return "older";
  }
};

exports.createLead = async (req, res) => {
  try {
    const {
      companyName,
      partyName,
      reason,
      customReason,
      assignedTo,
      date,
      time,
    } = req.body;
    console.log(req.body, "body");
    // Validate required fields
    if (!companyName || !partyName || !reason || !assignedTo) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    // Validate ObjectId fields
    if (
      !mongoose.Types.ObjectId.isValid(companyName) ||
      !mongoose.Types.ObjectId.isValid(partyName) ||
      !mongoose.Types.ObjectId.isValid(assignedTo)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format for companyName, partyName, or assignedTo",
      });
    }

    let normalizedDate = null;
    let computedDateType = "today"; // Default value
    if (date) {
      normalizedDate = normalizeDate(date);
      if (!normalizedDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Use DD-MM-YYYY or YYYY-MM-DD.",
        });
      }
      const [day, month, year] = normalizedDate.split("-");
      normalizedDate = new Date(`${year}-${month}-${day}`);
      computedDateType = getDateType(normalizedDate);
    }

    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (time && !timeRegex.test(time)) {
      return res.status(400).json({
        success: false,
        message: "Invalid time format. Use HH:MM in 24-hour format.",
      });
    }

    // Create new task
    const newLead = new Lead({
      companyName,
      partyName,
      reason,
      customReason,
      assignedTo,
      date: normalizedDate || new Date(),
      time: time || undefined,
    });

    // Save task to database
    const savedTask = await newLead.save();

    // Populate referenced fields
    const populatedTask = await Lead.findById(savedTask._id)
      .populate("companyName", "companyName avatar")
      .populate(
        "partyName",
        "partyName ownerName ownerMobileNo ownerWhatsAppNo contactPerson personMobileNo personWhatsAppNo contactForPayment contactMobileNo contactWhatsAppNo GSTNo partyTag address createdAt updatedAt"
      )
      .populate("assignedTo", "firstName lastName email")
      .lean();

    // Fetch AccountMaster to get createdBy
    const accountMaster = await AccountMaster.findOne({
      party: populatedTask.partyName._id,
      companyName: populatedTask.companyName._id,
    })
      .populate("createdBy", "firstName lastName")
      .lean();

    // Construct populated lead with createdBy
    const populatedLead = {
      ...populatedTask,
      partyName: {
        ...populatedTask.partyName,
        createdBy: accountMaster ? accountMaster.createdBy : null,
      },
    };

    return res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: populatedLead,
    });
  } catch (error) {
    console.error("Error creating Lead:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating Lead",
      error: error.message,
    });
  }
};

// Get all Leads
exports.getAllLeads = async (req, res) => {
  try {
    const { status, partyName, companyName, startDate, endDate, assignedTo, staffId } = req.body;

    let filter = {};

    // ✅ Status filter (multiple allowed)
    if (status && Array.isArray(status) && status.length > 0) {
      filter.status = { $in: status };
    }

    // Party filter
    if (partyName) {
      if (!mongoose.Types.ObjectId.isValid(partyName)) {
        return res.status(400).json({
          success: false,
          message: "Invalid partyName ID format",
        });
      }
      filter.partyName = partyName;
    }

    // Company filter
    if (companyName) {
      if (!mongoose.Types.ObjectId.isValid(companyName)) {
        return res.status(400).json({
          success: false,
          message: "Invalid companyName ID format",
        });
      }
      filter.companyName = companyName;
    }

    // AssignedTo filter (using staffId from request body)
    if (staffId) {
      if (!mongoose.Types.ObjectId.isValid(staffId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assignedTo ID format",
        });
      }
      filter.assignedTo = staffId;
    }

    // ✅ Date filter
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      filter.date = { $gte: start, $lte: end };
    }

    // Fetch leads with optimized population
    const leads = await Lead.find(filter)
      .populate("companyName", "companyName avatar _id")
      .populate("assignedTo", "firstName lastName email _id")
      .populate("originalLeadId", "date createdAt _id")
      .populate({
        path: "partyName",
        select: "partyName ownerName ownerMobileNo ownerWhatsAppNo ownerEmail contactPerson personMobileNo personWhatsAppNo contactPersonEmail contactForPayment contactMobileNo contactWhatsAppNo contactForPaymentEmail GSTNo address partyTag statusApproval createdAt updatedAt",
        populate: [
          { 
            path: "address.marketName", 
            model: "Market", 
            select: "marketName _id",
            strictPopulate: false 
          },
          { 
            path: "address.landMark", 
            model: "Market", 
            select: "landmark _id",
            strictPopulate: false 
          },
          { 
            path: "address.area", 
            model: "Market", 
            select: "area _id",
            strictPopulate: false 
          },
          { 
            path: "address.pincode", 
            model: "Market", 
            select: "pincode _id",
            strictPopulate: false 
          },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();

    // If no leads found, return early
    if (!leads || leads.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // Collect all unique party-company combinations for batch query
    const partyCompanyCombinations = [];
    const combinationsMap = new Map();

    leads.forEach(lead => {
      if (lead.partyName && lead.companyName) {
        const key = `${lead.partyName._id}_${lead.companyName._id}`;
        if (!combinationsMap.has(key)) {
          combinationsMap.set(key, true);
          partyCompanyCombinations.push({
            party: lead.partyName._id,
            companyName: lead.companyName._id
          });
        }
      }
    });

    // Single batch query to fetch all AccountMasters
    let accountMastersMap = new Map();
    
    if (partyCompanyCombinations.length > 0) {
      const accountMasters = await AccountMaster.find({
        $or: partyCompanyCombinations
      })
      .populate("createdBy", "firstName lastName email _id")
      .lean();

      // Create map for quick lookup
      accountMasters.forEach(account => {
        const key = `${account.party}_${account.companyName}`;
        accountMastersMap.set(key, account);
      });
    }

    // Process leads sequentially without Promise.all
    const populatedLeads = [];
    
    for (const lead of leads) {
      let createdBy = null;
      
      // Lookup createdBy from the map
      if (lead.partyName && lead.companyName) {
        const key = `${lead.partyName._id}_${lead.companyName._id}`;
        const accountMaster = accountMastersMap.get(key);
        if (accountMaster && accountMaster.createdBy) {
          createdBy = accountMaster.createdBy;
        }
      }

      // Transform lead with structured response
      const transformedLead = {
        _id: lead._id,
        companyName: lead.companyName ? {
          _id: lead.companyName._id,
          companyName: lead.companyName.companyName,
          avatar: lead.companyName.avatar
        } : null,
        partyName: lead.partyName ? {
          _id: lead.partyName._id,
          partyName: lead.partyName.partyName,
          ownerName: lead.partyName.ownerName,
          ownerMobileNo: lead.partyName.ownerMobileNo,
          ownerWhatsAppNo: lead.partyName.ownerWhatsAppNo,
          ownerEmail: lead.partyName.ownerEmail || "N/A",
          contactPerson: lead.partyName.contactPerson,
          personMobileNo: lead.partyName.personMobileNo,
          personWhatsAppNo: lead.partyName.personWhatsAppNo,
          contactPersonEmail: lead.partyName.contactPersonEmail || "N/A",
          contactForPayment: lead.partyName.contactForPayment,
          contactMobileNo: lead.partyName.contactMobileNo,
          contactWhatsAppNo: lead.partyName.contactWhatsAppNo,
          contactForPaymentEmail: lead.partyName.contactForPaymentEmail || "N/A",
          GSTNo: lead.partyName.GSTNo,
          address: lead.partyName.address ? {
            streetAddress: lead.partyName.address.streetAddress,
            marketName: lead.partyName.address.marketName ? {
              _id: lead.partyName.address.marketName._id,
              marketName: lead.partyName.address.marketName.marketName
            } : null,
            landMark: lead.partyName.address.landMark ? {
              _id: lead.partyName.address.landMark._id,
              landmark: lead.partyName.address.landMark.landmark
            } : null,
            area: lead.partyName.address.area ? {
              _id: lead.partyName.address.area._id,
              area: lead.partyName.address.area.area
            } : null,
            pincode: lead.partyName.address.pincode ? {
              _id: lead.partyName.address.pincode._id,
              pincode: lead.partyName.address.pincode.pincode
            } : null,
            city: lead.partyName.address.city,
            state: lead.partyName.address.state,
            country: lead.partyName.address.country
          } : null,
          partyTag: lead.partyName.partyTag,
          statusApproval: lead.partyName.statusApproval,
          createdAt: lead.partyName.createdAt,
          updatedAt: lead.partyName.updatedAt,
          createdBy: createdBy
        } : null,
        assignedTo: lead.assignedTo ? {
          _id: lead.assignedTo._id,
          firstName: lead.assignedTo.firstName,
          lastName: lead.assignedTo.lastName,
          email: lead.assignedTo.email
        } : null,
        originalLeadId: lead.originalLeadId ? {
          _id: lead.originalLeadId._id,
          date: lead.originalLeadId.date,
          createdAt: lead.originalLeadId.createdAt
        } : null,
        date: lead.date,
        time: lead.time,
        status: lead.status,
        remarks: lead.remarks || "NA",
        reasonForVisit: lead.reasonForVisit,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt
      };

      populatedLeads.push(transformedLead);
    }

    return res.status(200).json({
      success: true,
      count: populatedLeads.length,
      data: populatedLeads,
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching leads",
      error: error.message,
    });
  }
};

// In lead.controller.js
exports.bulkCreateLeads = async (req, res) => {
  try {
    const leadsData = req.body;
    console.log("Received leadsData:", leadsData);

    if (!Array.isArray(leadsData) || leadsData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Expected an array of lead data",
      });
    }

    const createdLeads = [];
    const errors = [];

    for (const leadData of leadsData) {
      try {
        const {
          companyName,
          partyName,
          reason,
          customReason,
          assignedTo,
          date,
          time,
          status = "pending",
          remark,
          callFeedback,
          rescheduleDate,
        } = leadData;

        console.log(`Processing lead for partyName: ${partyName}`);

        // Validate required fields
        if (!companyName || !partyName || !reason || !assignedTo || !date) {
          errors.push({
            partyName,
            message: "Missing required fields",
            missingFields: { companyName, partyName, reason, assignedTo, date },
          });
          console.log(`Validation failed for partyName: ${partyName}`, {
            companyName,
            partyName,
            reason,
            assignedTo,
            date,
          });
          continue;
        }

        // Validate ObjectId fields
        if (
          !mongoose.Types.ObjectId.isValid(companyName) ||
          !mongoose.Types.ObjectId.isValid(partyName) ||
          !mongoose.Types.ObjectId.isValid(assignedTo)
        ) {
          errors.push({
            partyName,
            message: "Invalid ID format",
            invalidFields: { companyName, partyName, assignedTo },
          });
          console.log(`Invalid ID format for partyName: ${partyName}`, {
            companyName,
            partyName,
            assignedTo,
          });
          continue;
        }

        // Validate existence of referenced documents
        const [company, party, staff] = await Promise.all([
          CompanyName.findById(companyName),
          Party.findById(partyName),
          Staff.findById(assignedTo),
        ]);

        if (!company) {
          errors.push({
            partyName,
            message: `Company not found for ID: ${companyName}`,
          });
          console.log(`Company not found for ID: ${companyName}`);
          continue;
        }

        if (!party) {
          errors.push({
            partyName,
            message: `Party not found for ID: ${partyName}`,
          });
          console.log(`Party not found for ID: ${partyName}`);
          continue;
        }

        if (!staff) {
          errors.push({
            partyName,
            message: `Staff not found for ID: ${assignedTo}`,
          });
          console.log(`Staff not found for ID: ${assignedTo}`);
          continue;
        }

        // Validate date format
        let normalizedDate = null;
        if (date) {
          const dateRegex = /^(\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})$/;
          if (!dateRegex.test(date)) {
            errors.push({
              partyName,
              message: "Invalid date format. Use DD-MM-YYYY or YYYY-MM-DD.",
            });
            console.log(`Invalid date format for partyName: ${partyName}`, {
              date,
            });
            continue;
          }

          let [year, month, day] = date.split("-");
          if (date.match(/^\d{2}-\d{2}-\d{4}$/)) {
            [day, month, year] = date.split("-");
          }
          normalizedDate = new Date(`${year}-${month}-${day}`);

          if (isNaN(normalizedDate.getTime())) {
            errors.push({ partyName, message: "Invalid date provided" });
            console.log(`Invalid date provided for partyName: ${partyName}`, {
              date,
            });
            continue;
          }
        }

        // Create lead
        const lead = new Lead({
          companyName,
          partyName,
          reason: reason === "Other" ? customReason : reason,
          customReason: reason === "Other" ? customReason : undefined,
          assignedTo,
          date: normalizedDate,
          time,
          status,
          remark,
          callFeedback,
          rescheduleDate,
        });

        const savedLead = await lead.save();
        createdLeads.push(savedLead);
        console.log(`Successfully created lead for partyName: ${partyName}`);
      } catch (error) {
        console.error(`Error processing lead:`, error);
        errors.push({
          partyName: leadData.partyName,
          message: error.message || "Error processing lead",
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: "Bulk lead creation completed",
      data: createdLeads,
      errors: errors.length > 0 ? errors : undefined,
      count: createdLeads.length,
    });
  } catch (error) {
    console.error("Error in bulk lead creation:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating leads",
      error: error.message,
    });
  }
};
exports.getLeadById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID format",
      });
    }

    // Fetch lead with population
    const lead = await Lead.findById(id)
      .populate("companyName")
      .populate("partyName")
      .populate({
        path: "partyName",
        select: "-__v",
        populate: [
          {
            path: "address.marketName",
            model: "Market",
            select: "marketName", // only marketName
          },
          // {
          //   path: "address.streetAddress",
          //   model: "Market",
          //   select: "streetAddress", // only streetAddress
          // },
          {
            path: "address.landMark",
            model: "Market",
            select: "landmark", // only landMark
          },
          {
            path: "address.area",
            model: "Market",
            select: "area", // only area
          },
          {
            path: "address.pincode",
            model: "Market",
            select: "pincode", // only pincode
          },
        ],
      })
      .populate("assignedTo")
      .lean();

    // Check if lead exists
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Fetch AccountMaster to get createdBy
    const accountMaster = await AccountMaster.findOne({
      party: lead.partyName._id,
      companyName: lead.companyName._id,
    })
      .populate("createdBy", "firstName lastName")
      .lean();

    // Construct populated lead with createdBy
    const populatedLead = {
      ...lead,
      partyName: {
        ...lead.partyName,
        createdBy: accountMaster ? accountMaster.createdBy : null,
      },
    };

    return res.status(200).json({
      success: true,
      data: populatedLead,
    });
  } catch (error) {
    console.error("Error fetching lead by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching lead",
      error: error.message,
    });
  }
};

exports.updateLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      companyName,
      partyName,
      reason,
      customReason,
      assignedTo,
      status,
      date,
      time,
      callFeedback,
      rescheduleDate,
    } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID format",
      });
    }

    // Check if lead exists
    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Validate updated fields (if provided)
    if (companyName) {
      if (!mongoose.Types.ObjectId.isValid(companyName)) {
        return res.status(400).json({
          success: false,
          message: "Invalid companyName ID format",
        });
      }
      const company = await CompanyName.findById(companyName);
      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }
    }

    if (partyName) {
      if (!mongoose.Types.ObjectId.isValid(partyName)) {
        return res.status(400).json({
          success: false,
          message: "Invalid partyName ID format",
        });
      }
      const party = await Party.findById(partyName);
      if (!party) {
        return res.status(404).json({
          success: false,
          message: "Party not found",
        });
      }
    }

    if (assignedTo) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assignedTo ID format",
        });
      }
      const staff = await Staff.findById(assignedTo);
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: "Staff member not found",
        });
      }
    }

    if (status) {
      const validStatuses = [
        "pending",
        "completed",
        "cancelled",
        "rescheduled",
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status provided",
        });
      }
    }

    // Validate callFeedback for updates
    if (callFeedback === undefined || callFeedback === "") {
      return res.status(400).json({
        success: false,
        message: "Call feedback is required for updates",
      });
    }

    // Validate time format if provided
    if (time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({
        success: false,
        message: "Invalid time format. Use HH:MM (24-hour format)",
      });
    }

    // Validate date format if provided
    let normalizedDate = null;
    if (date) {
      normalizedDate = new Date(date);
      if (isNaN(normalizedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Use a valid date (e.g., YYYY-MM-DD)",
        });
      }
    }

    let populatedNewLead = null;
    let originalCreatedAt = lead.createdAt; // Default to current lead's createdAt

    if (status === "rescheduled") {
      if (!rescheduleDate || isNaN(new Date(rescheduleDate).getTime())) {
        return res.status(400).json({
          success: false,
          message: "Valid reschedule date is required for rescheduled status",
        });
      }

      const rescheduleDateObj = new Date(rescheduleDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (rescheduleDateObj < today) {
        return res.status(400).json({
          success: false,
          message: "Reschedule date must be a future date",
        });
      }

      // Find the original lead's createdAt by tracing back through originalLeadId
      let rootLead = lead;
      while (rootLead.isRescheduledCall && rootLead.originalLeadId) {
        rootLead = await Lead.findById(rootLead.originalLeadId);
        if (!rootLead) {
          return res.status(404).json({
            success: false,
            message: "Original lead not found",
          });
        }
      }
      originalCreatedAt = rootLead.createdAt; // Get the root lead's createdAt

      // Create new lead for reschedule
      const newLead = new Lead({
        companyName: lead.companyName,
        partyName: lead.partyName,
        reason: lead.reason,
        customReason: lead.customReason,
        assignedTo: lead.assignedTo,
        date: rescheduleDateObj,
        time: lead.time,
        status: "pending",
        callFeedback,
        isRescheduledCall: true,
        originalLeadId: lead._id,
        createdAt: originalCreatedAt, // Set to original lead's createdAt
      });
      await newLead.save();

      // Populate the new lead for the response
      populatedNewLead = await Lead.findById(newLead._id)
        .populate("companyName", "companyName avatar")
        .populate(
          "partyName",
          "partyName ownerName ownerMobileNo ownerWhatsAppNo contactPerson personMobileNo personWhatsAppNo contactForPayment contactMobileNo contactWhatsAppNo GSTNo partyTag address createdAt updatedAt"
        )
        .populate("assignedTo", "firstName lastName email")
        .lean();
    }

    // Prepare update object
    const updateData = {
      ...(companyName && { companyName }),
      ...(partyName && { partyName }),
      ...(reason && { reason }),
      ...(reason === "Other" && customReason
        ? { customReason }
        : reason !== "Other"
        ? { customReason: undefined }
        : {}),
      ...(assignedTo && { assignedTo }),
      ...(status && { status }),
      ...(normalizedDate && { date: normalizedDate }),
      ...(time && { time }),
      ...(callFeedback && { callFeedback }),
      ...(status === "rescheduled"
        ? { rescheduleDate: new Date(rescheduleDate) }
        : { rescheduleDate: null }),
      updatedAt: new Date(),
    };

    // Update lead
    const updatedLead = await Lead.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate("companyName", "companyName avatar")
      .populate(
        "partyName",
        "partyName ownerName ownerMobileNo ownerWhatsAppNo contactPerson personMobileNo personWhatsAppNo contactForPayment contactMobileNo contactWhatsAppNo GSTNo partyTag address createdAt updatedAt"
      )
      .populate("assignedTo", "firstName lastName email")
      .lean();

    // Fetch createdBy from AccountMaster
    const accountMaster = await AccountMaster.findOne({
      party: updatedLead.partyName._id,
      companyName: updatedLead.companyName._id,
    })
      .populate("createdBy", "firstName lastName")
      .lean();

    // Attach createdBy to partyName
    const populatedLead = {
      ...updatedLead,
      partyName: {
        ...updatedLead.partyName,
        createdBy: accountMaster ? accountMaster.createdBy : null,
      },
    };

    // Prepare response
    const responseData = {
      originalLead: populatedLead,
    };

    if (status === "rescheduled" && populatedNewLead) {
      responseData.newLead = {
        message: "New lead created with rescheduled date",
        rescheduledDate: rescheduleDate,
        data: {
          ...populatedNewLead,
          partyName: {
            ...populatedNewLead.partyName,
            createdBy: accountMaster ? accountMaster.createdBy : null,
          },
        },
      };
    }

    return res.status(200).json({
      success: true,
      message:
        status === "rescheduled"
          ? "Lead rescheduled successfully and new lead created"
          : "Lead updated successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error updating lead:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate lead detected",
      });
    }
    if (error.message.includes("Custom reason is required")) {
      return res.status(400).json({
        success: false,
        message: 'Custom reason is required when reason is "Other"',
      });
    }
    if (error.message.includes("Call feedback is required")) {
      return res.status(400).json({
        success: false,
        message: "Call feedback is required for updates",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server error while updating lead",
      error: error.message,
    });
  }
};

// Update lead status
exports.updateLeadStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate("createdBy")
      .populate("assignedTo")
      .populate("companyName")
      .populate("partyName")
      .lean();

    if (!updatedLead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lead status updated successfully",
      data: updatedLead,
    });
  } catch (error) {
    console.error("Error updating lead status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update lead status",
      error: error.message,
    });
  }
};

// Delete lead
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete lead",
      error: error.message,
    });
  }
};

// Get party names by company
exports.getPartyNamesByCompany = async (req, res) => {
  try {
    const { companyName } = req.query;

    if (!companyName || !mongoose.Types.ObjectId.isValid(companyName)) {
      return res.status(400).json({
        success: false,
        message: "Invalid companyName ID",
      });
    }

    const parties = await AccountMaster.find({ companyName })
      .select("partyName -_id")
      .lean();

    res.status(200).json({
      success: true,
      data: parties.map((p) => p.partyName),
    });
  } catch (error) {
    console.error("Error fetching parties:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch parties",
      error: error.message,
    });
  }
};

exports.getLeadsByStaffId = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Validate staffId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID format",
      });
    }

    // 2. Check if staff exists (only basic info)
    const staff = await Staff.findById(id).select("firstName lastName email _id");
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    // 3. Fetch leads assigned to the staff member
    const leads = await Lead.find({ assignedTo: id })
      .populate({
        path: "companyName",
        select: "companyName avatar _id",
      })
      .populate({
        path: "assignedTo",
        select: "firstName lastName email _id",
      })
      .populate({
        path: "originalLeadId",
        select: "date createdAt _id",
      })
      .populate({
        path: "partyName",
        select: "partyName ownerName ownerMobileNo ownerWhatsAppNo ownerEmail contactPerson personMobileNo personWhatsAppNo contactPersonEmail contactForPayment contactMobileNo contactWhatsAppNo contactForPaymentEmail GSTNo address partyTag statusApproval createdAt updatedAt",
        populate: [
          {
            path: "address.marketName",
            model: "Market",
            select: "marketName _id",
          },
          {
            path: "address.landMark",
            model: "Market",
            select: "landmark _id",
          },
          {
            path: "address.area",
            model: "Market",
            select: "area _id",
          },
          {
            path: "address.pincode",
            model: "Market",
            select: "pincode _id",
          },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();

    // 4. Filter out leads with null companyName or partyName
    const validLeads = leads.filter(
      (lead) => lead.companyName && lead.partyName
    );

    // Early return if no valid leads
    if (validLeads.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No valid leads found for this staff member",
        staffDetails: {
          _id: staff._id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email
        },
        count: 0,
        data: [],
      });
    }

    // 5. Collect all unique company-party combinations for batch query
    const companyPartyCombinations = [];
    const combinationsMap = new Map();

    validLeads.forEach(lead => {
      if (lead.companyName && lead.partyName) {
        const key = `${lead.companyName._id}_${lead.partyName._id}`;
        if (!combinationsMap.has(key)) {
          combinationsMap.set(key, true);
          companyPartyCombinations.push({
            companyName: lead.companyName._id,
            party: lead.partyName._id
          });
        }
      }
    });

    // 6. Single batch query to fetch all AccountMasters
    let accountMastersMap = new Map();
    
    if (companyPartyCombinations.length > 0) {
      const accountMasters = await AccountMaster.find({
        $or: companyPartyCombinations
      })
      .populate("createdBy", "firstName lastName email _id")
      .lean();

      // Create map for quick lookup
      accountMasters.forEach(account => {
        const key = `${account.companyName}_${account.party}`;
        accountMastersMap.set(key, account);
      });
    }

    // 7. Process leads sequentially without Promise.all
    const leadsWithCreatedBy = [];
    
    for (const lead of validLeads) {
      let createdBy = null;
      
      // Lookup createdBy from the map
      if (lead.companyName && lead.partyName) {
        const key = `${lead.companyName._id}_${lead.partyName._id}`;
        const accountMaster = accountMastersMap.get(key);
        if (accountMaster && accountMaster.createdBy) {
          createdBy = accountMaster.createdBy;
        }
      }

      // Transform lead with structured response
      const transformedLead = {
        _id: lead._id,
        companyName: lead.companyName ? {
          _id: lead.companyName._id,
          companyName: lead.companyName.companyName,
          avatar: lead.companyName.avatar
        } : null,
        partyName: {
          _id: lead.partyName._id,
          partyName: lead.partyName.partyName,
          ownerName: lead.partyName.ownerName,
          ownerMobileNo: lead.partyName.ownerMobileNo,
          ownerWhatsAppNo: lead.partyName.ownerWhatsAppNo,
          ownerEmail: lead.partyName.ownerEmail || "N/A",
          contactPerson: lead.partyName.contactPerson,
          personMobileNo: lead.partyName.personMobileNo,
          personWhatsAppNo: lead.partyName.personWhatsAppNo,
          contactPersonEmail: lead.partyName.contactPersonEmail || "N/A",
          contactForPayment: lead.partyName.contactForPayment,
          contactMobileNo: lead.partyName.contactMobileNo,
          contactWhatsAppNo: lead.partyName.contactWhatsAppNo,
          contactForPaymentEmail: lead.partyName.contactForPaymentEmail || "N/A",
          GSTNo: lead.partyName.GSTNo,
          address: lead.partyName.address ? {
            streetAddress: lead.partyName.address.streetAddress,
            marketName: lead.partyName.address.marketName ? {
              _id: lead.partyName.address.marketName._id,
              marketName: lead.partyName.address.marketName.marketName
            } : null,
            landMark: lead.partyName.address.landMark ? {
              _id: lead.partyName.address.landMark._id,
              landmark: lead.partyName.address.landMark.landmark
            } : null,
            area: lead.partyName.address.area ? {
              _id: lead.partyName.address.area._id,
              area: lead.partyName.address.area.area
            } : null,
            pincode: lead.partyName.address.pincode ? {
              _id: lead.partyName.address.pincode._id,
              pincode: lead.partyName.address.pincode.pincode
            } : null,
            city: lead.partyName.address.city,
            state: lead.partyName.address.state,
            country: lead.partyName.address.country
          } : null,
          partyTag: lead.partyName.partyTag,
          statusApproval: lead.partyName.statusApproval,
          createdAt: lead.partyName.createdAt,
          updatedAt: lead.partyName.updatedAt,
          createdBy: createdBy
        },
        assignedTo: lead.assignedTo ? {
          _id: lead.assignedTo._id,
          firstName: lead.assignedTo.firstName,
          lastName: lead.assignedTo.lastName,
          email: lead.assignedTo.email
        } : null,
        originalLeadId: lead.originalLeadId ? {
          _id: lead.originalLeadId._id,
          date: lead.originalLeadId.date,
          createdAt: lead.originalLeadId.createdAt
        } : null,
        date: lead.date,
        time: lead.time,
        status: lead.status,
        remarks: lead.remarks || "NA",
        reasonForVisit: lead.reasonForVisit,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt
      };

      leadsWithCreatedBy.push(transformedLead);
    }

    // 8. Return the leads
    res.status(200).json({
      success: true,
      message: "Leads retrieved successfully",
      staffDetails: {
        _id: staff._id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email
      },
      count: leadsWithCreatedBy.length,
      data: leadsWithCreatedBy,
    });
  } catch (error) {
    console.error("Error fetching leads by staff ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch leads",
      error: error.message,
    });
  }
};

exports.addLeadCallHistory = async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required to add call history",
      });
    }

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $push: { callHistory: date } },
      { new: true } // Return updated document
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Call history added successfully",
      data: { callHistory: lead.callHistory },
    });
  } catch (error) {
    console.error("Error adding call history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add call history",
      error: error.message,
    });
  }
};
