const mongoose = require("mongoose");
const AccountMaster = require("../models/accountMaster.model");
const Lead = require("../models/lead.model");
const xlsx = require("xlsx");
const AssignTask = require("../models/assignTask.model");
const Order = require("../models/order.model");
const Staff = require("../models/staff.model");
const Party = require("../models/Party.model");
const CompanyName = require("../models/companyName.model");
const Market = require("../models/marketData.model");
const moment = require("moment");

// Create a new Account Master
exports.createAccountMaster = async (req, res) => {
  try {
    const partyRequiredFields = [
      "partyName",
      // "ownerName",
      // "ownerMobileNo",
      "ownerWhatsAppNo",
      // "contactPerson",
      // "personMobileNo",
      // "personWhatsAppNo",
      // "contactForPayment",
      // "contactMobileNo",
      // "contactWhatsAppNo",
      // "GSTNo",
      "address",
    ];

    for (const field of partyRequiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          message: `Missing required party field: ${field}`,
        });
      }
    }

    const requiredAddressFields = [
      "unitNo",
      "marketName",
      // "streetAddress",
      "area",
      "pincode",
    ];
    for (const field of requiredAddressFields) {
      if (!req.body.address[field]) {
        return res.status(400).json({
          success: false,
          message: `Missing required address field: ${field}`,
        });
      }
    }

    // const pincodeRegex = /^[0-9]{6}$/;
    // if (!pincodeRegex.test(req.body.address.pincode)) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Invalid pincode format. Must be 6 digits.",
    //   });
    // }

    if (
      !req.body.companyName ||
      !req.body.reasonToVisit ||
      !req.body.createdBy
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: companyName, reasonToVisit, or createdBy",
      });
    }
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (req.body.ownerEmail && !emailRegex.test(req.body.ownerEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid owner email format",
      });
    }
    if (
      req.body.contactPersonEmail &&
      !emailRegex.test(req.body.contactPersonEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact person email format",
      });
    }
    if (
      req.body.contactForPaymentEmail &&
      !emailRegex.test(req.body.contactForPaymentEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact for payment email format",
      });
    }

    if (
      !req.body.companyName ||
      !req.body.reasonToVisit ||
      !req.body.createdBy
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: companyName, reasonToVisit, or createdBy",
      });
    }

    const staff = await Staff.findById(req.body.createdBy);
    if (!staff) {
      return res.status(400).json({
        success: false,
        message: "Invalid createdBy ID. Staff member does not exist.",
      });
    }

    const company = await CompanyName.findById(req.body.companyName);
    if (!company) {
      return res.status(400).json({
        success: false,
        message: "Invalid companyName ID. Company does not exist.",
      });
    }

    const existingParty = await Party.findOne({
      $and: [
        { companyName: req.body.companyName },
        { partyName: req.body.partyName },
        { ownerWhatsAppNo: req.body.ownerWhatsAppNo },
      ],
    });

    if (existingParty) {
      return res.status(400).json({
        success: false,
        message:
          "A party with this company, name and mobile number already exists",
      });
    }

    // Create the Party with statusApproval based on isRequestMode
    const partyData = {
      companyName: req.body.companyName,
      partyName: req.body.partyName,
      ownerName: req.body.ownerName,
      ownerMobileNo: req.body.ownerMobileNo,
      ownerWhatsAppNo: req.body.ownerWhatsAppNo,
      ownerEmail: req.body.ownerEmail || null,
      contactPerson: req.body.contactPerson,
      personMobileNo: req.body.personMobileNo,
      contactPersonEmail: req.body.contactPersonEmail || null,
      personWhatsAppNo: req.body.personWhatsAppNo,
      contactForPayment: req.body.contactForPayment,
      contactMobileNo: req.body.contactMobileNo,
      contactWhatsAppNo: req.body.contactWhatsAppNo,
      contactForPaymentEmail: req.body.contactForPaymentEmail || null,
      GSTNo: req.body.GSTNo || null,
      partyTag: req.body.partyTag || "New",
      address: req.body.address,
      reference: req.body.reference,
      statusApproval: req.body.isRequestMode ? "Pending" : "Approved", // Set based on isRequestMode
      partyType: req.body.partyType
    };

    const newParty = await Party.create(partyData);

    const accountMasterData = {
      companyName: req.body.companyName,
      party: newParty._id,
      reasonToVisit: req.body.reasonToVisit,
      createdBy: req.body.createdBy,
    };

    const newAccountMaster = await AccountMaster.create(accountMasterData);

    const populatedAccountMaster = await AccountMaster.findById(
      newAccountMaster._id
    )
      .populate("companyName", "companyName avatar")
      .populate("party")
      .populate({
        path: "party",
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
      .populate("createdBy", "firstName lastName email");

    res.status(201).json({
      success: true,
      message: "Account master created successfully",
      data: populatedAccountMaster,
    });
  } catch (error) {
    console.error("Error creating account master:", error);
    // if (error.code === 11000) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Duplicate entry. Party name or GST number already exists.",
    //   });
    // }
    res.status(500).json({
      success: false,
      message: "Failed to create account master",
      error: error.message,
    });
  }
};

