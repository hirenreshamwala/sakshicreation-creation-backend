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
      createdAt,
    } = req.body;

    const preMatchConditions = {};
    const postMatchConditions = {};

    /* ================================
       STATUS FILTER
    ================================ */
    if (status && (Array.isArray(status) ? status.includes("pending") : status === "pending")) {
      // Pending includes actual Pending status or no date set (missing follow-up)
      preMatchConditions.$or = [
        ...(preMatchConditions.$or || []),
        { status: "pending" },
        { status: "rescheduled" },
        { date: { $exists: false } },
        { date: null }
      ];
    } else if (status && Array.isArray(status) && status.length > 0) {
      preMatchConditions.status = { $in: status };
    } else if (status) {
      preMatchConditions.status = status;
    }

    /* ================================
       COMPANY FILTER
    ================================ */
    if (companyName) {
      if (mongoose.Types.ObjectId.isValid(companyName)) {
        preMatchConditions.companyName = new mongoose.Types.ObjectId(companyName);
      } else {
        postMatchConditions["companyData.companyName"] = { $regex: companyName, $options: "i" };
      }
    }

    /* ================================
       PARTY NAME FILTER
    ================================ */
    if (partyName) {
      if (partyName.includes(",")) {
        const names = partyName.split(",").map((n) => n.trim()).filter((n) => n);
        postMatchConditions["partyData.partyName"] = {
          $in: names.map((name) => new RegExp(name, "i")),
        };
      } else if (mongoose.Types.ObjectId.isValid(partyName)) {
        preMatchConditions.partyName = new mongoose.Types.ObjectId(partyName);
      } else {
        postMatchConditions["partyData.partyName"] = { $regex: partyName, $options: "i" };
      }
    }

    /* ================================
       STAFF ID FILTER
    ================================ */
    if (staffId) {
      if (mongoose.Types.ObjectId.isValid(staffId)) {
        preMatchConditions.assignedTo = new mongoose.Types.ObjectId(staffId);
      } else {
        return res.status(400).json({ success: false, message: "Invalid staffId format" });
      }
    }

    /* ================================
       DATE FILTER
    ================================ */
    if (date) {
      if (typeof date === "string" && date.includes(",")) {
        const dateConditions = date
          .split(",")
          .map((d) => d.trim())
          .filter((d) => d)
          .map((dateStr) => {
            const parsed = parseDateString(dateStr);
            const start = new Date(parsed);
            start.setHours(0, 0, 0, 0);
            const end = new Date(parsed);
            end.setHours(23, 59, 59, 999);
            return { date: { $gte: start, $lte: end } };
          });

        if (dateConditions.length > 0) {
          preMatchConditions.$or = [...(preMatchConditions.$or || []), ...dateConditions];
        }
      } else {
        const parsed = parseDateString(date);
        const start = new Date(parsed);
        start.setHours(0, 0, 0, 0);
        const end = new Date(parsed);
        end.setHours(23, 59, 59, 999);
        preMatchConditions.date = { $gte: start, $lte: end };
      }
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      preMatchConditions.date = { $gte: start, $lte: end };
    }

    /* ================================
       CREATED AT FILTER
    ================================ */
    if (createdAt) {
      if (typeof createdAt === "string" && createdAt.includes(",")) {
        const dateConditions = createdAt
          .split(",")
          .map((d) => d.trim())
          .filter((d) => d)
          .map((dateStr) => {
            const parsed = parseDateString(dateStr);
            const start = new Date(parsed);
            start.setHours(0, 0, 0, 0);
            const end = new Date(parsed);
            end.setHours(23, 59, 59, 999);
            return { createdAt: { $gte: start, $lte: end } };
          });

        if (dateConditions.length > 0) {
          preMatchConditions.$or = [...(preMatchConditions.$or || []), ...dateConditions];
        }
      } else {
        const parsed = parseDateString(createdAt);
        const start = new Date(parsed);
        start.setHours(0, 0, 0, 0);
        const end = new Date(parsed);
        end.setHours(23, 59, 59, 999);
        preMatchConditions.createdAt = { $gte: start, $lte: end };
      }
    }

    /* ================================
       REASON FILTER
    ================================ */
    if (reason) {
      if (reason.includes(",")) {
        const reasons = reason.split(",").map((r) => r.trim()).filter((r) => r);
        preMatchConditions.reason = { $in: reasons.map((r) => new RegExp(`^${r}$`, "i")) };
      } else {
        preMatchConditions.reason = new RegExp(`^${reason}$`, "i");
      }
    }

    /* ================================
       BASE PIPELINE WITH ALL LOOKUPS
    ================================ */
    const pipeline = [];

    // Pre-match (before lookups for performance)
    if (Object.keys(preMatchConditions).length > 0) {
      pipeline.push({ $match: preMatchConditions });
    }

    // 1. LEAD → PARTY
    pipeline.push(
      {
        $lookup: {
          from: "parties",
          localField: "partyName",
          foreignField: "_id",
          as: "partyData",
        },
      },
      { $unwind: { path: "$partyData", preserveNullAndEmptyArrays: true } }
    );

    // 2. LEAD → COMPANY
    pipeline.push(
      {
        $lookup: {
          from: "companynames",
          localField: "companyName",
          foreignField: "_id",
          as: "companyData",
        },
      },
      { $unwind: { path: "$companyData", preserveNullAndEmptyArrays: true } }
    );

    // 3. LEAD → ASSIGNED TO (STAFF)
    pipeline.push(
      {
        $lookup: {
          from: "staffs",
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignedToData",
        },
      },
      { $unwind: { path: "$assignedToData", preserveNullAndEmptyArrays: true } }
    );

    // 4. PARTY ADDRESS → MARKET NAME
    pipeline.push({
      $lookup: {
        from: "markets",
        localField: "partyData.address.marketName",
        foreignField: "_id",
        as: "marketNameData",
      },
    });

    // 5. PARTY ADDRESS → AREA
    pipeline.push({
      $lookup: {
        from: "markets",
        localField: "partyData.address.area",
        foreignField: "_id",
        as: "areaData",
      },
    });

    // 6. PARTY ADDRESS → LANDMARK
    // pipeline.push({
    //   $lookup: {
    //     from: "markets",
    //     localField: "partyData.address.landMark",
    //     foreignField: "_id",
    //     as: "landMarkData",
    //   },
    // });

    // // 7. PARTY ADDRESS → PINCODE
    // pipeline.push({
    //   $lookup: {
    //     from: "markets",
    //     localField: "partyData.address.pincode",
    //     foreignField: "_id",
    //     as: "pincodeData",
    //   },
    // });

    // 8. ACCOUNT MASTER (for createdBy)
    pipeline.push(
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
      { $unwind: { path: "$accountData", preserveNullAndEmptyArrays: true } }
    );

    /* ================================
       POST-LOOKUP FILTERS
    ================================ */

    // MOBILE FILTER
    if (mobile) {
      const mobileList = mobile.includes(",")
        ? mobile.split(",").map((m) => m.trim()).filter((m) => m)
        : null;

      const mobileFields = [
        "partyData.ownerMobileNo",
        "partyData.ownerWhatsAppNo",
        "partyData.personMobileNo",
        "partyData.personWhatsAppNo",
        "partyData.contactMobileNo",
        "partyData.contactWhatsAppNo",
      ];

      postMatchConditions.$or = [
        ...(postMatchConditions.$or || []),
        ...mobileFields.map((field) => ({
          [field]: mobileList ? { $in: mobileList } : { $regex: mobile, $options: "i" },
        })),
      ];
    }

    // UNIT NO FILTER
    if (unitNo) {
      const unitNos = unitNo.split(",").map((u) => u.trim()).filter((u) => u);
      postMatchConditions["partyData.address.unitNo"] =
        unitNos.length > 1
          ? { $in: unitNos.map((u) => new RegExp(`^${u}$`, "i")) }
          : new RegExp(`^${unitNos[0]}$`, "i");
    }

    // MARKET NAME FILTER
    if (marketName) {
      const markets = marketName.split(",").map((m) => m.trim()).filter((m) => m);
      postMatchConditions["marketNameData.marketName"] =
        markets.length > 1
          ? { $in: markets.map((m) => new RegExp(m, "i")) }
          : new RegExp(markets[0], "i");
    }

    // AREA FILTER
    if (area) {
      const areas = area.split(",").map((a) => a.trim()).filter((a) => a);
      postMatchConditions["areaData.area"] =
        areas.length > 1
          ? { $in: areas.map((a) => new RegExp(a, "i")) }
          : new RegExp(areas[0], "i");
    }

    // PARTY TAG FILTER
    if (partyTag) {
      const tags = partyTag.split(",").map((t) => t.trim()).filter((t) => t);
      postMatchConditions["partyData.partyTag"] =
        tags.length > 1
          ? { $in: tags.map((t) => new RegExp(`^${t}$`, "i")) }
          : new RegExp(`^${tags[0]}$`, "i");
    }

    // CREATED BY FILTER
    if (createdBy) {
      const names = createdBy.split(",").map((n) => n.trim()).filter(Boolean);
      let createdByIds = [];

      for (const name of names) {
        const parts = name.split(" ").filter(Boolean);
        const staffQuery =
          parts.length >= 2
            ? {
                $and: [
                  { firstName: { $regex: `^${parts[0]}$`, $options: "i" } },
                  { lastName: { $regex: `^${parts.slice(1).join(" ")}$`, $options: "i" } },
                ],
              }
            : { firstName: { $regex: `^${parts[0]}$`, $options: "i" } };

        const staffs = await mongoose.model("Staff").find(staffQuery).select("_id");
        createdByIds.push(...staffs.map((s) => s._id));
      }

      createdByIds = [...new Set(createdByIds.map((id) => id.toString()))].map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      if (createdByIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          count: 0,
          pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 },
        });
      }

      postMatchConditions["accountData.createdBy"] = { $in: createdByIds };
    }

    // ASSIGNED TO FILTER
    if (assignedToFilter) {
      const assignToNames = typeof assignedToFilter === "string"
        ? assignedToFilter.split(",").map((n) => n.trim()).filter(Boolean)
        : [assignedToFilter];

      const assignToConditions = assignToNames.map((name) => {
        const parts = name.split(" ").filter(Boolean);
        if (parts.length >= 2) {
          return {
            $and: [
              { "assignedToData.firstName": { $regex: `^${parts[0]}$`, $options: "i" } },
              { "assignedToData.lastName": { $regex: `^${parts.slice(1).join(" ")}$`, $options: "i" } },
            ],
          };
        }
        return { "assignedToData.firstName": { $regex: `^${parts[0]}$`, $options: "i" } };
      });

      if (assignToConditions.length > 0) {
        postMatchConditions.$and = postMatchConditions.$and || [];
        postMatchConditions.$and.push({ $or: assignToConditions });
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
            { "partyData.partyName": searchRegex },
            { "partyData.ownerName": searchRegex },
            { "partyData.ownerMobileNo": searchRegex },
            { "partyData.ownerWhatsAppNo": searchRegex },
            { "companyData.companyName": searchRegex },
            { "partyData.address.unitNo": searchRegex },
            { "marketNameData.marketName": searchRegex },
            { "areaData.area": searchRegex },
            { reason: searchRegex },
            {
              $expr: {
                $regexMatch: {
                  input: { $concat: ["$assignedToData.firstName", " ", "$assignedToData.lastName"] },
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

    /* ================================
       GET DATES ONLY
    ================================ */
    if (getDatesOnly) {
      const dateGroups = await Lead.aggregate([
        ...pipeline,
        {
          $group: {
            _id: { $dateToString: { format: "%d/%m/%Y", date: "$date" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $project: { _id: 0, date: "$_id", count: 1 } },
      ]);

      return res.status(200).json({ success: true, dates: dateGroups });
    }

    /* ================================
       PAGINATION
    ================================ */
    const skip = (page - 1) * limit;

    // Count
    const countResult = await Lead.aggregate([...pipeline, { $count: "total" }]);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Paginated data with $project (no extra DB calls)
    const leads = await Lead.aggregate([
      ...pipeline,
      { $sort: { createdAt: -1 } },
      { $skip: parseInt(skip) },
      { $limit: parseInt(limit) },

      // Original lead lookup
      {
        $lookup: {
          from: "leads",
          localField: "originalLeadId",
          foreignField: "_id",
          as: "originalLeadData",
        },
      },

      // Final projection - only required fields
      {
        $project: {
          _id: 1,
          reason: 1,
          customReason: 1,
          status: 1,
          date: 1,
          time: 1,
          callFeedback: 1,
          rescheduleDate: 1,
          isRescheduledCall: 1,
          callHistory: 1,
          createdAt: 1,
          updatedAt: 1,

          companyName: {
            _id: "$companyData._id",
            companyName: "$companyData.companyName",
            avatar: "$companyData.avatar",
          },

          partyName: {
            _id: "$partyData._id",
            partyName: "$partyData.partyName",
            ownerName: "$partyData.ownerName",
            ownerMobileNo: "$partyData.ownerMobileNo",
            ownerWhatsAppNo: "$partyData.ownerWhatsAppNo",
            contactPerson: "$partyData.contactPerson",
            personMobileNo: "$partyData.personMobileNo",
            personWhatsAppNo: "$partyData.personWhatsAppNo",
            contactForPayment: "$partyData.contactForPayment",
            contactMobileNo: "$partyData.contactMobileNo",
            contactWhatsAppNo: "$partyData.contactWhatsAppNo",
            // GSTNo: "$partyData.GSTNo",
            partyTag: "$partyData.partyTag",
            createdAt: "$partyData.createdAt",
            updatedAt: "$partyData.updatedAt",

            createdBy: {
              _id: "$accountData.createdByData._id",
              firstName: "$accountData.createdByData.firstName",
              lastName: "$accountData.createdByData.lastName",
            },

            address: {
              unitNo: "$partyData.address.unitNo",
              marketName: {
                _id: { $arrayElemAt: ["$marketNameData._id", 0] },
                marketName: { $arrayElemAt: ["$marketNameData.marketName", 0] },
              },
              // landMark: {
              //   _id: { $arrayElemAt: ["$landMarkData._id", 0] },
              //   landmark: { $arrayElemAt: ["$landMarkData.landmark", 0] },
              // },
              area: {
                _id: { $arrayElemAt: ["$areaData._id", 0] },
                area: { $arrayElemAt: ["$areaData.area", 0] },
              },
              // pincode: {
              //   _id: { $arrayElemAt: ["$pincodeData._id", 0] },
              //   pincode: { $arrayElemAt: ["$pincodeData.pincode", 0] },
              // },
            },
          },

          assignedTo: {
            _id: "$assignedToData._id",
            firstName: "$assignedToData.firstName",
            lastName: "$assignedToData.lastName",
            // email: "$assignedToData.email",
          },

          originalLeadId: {
            _id: { $arrayElemAt: ["$originalLeadData._id", 0] },
            date: { $arrayElemAt: ["$originalLeadData.date", 0] },
            createdAt: { $arrayElemAt: ["$originalLeadData.createdAt", 0] },
          },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: leads,
      count: total,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching leads:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching leads",
      error: error.message,
    });
  }
};

// Helper function to parse date strings in various formats
function parseDateString(dateStr) {
  if (typeof dateStr === 'string') {
    if (dateStr.includes('/')) {
      // DD/MM/YYYY format
      const [day, month, year] = dateStr.split('/');
      return new Date(year, month - 1, day);
    } else if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      // Check if it's DD-MM-YYYY format
      if (parts.length === 3 && parts[0].length <= 2) {
        const [day, month, year] = parts;
        return new Date(year, month - 1, day);
      }
    }
  }
  return new Date(dateStr);
}
// In lead.controller.js
exports.bulkCreateLeads = async (req, res) => {
  try {
    const leadsData = req.body;

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

        // Validate required fields
        if (!companyName || !partyName || !reason || !assignedTo || !date) {
          errors.push({
            partyName,
            message: "Missing required fields",
            missingFields: { companyName, partyName, reason, assignedTo, date },
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
          continue;
        }

        if (!party) {
          errors.push({
            partyName,
            message: `Party not found for ID: ${partyName}`,
          });
          continue;
        }

        if (!staff) {
          errors.push({
            partyName,
            message: `Staff not found for ID: ${assignedTo}`,
          });
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
            continue;
          }

          let [year, month, day] = date.split("-");
          if (date.match(/^\d{2}-\d{2}-\d{4}$/)) {
            [day, month, year] = date.split("-");
          }
          normalizedDate = new Date(`${year}-${month}-${day}`);

          if (isNaN(normalizedDate.getTime())) {
            errors.push({ partyName, message: "Invalid date provided" });
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
      case "partyTag": {
        // 1. Get all party IDs from Lead
        const partyIds = await mongoose.model("Lead").distinct("partyName");

        // 2. Fetch parties with only partyTag
        const parties = await Party.find(
          { _id: { $in: partyIds } },
          { partyTag: 1, _id: 0 }
        ).lean();

        // 3. Get unique, non-empty tags
        uniqueValues = [...new Set(
          parties.map(p => p.partyTag).filter(Boolean)
        )];

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


exports.bulkDeleteLeads = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No task IDs provided for deletion",
      });
    }

    const result = await Lead.deleteMany({ _id: { $in: ids } });

    if (result.deletedCount > 0) {
      res.status(200).json({
        success: true,
        message: `${result.deletedCount} leads deleted successfully`,
        deletedCount: result.deletedCount,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "No leads found to delete",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};