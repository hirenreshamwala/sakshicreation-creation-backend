const Lead = require("../models/lead.model");
const AccountMaster = require("../models/accountMaster.model");
const Staff = require("../models/staff.model");
const mongoose = require("mongoose");
const CompanyName = require("../models/companyName.model");
const Party = require("../models/Party.model");
const moment = require("moment");

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
    const {
      status,
      partyName,
      companyName,
      startDate,
      endDate,
      assignedTo,
      staffId,
      page = 1,
      limit = 10,
      date,
      getDatesOnly = false,
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

    // Build aggregation pipeline
    const pipeline = [];

    // Step 1: Lookup partyName
    pipeline.push({
      $lookup: {
        from: "parties",
        localField: "partyName",
        foreignField: "_id",
        as: "partyData"
      }
    });
    pipeline.push({ $unwind: { path: "$partyData", preserveNullAndEmptyArrays: true } });

    // Step 2: Lookup companyName
    pipeline.push({
      $lookup: {
        from: "companynames",
        localField: "companyName",
        foreignField: "_id",
        as: "companyData"
      }
    });
    pipeline.push({ $unwind: { path: "$companyData", preserveNullAndEmptyArrays: true } });

    // Step 3: Lookup assignedTo
    pipeline.push({
      $lookup: {
        from: "staffs",
        localField: "assignedTo",
        foreignField: "_id",
        as: "assignedToData"
      }
    });
    pipeline.push({ $unwind: { path: "$assignedToData", preserveNullAndEmptyArrays: true } });

    // Step 4: Lookup market data for address fields
    pipeline.push({
      $lookup: {
        from: "markets",
        localField: "partyData.address.marketName",
        foreignField: "_id",
        as: "marketNameData"
      }
    });
    pipeline.push({
      $lookup: {
        from: "markets",
        localField: "partyData.address.area",
        foreignField: "_id",
        as: "areaData"
      }
    });

    // 1. Party lookup
    pipeline.push({
      $lookup: {
        from: "parties",
        localField: "partyName",
        foreignField: "_id",
        as: "partyData"
      }
    });
    pipeline.push({ $unwind: "$partyData" });

    // 2. Company lookup
    pipeline.push({
      $lookup: {
        from: "companynames",
        localField: "companyName",
        foreignField: "_id",
        as: "companyData"
      }
    });
    pipeline.push({ $unwind: "$companyData" });

    // ✅ 3. ACCOUNT MASTER LOOKUP (for createdBy)
    pipeline.push({
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
    });

    pipeline.push({
      $unwind: {
        path: "$accountData",
        preserveNullAndEmptyArrays: true
      }
    });


    // Step 5: Build match conditions
    const matchConditions = {};

    // Search across multiple fields
    if (search) {
      matchConditions.$or = [
        { 'partyData.partyName': { $regex: search, $options: 'i' } },
        { 'partyData.ownerName': { $regex: search, $options: 'i' } },
        { 'partyData.ownerMobileNo': { $regex: search, $options: 'i' } },
        { 'partyData.ownerWhatsAppNo': { $regex: search, $options: 'i' } },
        { 'companyData.companyName': { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } },
      ];
    }

    // Mobile filter - handle comma-separated values
    if (mobile) {
      if (mobile.includes(',')) {
        const mobiles = mobile.split(',').map(m => m.trim()).filter(m => m);
        matchConditions['partyData.ownerWhatsAppNo'] = { $in: mobiles };
      } else {
        matchConditions['partyData.ownerWhatsAppNo'] = mobile;
      }
    }

    // Unit No filter - handle comma-separated values
    if (unitNo) {
      if (unitNo.includes(',')) {
        const unitNos = unitNo.split(',').map(u => u.trim()).filter(u => u);
        matchConditions['partyData.address.unitNo'] = { $in: unitNos };
      } else {
        matchConditions['partyData.address.unitNo'] = unitNo;
      }
    }

    if (createdBy) {
      matchConditions.$or = matchConditions.$or || [];

      matchConditions.$or.push(
        { "accountData.createdByData.firstName": { $regex: createdBy.split(' ')[0], $options: "i" } },
        { "accountData.createdByData.lastName": { $regex: createdBy.split(' ')[1], $options: "i" } },
      );
    }


    // Market Name filter - handle comma-separated values
    if (marketName) {
      if (marketName.includes(',')) {
        const markets = marketName.split(',').map(m => m.trim()).filter(m => m);
        matchConditions['marketNameData.marketName'] = { $in: markets };
      } else {
        matchConditions['marketNameData.marketName'] = marketName;
      }
    }

    // Area filter - handle comma-separated values
    if (area) {
      if (area.includes(',')) {
        const areas = area.split(',').map(a => a.trim()).filter(a => a);
        matchConditions['areaData.area'] = { $in: areas };
      } else {
        matchConditions['areaData.area'] = area;
      }
    }

    // Party Tag filter - handle comma-separated values
    if (partyTag) {
      if (partyTag.includes(',')) {
        const tags = partyTag.split(',').map(t => t.trim()).filter(t => t);
        matchConditions['partyData.partyTag'] = { $in: tags };
      } else {
        matchConditions['partyData.partyTag'] = partyTag;
      }
    }

    // Assigned To filter by name/email - handle comma-separated values
    if (assignedToFilter) {
      if (assignedToFilter.includes(',')) {
        const names = assignedToFilter.split(',').map(n => n.trim()).filter(n => n);
        const regexArray = names.map(n => new RegExp(n, 'i'));
        matchConditions.$or = matchConditions.$or || [];
        matchConditions.$or.push(
          { 'assignedToData.firstName': { $in: regexArray } },
          { 'assignedToData.lastName': { $in: regexArray } },
          { 'assignedToData.email': { $in: regexArray } }
        );
      } else {
        matchConditions.$or = matchConditions.$or || [];
        matchConditions.$or.push(
          { 'assignedToData.firstName': { $regex: assignedToFilter.split(' ')[0], $options: 'i' } },
          { 'assignedToData.lastName': { $regex: assignedToFilter.split(' ')[1], $options: 'i' } },
        );
      }
    }

    // Reason filter - handle comma-separated values
    if (reason) {
      if (reason.includes(',')) {
        const reasons = reason.split(',').map(r => r.trim()).filter(r => r);
        matchConditions.reason = { $in: reasons };
      } else {
        matchConditions.reason = reason;
      }
    }

    // Status filter (multiple allowed)
    if (status && Array.isArray(status) && status.length > 0) {
      matchConditions.status = { $in: status };
    } else if (status) {
      matchConditions.status = status;
    }

    // Party filter - handle both ObjectId and comma-separated names
    if (partyName) {
      if (partyName.includes(',')) {
        // Comma-separated list of party names
        const names = partyName.split(',').map(n => n.trim()).filter(n => n);
        matchConditions['partyData.partyName'] = { $in: names };
      } else if (mongoose.Types.ObjectId.isValid(partyName)) {
        // Single ObjectId
        matchConditions.partyName = new mongoose.Types.ObjectId(partyName);
      } else {
        // Single party name
        matchConditions['partyData.partyName'] = partyName;
      }
    }

    // Company filter
    if (companyName) {
      if (mongoose.Types.ObjectId.isValid(companyName)) {
        matchConditions.companyName = new mongoose.Types.ObjectId(companyName);
      } else {
        // If not a valid ObjectId, filter by company name
        matchConditions['companyData.companyName'] = companyName;
      }
    }

    // Staff ID filter (assignedTo by ID)
    if (staffId) {
      if (mongoose.Types.ObjectId.isValid(staffId)) {
        matchConditions.assignedTo = new mongoose.Types.ObjectId(staffId);
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid staffId ID format",
        });
      }
    }

    // Date filter
    if (date) {
      // Format: DD/MM/YYYY
      const [day, month, year] = date.split('/');
      const startOfDay = new Date(`${year}-${month}-${day}`);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(`${year}-${month}-${day}`);
      endOfDay.setHours(23, 59, 59, 999);
      matchConditions.date = { $gte: startOfDay, $lte: endOfDay };
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchConditions.date = { $gte: start, $lte: end };
    }

    // Add match stage if there are conditions
    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // If getDatesOnly is true, return only dates with counts
    if (getDatesOnly) {
      pipeline.push({
        $group: {
          _id: {
            $dateToString: {
              format: "%d/%m/%Y",
              date: "$date"
            }
          },
          count: { $sum: 1 }
        }
      });
      pipeline.push({ $sort: { _id: -1 } });

      const dateGroups = await Lead.aggregate(pipeline);

      // Format the response
      const formattedDates = dateGroups.map(item => ({
        date: item._id,
        count: item.count
      }));

      return res.status(200).json({
        success: true,
        dates: formattedDates
      });
    }

    // For regular data fetching with pagination
    const skip = (page - 1) * limit;

    // Get total count
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Lead.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Add pagination
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    // Lookup originalLeadId
    pipeline.push({
      $lookup: {
        from: "leads",
        localField: "originalLeadId",
        foreignField: "_id",
        as: "originalLeadData"
      }
    });

    // Execute aggregation
    const leads = await Lead.aggregate(pipeline);

    // Populate createdBy from AccountMaster and restructure data
    const populatedLeads = await Promise.all(
      leads.map(async (lead) => {
        const accountMaster = await AccountMaster.findOne({
          party: lead.partyData?._id,
          companyName: lead.companyData?._id,
        })
          .populate("createdBy", "firstName lastName")
          .lean();

        // Lookup market data for nested population
        const marketNameData = lead.marketNameData && lead.marketNameData[0] ? lead.marketNameData[0] : null;
        const areaData = lead.areaData && lead.areaData[0] ? lead.areaData[0] : null;

        // Lookup other market fields
        let landMarkData = null;
        let pincodeData = null;
        if (lead.partyData?.address?.landMark) {
          const landMarkDoc = await mongoose.model('Market').findById(lead.partyData.address.landMark).select('landmark').lean();
          landMarkData = landMarkDoc;
        }
        if (lead.partyData?.address?.pincode) {
          const pincodeDoc = await mongoose.model('Market').findById(lead.partyData.address.pincode).select('pincode').lean();
          pincodeData = pincodeDoc;
        }

        // Restructure to match original format
        return {
          _id: lead._id,
          companyName: lead.companyData,
          partyName: lead.partyData ? {
            ...lead.partyData,
            createdBy: accountMaster ? accountMaster.createdBy : null,
            address: lead.partyData.address ? {
              ...lead.partyData.address,
              marketName: marketNameData,
              landMark: landMarkData,
              area: areaData,
              pincode: pincodeData
            } : undefined
          } : null,
          assignedTo: lead.assignedToData ? {
            _id: lead.assignedToData._id,
            firstName: lead.assignedToData.firstName,
            lastName: lead.assignedToData.lastName,
            email: lead.assignedToData.email
          } : null,
          originalLeadId: lead.originalLeadData && lead.originalLeadData[0] ? {
            _id: lead.originalLeadData[0]._id,
            date: lead.originalLeadData[0].date,
            createdAt: lead.originalLeadData[0].createdAt
          } : null,
          reason: lead.reason,
          customReason: lead.customReason,
          status: lead.status,
          date: lead.date,
          time: lead.time,
          callFeedback: lead.callFeedback,
          rescheduleDate: lead.rescheduleDate,
          isRescheduledCall: lead.isRescheduledCall,
          callHistory: lead.callHistory,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: populatedLeads,
      count: total,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
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

    // 2. Check if staff exists
    const staff = await Staff.findById(id);
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
        select: "companyName",
      })
      .populate({
        path: "partyName",
        select:
          "partyName address ownerName ownerMobileNo ownerWhatsAppNo contactPerson personMobileNo personWhatsAppNo contactForPayment contactMobileNo contactWhatsAppNo GSTNo partyTag",
      })
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
      .populate({
        path: "assignedTo",
        select: "firstName lastName email",
      })
      .populate({
        path: "originalLeadId",
        select: "date createdAt", // Updated
      })
      .sort({ createdAt: -1 })
      .lean();

    // 4. Filter out leads with null companyName or partyName
    const validLeads = leads.filter(
      (lead) =>
        lead.companyName &&
        lead.partyName &&
        lead.companyName._id &&
        lead.partyName._id
    );

    if (validLeads.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No valid leads found for this staff member",
        count: 0,
        data: [],
      });
    }

    // 5. Fetch AccountMaster for each lead to get createdBy
    const leadsWithCreatedBy = await Promise.all(
      validLeads.map(async (lead) => {
        try {
          const accountMaster = await AccountMaster.findOne({
            companyName: lead.companyName._id,
            party: lead.partyName._id,
          })
            .populate("createdBy", "firstName lastName")
            .lean();

          return {
            ...lead,
            partyName: {
              ...lead.partyName,
              createdBy: accountMaster ? accountMaster.createdBy : null,
            },
          };
        } catch (error) {
          console.error(`Error processing lead ${lead._id}:`, error);
          return null;
        }
      })
    );

    // Filter out any null entries from the mapping
    const filteredLeads = leadsWithCreatedBy.filter((lead) => lead !== null);

    // 6. Return the leads
    res.status(200).json({
      success: true,
      message: "Leads retrieved successfully",
      count: filteredLeads.length,
      data: filteredLeads,
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

exports.getPartyFilterOptionsData = async (req, res) => {
  try {
    const { field } = req.params;
    const { search } = req.body || {};

    let uniqueValues = [];

    switch (field) {

      /* ✅ CREATED DATE (FROM LEAD) */
      case "createdAt": {
        const leadDates = await mongoose.model("Lead").distinct("createdAt");

        uniqueValues = leadDates
          .sort((a, b) => new Date(b) - new Date(a))
          .map(d => moment(d).format("DD-MM-YYYY"))
          .filter(Boolean);

        break;
      }

      /* ✅ PARTY NAME (FROM LEAD -> PARTY REF) */
      case "partyName": {
        const partyIds = await mongoose.model("Lead").distinct("partyName");

        const parties = await Party.find(
          { _id: { $in: partyIds } },
          "partyName"
        );

        uniqueValues = parties.map(p => p.partyName).filter(Boolean);
        break;
      }

      /* ✅ MOBILE NO (ONLY PARTIES IN LEAD) */
      case "mobile": {
        const partyIds = await mongoose.model("Lead").distinct("partyName");

        const parties = await Party.find(
          { _id: { $in: partyIds } },
          "ownerWhatsAppNo"
        );

        uniqueValues = [
          ...new Set(
            parties.flatMap(party => [
              party.ownerWhatsAppNo,
            ]).filter(Boolean)
          )
        ];

        break;
      }

      /* ✅ REASON TO CALL (FROM LEAD) */
      case "reason": {
        uniqueValues = await mongoose.model("Lead").distinct("reason");
        uniqueValues = uniqueValues.filter(Boolean);
        break;
      }

      /* ✅ UNIT NO (FROM PARTY ADDRESS) */
      case "unitNo": {
        const partyIds = await mongoose.model("Lead").distinct("partyName");

        const parties = await Party.find(
          { _id: { $in: partyIds } },
          "address.unitNo"
        );

        uniqueValues = parties.map(p => p.address?.unitNo).filter(Boolean);
        break;
      }

      /* ✅ MARKET (FROM PARTY ADDRESS) */
      case "marketName": {
        const partyIds = await mongoose.model("Lead").distinct("partyName");

        const parties = await Party.find(
          { _id: { $in: partyIds } }
        ).populate("address.marketName", "marketName");

        uniqueValues = [
          ...new Set(
            parties.map(p => p.address?.marketName?.marketName).filter(Boolean)
          )
        ];

        break;
      }

      /* ✅ AREA (FROM PARTY ADDRESS) */
      case "area": {
        const partyIds = await mongoose.model("Lead").distinct("partyName");

        const parties = await Party.find(
          { _id: { $in: partyIds } }
        ).populate("address.area", "area");

        uniqueValues = [
          ...new Set(
            parties.map(p => p.address?.area?.area).filter(Boolean)
          )
        ];

        break;
      }

      /* ✅ PARTY STATUS (FROM PARTY) */
      case "partyStatus": {
        const partyIds = await mongoose.model("Lead").distinct("partyName");

        uniqueValues = await Party.distinct(
          "statusApproval",
          { _id: { $in: partyIds } }
        );

        uniqueValues = uniqueValues.filter(Boolean);
        break;
      }

      /* ✅ ASSIGN TO (FROM LEAD) */
      case "assignedTo": {
        const staffIds = await mongoose.model("Lead").distinct("assignedTo");

        const staff = await mongoose.model("Staff").find(
          { _id: { $in: staffIds } },
          "firstName lastName"
        );

        uniqueValues = staff.map(s => `${s.firstName} ${s.lastName}`).filter(Boolean);
        break;
      }

      /* ✅ CREATED BY (FROM LEAD) */
      case "createdBy": {

        // 1. Get all parties from Lead
        const parties = await Lead.distinct("partyName");

        // 2. Find createdBy from AccountMaster
        const accountData = await AccountMaster.find(
          { party: { $in: parties } },
          "createdBy"
        );

        const createdByIds = accountData
          .map(item => item.createdBy)
          .filter(Boolean);

        // 3. Get staff names
        const staff = await Staff.find(
          { _id: { $in: createdByIds } },
          "firstName lastName"
        );

        uniqueValues = [...new Set(
          staff.map(s => `${s.firstName} ${s.lastName}`)
        )];

        console.log(uniqueValues, 'uniqueValues')

        break;
      }


      default:
        return res.status(400).json({
          success: false,
          message: "Invalid field parameter",
        });
    }

    /* ✅ SEARCH SUPPORT */
    if (search) {
      const text = search.toLowerCase();
      uniqueValues = uniqueValues.filter(val =>
        val?.toString().toLowerCase().includes(text)
      );
    }

    /* ✅ CLEAN + SORT + LIMIT */
    uniqueValues = [...new Set(uniqueValues)].filter(Boolean).sort();
    // uniqueValues = uniqueValues.slice(0, 100);

    return res.status(200).json({
      success: true,
      data: uniqueValues,
      count: uniqueValues.length
    });

  } catch (error) {
    console.error("Filter Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

exports.getDataByPartyAndAccountMaster = async (req, res) => {
  try {
    const { partyId } = req.body;

    if (!partyId) {
      return res.status(400).json({
        success: false,
        message: "partyId is required"
      });
    }

    const result = await AccountMaster.findById(partyId)

    // Now get Leads manually (same party + company)
    let leadsData;

    if (result) {
      console.log( 'result in oif')
      leadsData = await Lead.find({
        partyName: result?.party,
      }).populate("companyName")
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
    }
    else {
      console.log('result in else')
      leadsData = await Lead.find({
        partyName: partyId,
      }).populate("companyName")
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
    }
    console.log(leadsData, 'leadsData')

    return res.status(200).json({
      success: true,
      data: leadsData
    });

  } catch (error) {
    console.error("Error fetching data:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching data",
      error: error.message
    });
  }
};