exports.getAllAccountMasters = async (req, res) => {
  try {
    const {
      filters = {},
      search = "",
      startDate,
      endDate,
      isPagination = false,
      page = 1,
      pageSize = 10,
      includeCounts = false
    } = req.body;

    // Pre-fetch staff IDs for assignedTo filter
    let assignedToIds = [];
    if (filters.assignedTo && filters.assignedTo.length > 0) {
      const assignedToStaff = await Staff.find({
        $or: [
          { firstName: { $in: filters.assignedTo } },
          { lastName: { $in: filters.assignedTo } },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ["$firstName", " ", "$lastName"] },
                regex: new RegExp(filters.assignedTo.join("|"), "i")
              }
            }
          }
        ]
      }).select('_id').lean();

      assignedToIds = assignedToStaff.map(s => s._id.toString());
    }

    // Base query object
    const query = {};

    // Search functionality - search across multiple fields
    if (search) {
      query.$or = [
        { "reasonToVisit": { $regex: search, $options: "i" } },
        { "party.partyName": { $regex: search, $options: "i" } },
        { "party.ownerName": { $regex: search, $options: "i" } },
        { "party.ownerMobileNo": { $regex: search, $options: "i" } },
        { "party.ownerWhatsAppNo": { $regex: search, $options: "i" } },
        { "party.contactPerson": { $regex: search, $options: "i" } },
        { "party.personMobileNo": { $regex: search, $options: "i" } },
        { "party.personWhatsAppNo": { $regex: search, $options: "i" } },
        { "party.contactForPayment": { $regex: search, $options: "i" } },
        { "party.contactMobileNo": { $regex: search, $options: "i" } },
        { "party.contactWhatsAppNo": { $regex: search, $options: "i" } },
        { "party.GSTNo": { $regex: search, $options: "i" } },
        { "party.address.unitNo": { $regex: search, $options: "i" } },
        { "party.address.marketName.marketName": { $regex: search, $options: "i" } },
        { "party.address.landMark.landmark": { $regex: search, $options: "i" } },
        { "party.address.area.area": { $regex: search, $options: "i" } },
        { "party.address.pincode.pincode": { $regex: search, $options: "i" } },
        { "createdBy.firstName": { $regex: search, $options: "i" } },
        { "createdBy.lastName": { $regex: search, $options: "i" } },
      ];
    }

    // createdBy filter
    let createdByIds = [];
    if (filters.createdBy && filters.createdBy.length > 0) {
      const finalCond = [];

      filters.createdBy.forEach(full => {
        const parts = full.trim().split(" ");

        if (parts.length === 1) {
          // Only first or only last name
          finalCond.push({ firstName: parts[0] });
          finalCond.push({ lastName: parts[0] });
        } else {
          // Full name case
          const first = parts[0];
          const last = parts.slice(1).join(" ");

          finalCond.push({
            firstName: first,
            lastName: last
          });
        }
      });

      const staffMatched = await Staff.find({ $or: finalCond }).select('_id').lean();
      createdByIds = staffMatched.map(s => s._id);

      if (staffMatched.length > 0) {
        query["createdBy._id"] = { $in: createdByIds };
      }
    }

    // reasonToVisit filter (direct match)
    if (filters.reason && filters.reason.length > 0) {
      query.reasonToVisit = { $in: filters.reason };
    }

    // Date range filter (direct match)
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

    let partyMatch = {};

    // Party name filter (populated from parties collection)
    if (filters.party && filters.party.length > 0) {
      partyMatch.partyName = { $in: filters.party };
    }

    // Contact person filter (direct match)
    if (filters.contactPerson && filters.contactPerson.length > 0) {
      partyMatch.contactPerson = { $in: filters.contactPerson };
    }

    // Party tag filter (direct match)
    if (filters.partyTag && filters.partyTag.length > 0) {
      partyMatch.partyTag = { $in: filters.partyTag };
    }

    // Mobile number filters (matching ownerMobileNo)
    if (filters.mobile && filters.mobile.length > 0) {
      partyMatch.ownerMobileNo = { $in: filters.mobile };
    }

    // Unit number filter (matching party.address.unitNo)
    if (filters.unitNo && filters.unitNo.length > 0) {
      partyMatch["address.unitNo"] = { $in: filters.unitNo };
    }

    // Market filter (populated from markets collection)
    if (filters.market && filters.market.length > 0) {
      // First get market IDs that match the market names
      const markets = await Market.find({
        marketName: { $in: filters.market }
      }).select('_id').lean();

      if (markets.length > 0) {
        partyMatch["address.marketName._id"] = { $in: markets.map(m => m._id) };
      }
    }

    // Area filter (populated from markets collection)
    if (filters.area && filters.area.length > 0) {
      // First get area IDs that match the area names
      const areas = await Market.find({
        area: { $in: filters.area }
      }).select('_id').lean();

      if (areas.length > 0) {
        partyMatch["address.area._id"] = { $in: areas.map(area => area._id) };
      }
    }

    // Status filter (direct match)
    if (filters.status && filters.status.length > 0) {
      partyMatch.statusApproval = { $in: filters.status };
    }

    // Create the aggregation pipeline
    let pipeline = [
      {
        $lookup: {
          from: "parties",
          localField: "party",
          foreignField: "_id",
          as: "party",
        },
      },
      {
        $unwind: {
          path: "$party",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: "staffs",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $unwind: {
          path: "$createdBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "companynames",
          localField: "companyName",
          foreignField: "_id",
          as: "companyName",
        },
      },
      {
        $unwind: {
          path: "$companyName",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "party.address.marketName",
          foreignField: "_id",
          as: "party.address.marketName",
        },
      },
      {
        $unwind: {
          path: "$party.address.marketName",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "party.address.landMark",
          foreignField: "_id",
          as: "party.address.landMark",
        },
      },
      {
        $unwind: {
          path: "$party.address.landMark",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "party.address.area",
          foreignField: "_id",
          as: "party.address.area",
        },
      },
      {
        $unwind: {
          path: "$party.address.area",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "party.address.pincode",
          foreignField: "_id",
          as: "party.address.pincode",
        },
      },
      {
        $unwind: {
          path: "$party.address.pincode",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Add lookup for latest task
      {
        $lookup: {
          from: "assigntasks",
          let: {
            partyId: "$party._id",
            companyId: "$companyName._id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$partyName", "$$partyId"] },
                    { $eq: ["$companyName", "$$companyId"] }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "latestTask"
        }
      },
      {
        $unwind: {
          path: "$latestTask",
          preserveNullAndEmptyArrays: true
        }
      },
      // Add lookup for assignedTo in latestTask
      {
        $lookup: {
          from: "staffs",
          localField: "latestTask.assignTo",
          foreignField: "_id",
          as: "latestTask.assignTo"
        }
      },
      {
        $unwind: {
          path: "$latestTask.assignTo",
          preserveNullAndEmptyArrays: true
        }
      }
    ];

    // Add match conditions for the main query and party filters
    const matchConditions = {};

    if (filters.company && filters.company.length > 0) {
      matchConditions["companyName.companyName"] = { $in: filters.company };
    }

    // Create a clean match conditions object without circular references
    const mainQueryConditions = { ...query };
    const partyConditions = {};

    // Add party match conditions
    if (Object.keys(partyMatch).length > 0) {
      Object.entries(partyMatch).forEach(([key, value]) => {
        if (key === "$or") {
          partyConditions.$or = value;
        } else {
          partyConditions[`party.${key}`] = value;
        }
      });
    }

    // Build the final match conditions without circular references
    if (Object.keys(mainQueryConditions).length > 0 && Object.keys(partyConditions).length > 0) {
      // Both main query and party conditions exist
      matchConditions.$and = [mainQueryConditions, partyConditions];
    } else if (Object.keys(mainQueryConditions).length > 0) {
      // Only main query conditions exist
      Object.assign(matchConditions, mainQueryConditions);
    } else if (Object.keys(partyConditions).length > 0) {
      // Only party conditions exist
      Object.assign(matchConditions, partyConditions);
    }

    // Add remarks filter
    if (filters.remarks && filters.remarks.length > 0) {
      matchConditions.$or = filters.remarks.map(remark => ({
        "latestTask.remarks": { $regex: remark, $options: "i" }
      }));
    }

    // Add assignedTo filter
    if (filters.assignedTo && filters.assignedTo.length > 0 && assignedToIds.length > 0) {
      matchConditions["latestTask.assignTo._id"] = { $in: assignedToIds.map(id => mongoose.Types.ObjectId(id)) };
    }

    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Add sorting
    pipeline.push({ $sort: { createdAt: -1 } });

    // Prepare facet stages for pagination and counting
    const facetStages = {
      data: [
        { $skip: isPagination ? (page - 1) * pageSize : 0 },
        { $limit: isPagination ? pageSize : 1000000 } // Large number if no pagination
      ],
      count: [
        { $count: "total" }
      ]
    };

    // Add counts facet if requested
    if (includeCounts) {
      facetStages.counts = [
        {
          $group: {
            _id: null,
            approved: {
              $sum: {
                $cond: [{ $eq: ["$party.statusApproval", "APPROVED"] }, 1, 0]
              }
            },
            pending: {
              $sum: {
                $cond: [{ $eq: ["$party.statusApproval", "PENDING"] }, 1, 0]
              }
            },
            total: { $sum: 1 }
          }
        }
      ];
    }

    // Add facet stage to pipeline
    pipeline.push({ $facet: facetStages });

    // Execute the aggregation
    const result = await AccountMaster.aggregate(pipeline);
    const facetResult = result[0];
    
    // Extract data and counts
    const enrichedAccountMasters = facetResult.data || [];
    const totalCount = facetResult.count[0]?.total || 0;
    
    // Format counts
    let counts = {
      approved: 0,
      pending: 0,
      total: totalCount,
    };

    if (includeCounts && facetResult.counts && facetResult.counts.length > 0) {
      counts = {
        approved: facetResult.counts[0].approved,
        pending: facetResult.counts[0].pending,
        total: facetResult.counts[0].total
      };
    }

    // Prepare pagination information
    const pagination = isPagination
      ? {
        currentPage: page,
        pageSize: pageSize,
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNext: page < Math.ceil(totalCount / pageSize),
        hasPrev: page > 1,
        counts: counts,
      }
      : null;

    res.status(200).json({
      success: true,
      data: enrichedAccountMasters,
      pagination: pagination,
      counts: counts,
    });
  } catch (error) {
    console.error("Error getting account masters:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch account masters",
      error: error.message,
    });
  }
};

const normalize = (val) => (val ? String(val).trim().toLowerCase() : null);

// Helper to find a Market by field
const findMarketByField = async (field, value, session) => {
  if (!value) return null;
  const normalized = normalize(value);

  const market = await Market.findOne({
    [field]: { $regex: new RegExp(`^${normalized}$`, "i") }, // exact match, case-insensitive
  }).session(session);

  return market ? market._id : null;
};

async function findStaffByFullName(fullName) {

  const [firstName, lastName] = fullName.trim().split(" ");

  const staff = await Staff.findOne({
    $expr: {
      $and: [
        {
          $eq: [
            { $toLower: { $trim: { input: "$firstName" } } },
            firstName.toLowerCase(),
          ],
        },
        {
          $eq: [
            { $toLower: { $trim: { input: "$lastName" } } },
            lastName.toLowerCase(),
          ],
        },
      ],
    },
  });

  return staff;
}

exports.bulkCreateAccountMasters = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.file) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const globalCompanyName = req.body.companyName;

    if (!globalCompanyName) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "companyName is required in the request body",
      });
    }

    // Read CSV
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    const accountMasters = [];
    const skippedRecords = [];

    for (const [index, row] of data.entries()) {
      try {
        // ✅ Find staff by full name
        const staff = await findStaffByFullName(row.createdBy);
        if (!staff) {
          skippedRecords.push({
            ...row,
            reason: `Staff not found for createdBy: ${row.createdBy}`,
          });
          continue;
        }

        // PartyTag logic
        let partyTag = "New";
        if (row.partyTag) {
          const partyTagValue = String(row.partyTag).trim().toLowerCase();
          if (partyTagValue === "customer") partyTag = "Customer";
        }

        // Market resolve
        const marketId = await findMarketByField(
          "marketName",
          row.marketName,
          session
        );

        const address = {
          unitNo: row.unitNo || null,
          marketName: marketId,
          // streetAddress: marketId,
          landMark: marketId,
          area: marketId,
          pincode: marketId,
        };

        // Party
        const partyData = {
          companyName: globalCompanyName,
          partyName: row.partyName || null,
          ownerName: row.ownerName || null,
          ownerMobileNo: row.ownerMobileNo || null,
          ownerWhatsAppNo: row.ownerWhatsAppNo
            ? String(row.ownerWhatsAppNo)
            : null,
          ownerEmail: row.ownerEmail || null,
          contactPerson: row.contactPerson || null,
          personMobileNo: row.personMobileNo || null,
          personWhatsAppNo: row.personWhatsAppNo || null,
          contactPersonEmail: row.contactPersonEmail || null,
          contactForPayment: row.contactForPayment || null,
          contactMobileNo: row.contactMobileNo || null,
          contactWhatsAppNo: row.contactWhatsAppNo || null,
          contactForPaymentEmail: row.contactForPaymentEmail || null,
          GSTNo: row.GSTNo || null,
          address,
          reference: row.reference || null,
          statusApproval: row.isRequestMode === "TRUE" ? "Pending" : "Approved",
          createdBy: staff._id,
          partyTag,
          partyType: row.partyType || "",
        };

        const newParty = await Party.create([partyData], { session });

        const accountMasterData = {
          companyName: globalCompanyName,
          party: newParty[0]._id,
          reasonToVisit: row.reasonToVisit || null,
          reference: row.reference || null,
          createdBy: staff._id,
          partyTag,
        };

        const newAccountMaster = await AccountMaster.create(
          [accountMasterData],
          { session }
        );
        accountMasters.push(newAccountMaster[0]);
      } catch (err) {
        skippedRecords.push({
          row: index + 1,
          reason: err.message,
        });
        continue;
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Bulk account masters processed",
      insertedCount: accountMasters.length,
      skippedCount: skippedRecords.length,
      skippedRecords, // optional: to debug which ones skipped
      data: accountMasters,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      success: false,
      message: "Failed to bulk create account masters",
      error: error.message,
    });
  }
};

exports.getAccountMasterById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid AccountMaster ID",
      });
    }

    const accountMaster = await AccountMaster.findById(id)
      .populate("companyName") // Include _id for company selection
      .populate("party")
      .populate({
        path: "party",
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
      .populate("createdBy", "_id firstName lastName email").lean(); // Include _id for createdBy selection

    if (!accountMaster) {
      return res.status(404).json({
        success: false,
        message: "AccountMaster not found",
      });
    }

    // Transform the data to match frontend structure
    const responseData = {
      ...accountMaster,
      companyName: accountMaster.companyName._id.toString(), // Just the ID for the company select
      partyName: accountMaster.party.partyName, // Direct party name for the party input
      partyId: accountMaster.party._id,
      ownerName: accountMaster.party.ownerName,
      ownerMobileNo: accountMaster.party.ownerMobileNo,
      ownerWhatsAppNo: accountMaster.party.ownerWhatsAppNo,
      ownerEmail: accountMaster.party.ownerEmail || "",
      contactPerson: accountMaster.party.contactPerson,
      personMobileNo: accountMaster.party.personMobileNo,
      personWhatsAppNo: accountMaster.party.personWhatsAppNo,
      contactPersonEmail: accountMaster.party.contactPersonEmail || "",
      contactForPayment: accountMaster.party.contactForPayment,
      contactMobileNo: accountMaster.party.contactMobileNo,
      contactWhatsAppNo: accountMaster.party.contactWhatsAppNo,
      contactForPaymentEmail: accountMaster.party.contactForPaymentEmail || "",
      GSTNo: accountMaster.party.GSTNo,
      partyTag: accountMaster.party.partyTag,
      partyType: accountMaster.party.partyType || "",
      address: {
        unitNo: accountMaster.party.address.unitNo,
        marketName: accountMaster.party.address.marketName,
        // streetAddress: accountMaster.party.address.streetAddress,
        landMark: accountMaster.party.address.landMark || "", // Handle optional field
        area: accountMaster.party.address.area,
        pincode: accountMaster.party.address.pincode,
      },
      reasonToVisit: accountMaster.reasonToVisit,
      reference: accountMaster.reference || "",
      createdBy: accountMaster.createdBy._id.toString(), // Just the ID for the staff select
      // Include additional fields that might be needed for display
      createdById: accountMaster.createdBy._id.toString(),
      companyNameObj: accountMaster.companyName, // Entire company object if needed
      createdByObj: accountMaster.createdBy, // Entire staff object if needed
    };

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching account master:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch account master",
      error: error.message,
    });
  }
};

exports.updateAccountMaster = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid AccountMaster ID",
      });
    }

    const accountMaster = await AccountMaster.findById(id);
    if (!accountMaster) {
      return res.status(404).json({
        success: false,
        message: "AccountMaster not found",
      });
    }

    if (!req.body.companyName || !req.body.reasonToVisit) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: companyName or reasonToVisit",
      });
    }

    const company = await CompanyName.findById(req.body.companyName);
    if (!company) {
      return res.status(400).json({
        success: false,
        message: "Invalid companyName ID. Company does not exist.",
      });
    }

    // Validate createdBy if provided
    if (req.body.createdBy) {
      if (!mongoose.Types.ObjectId.isValid(req.body.createdBy)) {
        return res.status(400).json({
          success: false,
          message: "Invalid createdBy ID",
        });
      }
      const staff = await Staff.findById(req.body.createdBy);
      if (!staff) {
        return res.status(400).json({
          success: false,
          message: "Invalid createdBy ID. Staff member does not exist.",
        });
      }
    }
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (req.body.ownerEmail && !emailRegex.test(req.body.ownerEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid owner email format",
      });
    }
    if (
      req.body.contactPersonEmail &&
      !emailRegex.test(req.body.contactPersonEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact person email format",
      });
    }
    if (
      req.body.contactForPaymentEmail &&
      !emailRegex.test(req.body.contactForPaymentEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact for payment email format",
      });
    }
    const partyId = accountMaster.party;

    const partyUpdateData = {
      partyName: req.body.partyName,
      ownerName: req.body.ownerName,
      ownerMobileNo: req.body.ownerMobileNo,
      ownerWhatsAppNo: req.body.ownerWhatsAppNo,
      ownerEmail: req.body.ownerEmail || null,
      contactPerson: req.body.contactPerson,
      personMobileNo: req.body.personMobileNo,
      personWhatsAppNo: req.body.personWhatsAppNo,
      contactPersonEmail: req.body.contactPersonEmail || null,
      contactForPayment: req.body.contactForPayment,
      contactMobileNo: req.body.contactMobileNo,
      contactWhatsAppNo: req.body.contactWhatsAppNo,
      contactForPaymentEmail: req.body.contactForPaymentEmail || null,
      GSTNo: req.body.GSTNo,
      address: req.body.address,
      partyType: req.body.partyType,
      reference: req.body.reference,
      // Preserve existing statusApproval unless explicitly updated
      statusApproval:
        req.body.statusApproval ||
        (await Party.findById(partyId)).statusApproval,
    };

    if (
      req.body.companyName ||
      req.body.partyName ||
      req.body.ownerWhatsAppNo
    ) {
      const existingParty = await Party.findOne({
        $and: [
          { _id: { $ne: partyId } }, // Exclude current party
          { companyName: req.body.companyName || accountMaster.companyName },
          { partyName: req.body.partyName || accountMaster.party.partyName },
          {
            ownerWhatsAppNo:
              req.body.ownerWhatsAppNo || accountMaster.party.ownerWhatsAppNo,
          },
        ],
      });

      if (existingParty) {
        return res.status(400).json({
          success: false,
          message:
            "A party with this company, name and mobile number already exists",
        });
      }
    }

    const updatedParty = await Party.findByIdAndUpdate(
      partyId,
      partyUpdateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedParty) {
      return res.status(404).json({
        success: false,
        message: "Associated Party not found",
      });
    }

    const accountMasterUpdateData = {
      companyName: req.body.companyName,
      reasonToVisit: req.body.reasonToVisit,
      reference: req.body.reference,
      ...(req.body.createdBy && { createdBy: req.body.createdBy }), // Conditionally include createdBy
    };


    const updatedAccountMaster = await AccountMaster.findByIdAndUpdate(
      id,
      accountMasterUpdateData,
      { new: true, runValidators: true }
    )
      .populate("companyName", "companyName avatar")
      .populate("party")
      .populate({
        path: "party",
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
      .populate("createdBy", "firstName lastName email");

    if (!updatedAccountMaster) {
      return res.status(404).json({
        success: false,
        message: "Failed to update AccountMaster",
      });
    }


    res.status(200).json({
      success: true,
      message: "Account master updated successfully",
      data: updatedAccountMaster,
    });
  } catch (error) {
    console.error("Error updating account master:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate entry. Party name or GST number already exists.",
      });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to update account master",
      error: error.message,
      stack: error.stack,
    });
  }
};

// Update Account Master Status
exports.updateAccountMasterStatus = async (req, res) => {
  try {
    // Validate status if provided
    if (!req.body.status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    // Update the AccountMaster document
    const updatedAccountMaster = await AccountMaster.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status }, // Only update status if it's part of the schema
      { new: true, runValidators: true }
    ).populate("createdBy", "firstName lastName email");

    if (!updatedAccountMaster) {
      return res.status(404).json({
        success: false,
        message: "Account master not found",
      });
    }

    // Find the latest assign task for this party
    const latestTask = await AssignTask.findOne({
      partyName: updatedAccountMaster.partyName,
    })
      .sort({ createdAt: -1 })
      .populate("assignTo", "firstName lastName email");

    // Prepare assignedTo, remarks, and status from the latest task
    let assignedTo = updatedAccountMaster.createdBy;
    let remarks = "NA";
    let status = req.body.status || "Not Started"; // Use the provided status

    if (latestTask) {
      assignedTo = latestTask.assignTo || updatedAccountMaster.createdBy;
      remarks = latestTask.remarks || "NA";
      status = latestTask.status || req.body.status || "Not Started";
    }

    // Format the response to match the schema and include task data
    const formattedData = {
      _id: updatedAccountMaster._id,
      companyName: updatedAccountMaster.companyName,
      partyName: updatedAccountMaster.partyName,
      ownerName: updatedAccountMaster.ownerName,
      ownerMobileNo: updatedAccountMaster.ownerMobileNo,
      ownerWhatsAppNo: updatedAccountMaster.ownerWhatsAppNo,
      contactPerson: updatedAccountMaster.contactPerson,
      personMobileNo: updatedAccountMaster.personMobileNo,
      personWhatsAppNo: updatedAccountMaster.personWhatsAppNo,
      contactForPayment: updatedAccountMaster.contactForPayment,
      contactMobileNo: updatedAccountMaster.contactMobileNo,
      contactWhatsAppNo: updatedAccountMaster.contactWhatsAppNo,
      GSTNo: updatedAccountMaster.GSTNo,
      address: {
        unitNo: updatedAccountMaster.address.unitNo,
        marketName: updatedAccountMaster.address.marketName,
        // streetAddress: updatedAccountMaster.address.streetAddress,
        landMark: updatedAccountMaster.address.landMark,
        area: updatedAccountMaster.address.area,
        pincode: updatedAccountMaster.address.pincode,
      },
      reasonToVisit: updatedAccountMaster.reasonToVisit,
      partyTag: updatedAccountMaster.partyTag,
      createdBy: updatedAccountMaster.createdBy
        ? `${updatedAccountMaster.createdBy.firstName} ${updatedAccountMaster.createdBy.lastName}`
        : "",
      createdById: updatedAccountMaster.createdBy
        ? updatedAccountMaster.createdBy._id
        : null,
      assignedTo: assignedTo
        ? {
          _id: assignedTo._id,
          name: `${assignedTo.firstName} ${assignedTo.lastName}`,
          email: assignedTo.email,
        }
        : null,
      remarks,
      status,
      createdAt: updatedAccountMaster.createdAt,
      updatedAt: updatedAccountMaster.updatedAt,
    };

    res.status(200).json({
      success: true,
      message: "Account master status updated successfully",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error updating account master status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update account master status",
      error: error.message,
    });
  }
};

exports.deleteAccountMaster = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const accountMasterId = req.params.id;

    // 1. Find the AccountMaster with party details
    const accountMaster = await AccountMaster.findById(accountMasterId)
      .populate("party")
      .session(session);

    if (!accountMaster) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Account master not found",
      });
    }

    // Store party ID for deletion
    const partyId = accountMaster.party._id;

    // 2. Delete the AccountMaster
    await AccountMaster.findByIdAndDelete(accountMasterId).session(session);

    // 3. Delete the associated Party
    await Party.findByIdAndDelete(partyId).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Account master and associated party deleted successfully",
      deletedCounts: {
        accountMaster: 1,
        party: 1,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error in deleteAccountMaster:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete account master and party",
      error: error.message,
    });
  }
};

// Get all Staff for createdBy dropdown
exports.getAllStaff = async (req, res) => {
  try {
    const staff = await Staff.find({}, "firstName lastName _id");
    const formattedStaff = staff.map((s) => ({
      id: s._id,
      name: `${s.firstName} ${s.lastName}`,
    }));

    res.status(200).json({
      success: true,
      data: formattedStaff,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAccountMasterByCompanyAndParty = async (req, res) => {
  try {
    const { companyId, partyId } = req.body;
    // Validate both IDs
    if (
      !mongoose.Types.ObjectId.isValid(companyId) ||
      !mongoose.Types.ObjectId.isValid(partyId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format(s)",
      });
    }

    // Find account master where both company and party match
    const accountMaster = await AccountMaster.findOne({
      companyName: companyId,
      party: partyId,
    })
      .populate({
        path: "companyName",
        select: "-__v", // All company fields except version
      })
      .populate({
        path: "party",
        select: "-__v",
        populate: [
          { path: "address.marketName", model: "Market", select: "marketName" },
          { path: "address.landMark", model: "Market", select: "landmark" },
          { path: "address.area", model: "Market", select: "area" },
          { path: "address.pincode", model: "Market", select: "pincode" },
        ],
      })
      .populate({
        path: "createdBy",
        select: "-__v -password", // All staff fields except version and password
      });

    if (!accountMaster) {
      return res.status(404).json({
        success: false,
        message: "No account found matching these company and party IDs",
      });
    }

    // Return complete populated data
    res.status(200).json({
      success: true,
      data: {
        accountMaster: {
          _id: accountMaster._id,
          reasonToVisit: accountMaster.reasonToVisit,
          createdAt: accountMaster.createdAt,
          updatedAt: accountMaster.updatedAt,
          company: accountMaster.companyName.toObject(),
          party: accountMaster.party.toObject(),
          createdBy: accountMaster.createdBy.toObject(),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching account:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch account data",
      error: error.message,
    });
  }
};

// controllers/accountMasterController.js
exports.approveParty = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Party ID",
      });
    }

    const party = await Party.findById(id);
    if (!party) {
      return res.status(404).json({
        success: false,
        message: "Party not found",
      });
    }

    if (party.statusApproval === "Approved") {
      return res.status(400).json({
        success: false,
        message: "Party is already approved",
      });
    }

    party.statusApproval = "Approved";
    await party.save();

    const accountMaster = await AccountMaster.findOne({ party: id })
      .populate("companyName", "companyName avatar")
      .populate("party")
      .populate("createdBy", "firstName lastName email");

    res.status(200).json({
      success: true,
      message: "Party approved successfully",
      data: accountMaster,
    });
  } catch (error) {
    console.error("Error approving party:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve party",
      error: error.message,
    });
  }
};

exports.getAccountMasterByStaffId = async (req, res) => {
  try {
    const {
      filters = {},
      search = "",
      startDate,
      endDate,
      isPagination = false,
      page = 1,
      pageSize = 10,
      includeCounts = false
    } = req.body;

    // Pre-fetch staff IDs for assignedTo filter
    let assignedToIds = [];
    if (filters.assignedTo && filters.assignedTo.length > 0) {
      const assignedToStaff = await Staff.find({
        $or: [
          { firstName: { $in: filters.assignedTo } },
          { lastName: { $in: filters.assignedTo } },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ["$firstName", " ", "$lastName"] },
                regex: new RegExp(filters.assignedTo.join("|"), "i")
              }
            }
          }
        ]
      }).select('_id').lean();

      assignedToIds = assignedToStaff.map(s => s._id.toString());
    }

    // Base query object
    const query = {};

    // Search functionality - search across multiple fields
    if (search) {
      query.$or = [
        { "reasonToVisit": { $regex: search, $options: "i" } },
        { "party.partyName": { $regex: search, $options: "i" } },
        { "party.ownerName": { $regex: search, $options: "i" } },
        { "party.ownerMobileNo": { $regex: search, $options: "i" } },
        { "party.ownerWhatsAppNo": { $regex: search, $options: "i" } },
        { "party.contactPerson": { $regex: search, $options: "i" } },
        { "party.personMobileNo": { $regex: search, $options: "i" } },
        { "party.personWhatsAppNo": { $regex: search, $options: "i" } },
        { "party.contactForPayment": { $regex: search, $options: "i" } },
        { "party.contactMobileNo": { $regex: search, $options: "i" } },
        { "party.contactWhatsAppNo": { $regex: search, $options: "i" } },
        { "party.GSTNo": { $regex: search, $options: "i" } },
        { "party.address.unitNo": { $regex: search, $options: "i" } },
        { "party.address.marketName.marketName": { $regex: search, $options: "i" } },
        { "party.address.landMark.landmark": { $regex: search, $options: "i" } },
        { "party.address.area.area": { $regex: search, $options: "i" } },
        { "party.address.pincode.pincode": { $regex: search, $options: "i" } },
      ];
    }

    // createdBy filter
    let createdByIds = [];
    if (filters.createdBy && filters.createdBy.length > 0) {
      const finalCond = [];

      filters.createdBy.forEach(full => {
        const parts = full.trim().split(" ");

        if (parts.length === 1) {
          // Only first or only last name
          finalCond.push({ firstName: parts[0] });
          finalCond.push({ lastName: parts[0] });
        } else {
          // Full name case
          const first = parts[0];
          const last = parts.slice(1).join(" ");

          finalCond.push({
            firstName: first,
            lastName: last
          });
        }
      });

      const staffMatched = await Staff.find({ $or: finalCond }).select('_id').lean();
      createdByIds = staffMatched.map(s => s._id);

      if (staffMatched.length > 0) {
        query["createdBy._id"] = { $in: createdByIds };
      }
    }

    // reasonToVisit filter (direct match)
    if (filters.reason && filters.reason.length > 0) {
      query.reasonToVisit = { $in: filters.reason };
    }

    // Date range filter (direct match)
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

    let partyMatch = {};

    // Party name filter (populated from parties collection)
    if (filters.party && filters.party.length > 0) {
      partyMatch.partyName = { $in: filters.party };
    }

    // Contact person filter (direct match)
    if (filters.contactPerson && filters.contactPerson.length > 0) {
      partyMatch.contactPerson = { $in: filters.contactPerson };
    }

    // Party tag filter (direct match)
    if (filters.partyTag && filters.partyTag.length > 0) {
      partyMatch.partyTag = { $in: filters.partyTag };
    }

    // Mobile number filters (matching ownerMobileNo)
    if (filters.mobile && filters.mobile.length > 0) {
      partyMatch.ownerMobileNo = { $in: filters.mobile };
    }

    // Unit number filter (matching party.address.unitNo)
    if (filters.unitNo && filters.unitNo.length > 0) {
      partyMatch["address.unitNo"] = { $in: filters.unitNo };
    }

    // Market filter (populated from markets collection)
    if (filters.market && filters.market.length > 0) {
      // First get market IDs that match the market names
      const markets = await Market.find({
        marketName: { $in: filters.market }
      }).select('_id').lean();

      if (markets.length > 0) {
        partyMatch["address.marketName._id"] = { $in: markets.map(m => m._id) };
      }
    }

    // Area filter (populated from markets collection)
    if (filters.area && filters.area.length > 0) {
      // First get area IDs that match the area names
      const areas = await Market.find({
        area: { $in: filters.area }
      }).select('_id').lean();

      if (areas.length > 0) {
        partyMatch["address.area._id"] = { $in: areas.map(area => area._id) };
      }
    }

    // Status filter (direct match)
    if (filters.status && filters.status.length > 0) {
      partyMatch.statusApproval = { $in: filters.status };
    }

    // Create the aggregation pipeline
    let pipeline = [
      {
        $lookup: {
          from: "parties",
          localField: "party",
          foreignField: "_id",
          as: "party",
        },
      },
      {
        $unwind: {
          path: "$party",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: "staffs",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $unwind: {
          path: "$createdBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "companynames",
          localField: "companyName",
          foreignField: "_id",
          as: "companyName",
        },
      },
      {
        $unwind: {
          path: "$companyName",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "party.address.marketName",
          foreignField: "_id",
          as: "party.address.marketName",
        },
      },
      {
        $unwind: {
          path: "$party.address.marketName",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "party.address.landMark",
          foreignField: "_id",
          as: "party.address.landMark",
        },
      },
      {
        $unwind: {
          path: "$party.address.landMark",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "party.address.area",
          foreignField: "_id",
          as: "party.address.area",
        },
      },
      {
        $unwind: {
          path: "$party.address.area",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "markets",
          localField: "party.address.pincode",
          foreignField: "_id",
          as: "party.address.pincode",
        },
      },
      {
        $unwind: {
          path: "$party.address.pincode",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Add lookup for latest task
      {
        $lookup: {
          from: "assigntasks",
          let: {
            partyId: "$party._id",
            companyId: "$companyName._id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$partyName", "$$partyId"] },
                    { $eq: ["$companyName", "$$companyId"] }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "latestTask"
        }
      },
      {
        $unwind: {
          path: "$latestTask",
          preserveNullAndEmptyArrays: true
        }
      },
      // Add lookup for assignedTo in latestTask
      {
        $lookup: {
          from: "staffs",
          localField: "latestTask.assignTo",
          foreignField: "_id",
          as: "latestTask.assignTo"
        }
      },
      {
        $unwind: {
          path: "$latestTask.assignTo",
          preserveNullAndEmptyArrays: true
        }
      }
    ];

    // Add match conditions for the main query and party filters
    const matchConditions = {};

    if (filters.company && filters.company.length > 0) {
      matchConditions["companyName.companyName"] = { $in: filters.company };
    }

    // Create a clean match conditions object without circular references
    const mainQueryConditions = { ...query };
    const partyConditions = {};

    // Add party match conditions
    if (Object.keys(partyMatch).length > 0) {
      Object.entries(partyMatch).forEach(([key, value]) => {
        if (key === "$or") {
          partyConditions.$or = value;
        } else {
          partyConditions[`party.${key}`] = value;
        }
      });
    }

    // Build the final match conditions without circular references
    if (Object.keys(mainQueryConditions).length > 0 && Object.keys(partyConditions).length > 0) {
      // Both main query and party conditions exist
      matchConditions.$and = [mainQueryConditions, partyConditions];
    } else if (Object.keys(mainQueryConditions).length > 0) {
      // Only main query conditions exist
      Object.assign(matchConditions, mainQueryConditions);
    } else if (Object.keys(partyConditions).length > 0) {
      // Only party conditions exist
      Object.assign(matchConditions, partyConditions);
    }

    // Add remarks filter
    if (filters.remarks && filters.remarks.length > 0) {
      matchConditions.$or = filters.remarks.map(remark => ({
        "latestTask.remarks": { $regex: remark, $options: "i" }
      }));
    }

    // Add assignedTo filter
    if (filters.assignedTo && filters.assignedTo.length > 0 && assignedToIds.length > 0) {
      matchConditions["latestTask.assignTo._id"] = { $in: assignedToIds.map(id => mongoose.Types.ObjectId(id)) };
    }

    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Add sorting
    pipeline.push({ $sort: { createdAt: -1 } });

    // Prepare facet stages for pagination and counting
    const facetStages = {
      data: [
        { $skip: isPagination ? (page - 1) * pageSize : 0 },
        { $limit: isPagination ? pageSize : 1000000 } // Large number if no pagination
      ],
      count: [
        { $count: "total" }
      ]
    };

    // Add counts facet if requested
    if (includeCounts) {
      facetStages.counts = [
        {
          $group: {
            _id: null,
            approved: {
              $sum: {
                $cond: [{ $eq: ["$party.statusApproval", "APPROVED"] }, 1, 0]
              }
            },
            pending: {
              $sum: {
                $cond: [{ $eq: ["$party.statusApproval", "PENDING"] }, 1, 0]
              }
            },
            total: { $sum: 1 }
          }
        }
      ];
    }

    // Add facet stage to pipeline
    pipeline.push({ $facet: facetStages });

    // Execute the aggregation
    const result = await AccountMaster.aggregate(pipeline);
    const facetResult = result[0];
    
    // Extract data and counts
    const enrichedAccountMasters = facetResult.data || [];
    const totalCount = facetResult.count[0]?.total || 0;
    
    // Format counts
    let counts = {
      approved: 0,
      pending: 0,
      total: totalCount,
    };

    if (includeCounts && facetResult.counts && facetResult.counts.length > 0) {
      counts = {
        approved: facetResult.counts[0].approved,
        pending: facetResult.counts[0].pending,
        total: facetResult.counts[0].total
      };
    }

    // Prepare pagination information
    const pagination = isPagination
      ? {
        currentPage: page,
        pageSize: pageSize,
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNext: page < Math.ceil(totalCount / pageSize),
        hasPrev: page > 1,
        counts: counts,
      }
      : null;

    res.status(200).json({
      success: true,
      data: enrichedAccountMasters,
      pagination: pagination,
      counts: counts,
    });
  } catch (error) {
    console.error("Error getting account masters:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch account masters",
      error: error.message,
    });
  }
};


exports.searchParties = async (req, res) => {
  try {
    const { q, companyId } = req.query;

    // First find account masters for the company
    const accountMatchQuery = {};
    if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
      accountMatchQuery.companyName = companyId;
    }

    const accountMasters = await AccountMaster.find(accountMatchQuery)
      .select('party')
      .populate({
        path: 'party',
        match: q ? { partyName: { $regex: q, $options: "i" } } : {},
        select: 'partyName address'
      });

    // Filter out accounts where party is null (due to population match)
    const validParties = accountMasters
      .filter(acc => acc.party !== null)
      .map(acc => acc.party);

    // Now populate the market details for these parties
    const partiesWithMarket = await Party.find({
      _id: { $in: validParties.map(p => p._id) }
    })
      .populate('address.marketName')
      .limit(20)
      .sort({ partyName: 1 });

    res.status(200).json({
      success: true,
      data: partiesWithMarket,
    });
  } catch (error) {
    console.error("Error searching parties:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search parties",
      error: error.message,
    });
  }
};

exports.getQualityPackingParties = async (req, res) => {
  try {
    // Find the CompanyName document for "Quality Packaging"
    const searchName = "Quality Packaging";

    const company = await CompanyName.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              { $toLower: { $trim: { input: "$companyName" } } },
              searchName.trim().toLowerCase()
            ]
          }
        }
      }
    ]);


    if (!company) {
      return res.status(404).json({ message: "Company 'Quality Packaging' not found" });
    }

    // Find all parties associated with the company and populate only partyName
    const parties = await Party.find({ companyName: company[0]._id })

      .select("partyName") // Select only the partyName field
      .lean(); // Use lean for better performance since we don't need Mongoose documents


    return res.status(200).json({
      message: "Parties retrieved successfully",
      data: parties,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.getFilterOptionsData = async (req, res) => {
  try {
    const { field } = req.params;
    const filters = req.body || {};
    const { search, ...otherFilters } = filters;

    if (!field) {
      return res.status(400).json({ success: false, message: "Field parameter is required" });
    }

    // -----------------------
    // BUILD MAIN FILTER QUERY
    // -----------------------
    const query = {};

    if (otherFilters.companyName) {
      query.companyName = otherFilters.companyName;
    }

    if (otherFilters.staffId) {
      query.createdBy = otherFilters.staffId;
    }

    // DATE RANGE
    if (otherFilters.startDate || otherFilters.endDate) {
      query.createdAt = {};
      if (otherFilters.startDate) {
        const start = new Date(otherFilters.startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (otherFilters.endDate) {
        const end = new Date(otherFilters.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    let uniqueValues = [];

    // ===========================================
    //          FIELD WISE CLEAN SOLUTIONS
    // ===========================================

    switch (field) {

      case "company":
        const companyIds = await AccountMaster.distinct("companyName", query);

        const companies = await CompanyName.find(
          { _id: { $in: companyIds } },
          "companyName"
        );

        uniqueValues = companies.map(c => c.companyName);
        break;


      case "party":
        const partyIds = await AccountMaster.distinct("party", query);
        const parties = await Party.find({ _id: { $in: partyIds } }, "partyName");
        uniqueValues = parties.map(p => p.partyName);
        break;

      case "contactPerson":
        const partyIds1 = await AccountMaster.distinct("party", query);
        const persons = await Party.find({ _id: { $in: partyIds1 } }, "contactPerson");
        uniqueValues = persons.map(p => p.contactPerson);
        break;

      case "createdAt":
        const dates = await AccountMaster.distinct("createdAt", query);

        uniqueValues = dates
          .sort((a, b) => new Date(b) - new Date(a))
          .map(d => moment(d).format("DD-MM-YYYY HH:mm:ss"));

        break;

      case "mobile":
        const partyIds8 = await AccountMaster.distinct("party", query);

        const partyMobiles = await Party.find(
          { _id: { $in: partyIds8 } },
          "ownerMobileNo"
        );

        uniqueValues = partyMobiles
          .map(p => p.ownerMobileNo)
          .filter(Boolean);
        break;



      case "partyTag":
        const partyIds2 = await AccountMaster.distinct("party", query);
        const tags = await Party.find({ _id: { $in: partyIds2 } }, "partyTag");
        uniqueValues = tags.map(p => p.partyTag);
        break;

      case "unitNo":
        const partyIds3 = await AccountMaster.distinct("party", query);
        console.log(partyIds3, 'partyIds3');

        const partiess = await Party.find(
          { _id: { $in: partyIds3 } },
          "address.unitNo"   // <-- Only this nested field
        );

        console.log(partiess, 'parties');

        uniqueValues = partiess.map(p => p.address?.unitNo).filter(v => v);
        break;

      case "mobileNo":
        const partyIds4 = await AccountMaster.distinct("party", query);
        const numbers = await Party.find(
          { _id: { $in: partyIds4 } },
          "ownerMobileNo ownerWhatsAppNo personMobileNo personWhatsAppNo contactMobileNo contactWhatsAppNo"
        );

        uniqueValues = [
          ...new Set(
            numbers.flatMap(n => [
              n.ownerMobileNo,
              n.ownerWhatsAppNo,
              n.personMobileNo,
              n.personWhatsAppNo,
              n.contactMobileNo,
              n.contactWhatsAppNo,
            ]).filter(Boolean)
          )
        ];
        break;

      case "market":
        const partyIds5 = await AccountMaster.distinct("party", query);
        const markets = await Party.find({ _id: { $in: partyIds5 } })
          .populate("address.marketName", "marketName");

        uniqueValues = [
          ...new Set(
            markets.map(m => m.address?.marketName?.marketName).filter(Boolean)
          )
        ];
        break;

      case "area":
        const partyIds6 = await AccountMaster.distinct("party", query);
        const areas = await Party.find({ _id: { $in: partyIds6 } })
          .populate("address.area", "area");

        uniqueValues = [
          ...new Set(
            areas.map(a => a.address?.area?.area).filter(Boolean)
          )
        ];
        break;

      case "reason":
        uniqueValues = await AccountMaster.distinct("reasonToVisit", query);
        break;

      case "createdBy":
        const createdByIds = await AccountMaster.distinct("createdBy", query);

        const staffUsers = await Staff.find(
          { _id: { $in: createdByIds } },
          "firstName lastName"
        );

        uniqueValues = staffUsers.map(u => `${u.firstName} ${u.lastName}`);
        break;

      case "status":
        const partyIds7 = await AccountMaster.distinct("party", query);
        const statuses = await Party.find(
          { _id: { $in: partyIds7 } },
          "statusApproval"
        );

        uniqueValues = statuses.map(s => s.statusApproval);
        break;

      case "assignedTo":
        const tasks = await AssignTask.distinct("assignTo", {
          assignTo: { $exists: true, $ne: null }
        });

        const users = await Staff.find({ _id: { $in: tasks } }, "firstName lastName");

        uniqueValues = users.map(u => `${u.firstName} ${u.lastName}`);
        break;

      default:
        return res.status(400).json({ success: false, message: "Invalid field parameter" });
    }

    // SEARCH FILTER
    if (search) {
      const searchText = search.toLowerCase();
      uniqueValues = uniqueValues.filter(v =>
        v?.toString().toLowerCase().includes(searchText)
      );
    }

    // REMOVE DUPLICATES + SORT
    uniqueValues = [...new Set(uniqueValues)].filter(Boolean).sort();

    // LIMIT FOR SAFETY
    uniqueValues = uniqueValues.slice(0, 100);

    res.status(200).json({
      success: true,
      data: uniqueValues,
      count: uniqueValues.length
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error loading filter options",
      error: err.message
    });
  }
};
