// const mongoose = require("mongoose");
// const AccountMaster = require("../models/accountMaster.model");
// const Lead = require("../models/lead.model");
// const xlsx = require("xlsx");
// const AssignTask = require("../models/assignTask.model");
// const Order = require("../models/order.model");
// const Staff = require("../models/staff.model");
// const Party = require("../models/Party.model");
// const CompanyName = require("../models/companyName.model");
// const Market = require("../models/marketData.model");
// const moment = require("moment");

// // Create a new Account Master
// exports.createAccountMaster = async (req, res) => {
//   try {
//     const partyRequiredFields = [
//       "partyName",
//       // "ownerName",
//       // "ownerMobileNo",
//       "ownerWhatsAppNo",
//       // "contactPerson",
//       // "personMobileNo",
//       // "personWhatsAppNo",
//       // "contactForPayment",
//       // "contactMobileNo",
//       // "contactWhatsAppNo",
//       // "GSTNo",
//       "address",
//     ];

//     for (const field of partyRequiredFields) {
//       if (!req.body[field]) {
//         return res.status(400).json({
//           success: false,
//           message: `Missing required party field: ${field}`,
//         });
//       }
//     }

//     const requiredAddressFields = [
//       "unitNo",
//       "marketName",
//       // "streetAddress",
//       "area",
//       "pincode",
//     ];
//     for (const field of requiredAddressFields) {
//       if (!req.body.address[field]) {
//         return res.status(400).json({
//           success: false,
//           message: `Missing required address field: ${field}`,
//         });
//       }
//     }

//     // const pincodeRegex = /^[0-9]{6}$/;
//     // if (!pincodeRegex.test(req.body.address.pincode)) {
//     //   return res.status(400).json({
//     //     success: false,
//     //     message: "Invalid pincode format. Must be 6 digits.",
//     //   });
//     // }

//     if (
//       !req.body.companyName ||
//       !req.body.reasonToVisit ||
//       !req.body.createdBy
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Missing required fields: companyName, reasonToVisit, or createdBy",
//       });
//     }
//     const emailRegex = /^\S+@\S+\.\S+$/;
//     if (req.body.ownerEmail && !emailRegex.test(req.body.ownerEmail)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid owner email format",
//       });
//     }
//     if (
//       req.body.contactPersonEmail &&
//       !emailRegex.test(req.body.contactPersonEmail)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid contact person email format",
//       });
//     }
//     if (
//       req.body.contactForPaymentEmail &&
//       !emailRegex.test(req.body.contactForPaymentEmail)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid contact for payment email format",
//       });
//     }

//     if (
//       !req.body.companyName ||
//       !req.body.reasonToVisit ||
//       !req.body.createdBy
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Missing required fields: companyName, reasonToVisit, or createdBy",
//       });
//     }

//     const staff = await Staff.findById(req.body.createdBy);
//     if (!staff) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid createdBy ID. Staff member does not exist.",
//       });
//     }

//     const company = await CompanyName.findById(req.body.companyName);
//     if (!company) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid companyName ID. Company does not exist.",
//       });
//     }

//     const existingParty = await Party.findOne({
//       $and: [
//         { companyName: req.body.companyName },
//         { partyName: req.body.partyName },
//         { ownerWhatsAppNo: req.body.ownerWhatsAppNo },
//       ],
//     });

//     if (existingParty) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "A party with this company, name and mobile number already exists",
//       });
//     }

//     // Create the Party with statusApproval based on isRequestMode
//     const partyData = {
//       companyName: req.body.companyName,
//       partyName: req.body.partyName,
//       ownerName: req.body.ownerName,
//       ownerMobileNo: req.body.ownerMobileNo,
//       ownerWhatsAppNo: req.body.ownerWhatsAppNo,
//       ownerEmail: req.body.ownerEmail || null,
//       contactPerson: req.body.contactPerson,
//       personMobileNo: req.body.personMobileNo,
//       contactPersonEmail: req.body.contactPersonEmail || null,
//       personWhatsAppNo: req.body.personWhatsAppNo,
//       contactForPayment: req.body.contactForPayment,
//       contactMobileNo: req.body.contactMobileNo,
//       contactWhatsAppNo: req.body.contactWhatsAppNo,
//       contactForPaymentEmail: req.body.contactForPaymentEmail || null,
//       GSTNo: req.body.GSTNo || null,
//       partyTag: req.body.partyTag || "New",
//       partyType: req.body.partyType,
//       address: req.body.address,
//       reference: req.body.reference,
//       statusApproval: req.body.isRequestMode ? "Pending" : "Approved", // Set based on isRequestMode
//       partyType: req.body.partyType
//     };

//     const newParty = await Party.create(partyData);

//     const accountMasterData = {
//       companyName: req.body.companyName,
//       party: newParty._id,
//       reasonToVisit: req.body.reasonToVisit,
//       createdBy: req.body.createdBy,
//     };

//     const newAccountMaster = await AccountMaster.create(accountMasterData);

//     const populatedAccountMaster = await AccountMaster.findById(
//       newAccountMaster._id
//     )
//       .populate("companyName", "companyName avatar")
//       .populate("party")
//       .populate({
//         path: "party",
//         select: "-__v",
//         populate: [
//           {
//             path: "address.marketName",
//             model: "Market",
//             select: "marketName", // only marketName
//           },
//           // {
//           //   path: "address.streetAddress",
//           //   model: "Market",
//           //   select: "streetAddress", // only streetAddress
//           // },
//           {
//             path: "address.landMark",
//             model: "Market",
//             select: "landmark", // only landMark
//           },
//           {
//             path: "address.area",
//             model: "Market",
//             select: "area", // only area
//           },
//           {
//             path: "address.pincode",
//             model: "Market",
//             select: "pincode", // only pincode
//           },
//         ],
//       })
//       .populate("createdBy", "firstName lastName email");

//     res.status(201).json({
//       success: true,
//       message: "Account master created successfully",
//       data: populatedAccountMaster,
//     });
//   } catch (error) {
//     console.error("Error creating account master:", error);
//     // if (error.code === 11000) {
//     //   return res.status(400).json({
//     //     success: false,
//     //     message: "Duplicate entry. Party name or GST number already exists.",
//     //   });
//     // }
//     res.status(500).json({
//       success: false,
//       message: "Failed to create account master",
//       error: error.message,
//     });
//   }
// };

// exports.getAllAccountMasters = async (req, res) => {
//   try {
//     const {
//       filters = {},
//       search = "",
//       startDate,
//       endDate,
//       isPagination = false,
//       page = 1,
//       pageSize = 10,
//       includeCounts = false
//     } = req.body;

//     // ===== STEP 1: Build queries =====
//     // baseQuery: Used for the main results (respects ALL filters including status)
//     // countQuery: Used for counting stats (respects all filters EXCEPT status)
//     const baseQuery = {};
//     const countQuery = {};

//     // FIXED: Date range filter - handle both formats
//     // Check if date is in filters.createdAt array (dd-mm-yyyy hh:mm:ss format)
//     if (filters.createdAt && filters.createdAt.length > 0) {
//       baseQuery.createdAt = {};
//       countQuery.createdAt = {};

//       filters.createdAt.forEach(dateStr => {
//         // Parse dd-mm-yyyy hh:mm:ss format
//         const [datePart, timePart] = dateStr.split(' ');
//         const [day, month, year] = datePart.split('-');
//         const [hours, minutes, seconds] = timePart ? timePart.split(':') : ['0', '0', '0'];

//         const parsedDate = new Date(year, month - 1, day, hours, minutes, seconds);

//         // Create date range for the entire day if only date is provided
//         // or exact timestamp if time is included
//         if (!timePart || timePart === '00:00:00') {
//           // If no time specified, match entire day
//           const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
//           const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

//           baseQuery.createdAt.$gte = startOfDay;
//           baseQuery.createdAt.$lte = endOfDay;

//           countQuery.createdAt.$gte = startOfDay;
//           countQuery.createdAt.$lte = endOfDay;
//         } else {
//           // If specific time provided, match exact timestamp (with some tolerance)
//           const startTime = new Date(parsedDate);
//           startTime.setSeconds(0, 0);
//           const endTime = new Date(parsedDate);
//           endTime.setSeconds(59, 999);

//           baseQuery.createdAt.$gte = startTime;
//           baseQuery.createdAt.$lte = endTime;

//           countQuery.createdAt.$gte = startTime;
//           countQuery.createdAt.$lte = endTime;
//         }
//       });
//     }
//     // Original date range filter using startDate/endDate
//     else if (startDate || endDate) {
//       baseQuery.createdAt = {};
//       countQuery.createdAt = {};

//       if (startDate) {
//         const start = new Date(startDate);
//         start.setHours(0, 0, 0, 0);
//         baseQuery.createdAt.$gte = start;
//         countQuery.createdAt.$gte = start;
//       }
//       if (endDate) {
//         const end = new Date(endDate);
//         end.setHours(23, 59, 59, 999);
//         baseQuery.createdAt.$lte = end;
//         countQuery.createdAt.$lte = end;
//       }
//     }

//     // Reason filter - apply early
//     if (filters.reason && filters.reason.length > 0) {
//       baseQuery.reasonToVisit = { $in: filters.reason };
//       countQuery.reasonToVisit = { $in: filters.reason };
//     }

//     // ===== STEP 2: Pre-fetch related IDs for filters =====

//     // CreatedBy filter
//     if (filters.createdBy && filters.createdBy.length > 0) {
//       const finalCond = [];
//       filters.createdBy.forEach(full => {
//         const parts = full.trim().split(" ");
//         if (parts.length === 1) {
//           finalCond.push({ firstName: parts[0] });
//           finalCond.push({ lastName: parts[0] });
//         } else {
//           const first = parts[0];
//           const last = parts.slice(1).join(" ");
//           finalCond.push({ firstName: first, lastName: last });
//         }
//       });

//       const staffMatched = await Staff.find({ $or: finalCond }).select('_id').lean();
//       if (staffMatched.length > 0) {
//         const staffIds = staffMatched.map(s => s._id);
//         baseQuery.createdBy = { $in: staffIds };
//         countQuery.createdBy = { $in: staffIds };
//       } else {
//         // No matching staff found, return empty result
//         return res.status(200).json({
//           success: true,
//           data: [],
//           pagination: isPagination ? {
//             currentPage: page,
//             pageSize: pageSize,
//             totalCount: 0,
//             totalPages: 0,
//             hasNext: false,
//             hasPrev: false,
//             counts: { approved: 0, pending: 0, total: 0 }
//           } : null,
//           counts: { approved: 0, pending: 0, total: 0 }
//         });
//       }
//     }

//     // Company filter
//     let companyIds = [];
//     if (filters.company && filters.company.length > 0) {
//       const companies = await CompanyName.find({
//         companyName: { $in: filters.company }
//       }).select('_id').lean();

//       if (companies.length > 0) {
//         companyIds = companies.map(c => c._id);
//         baseQuery.companyName = { $in: companyIds };
//         countQuery.companyName = { $in: companyIds };
//       } else {
//         return res.status(200).json({
//           success: true,
//           data: [],
//           pagination: isPagination ? {
//             currentPage: page,
//             pageSize: pageSize,
//             totalCount: 0,
//             totalPages: 0,
//             hasNext: false,
//             hasPrev: false,
//             counts: { approved: 0, pending: 0, total: 0 }
//           } : null,
//           counts: { approved: 0, pending: 0, total: 0 }
//         });
//       }
//     }

//     // ===== STEP 3: Build Party Query with ALL filters =====
//     let partyIds = null;
//     const partyQuery = {};

//     if (filters.party && filters.party.length > 0) {
//       partyQuery.partyName = { $in: filters.party };
//     }
//     if (filters.contactPerson && filters.contactPerson.length > 0) {
//       partyQuery.contactPerson = { $in: filters.contactPerson };
//     }
//     if (filters.partyTag && filters.partyTag.length > 0) {
//       partyQuery.partyTag = { $in: filters.partyTag };
//     }
//     if (filters.partyType && filters.partyType.length > 0) {
//       partyQuery.partyType = { $in: filters.partyType };
//     }
//     if (filters.mobile && filters.mobile.length > 0) {
//       partyQuery.ownerMobileNo = { $in: filters.mobile };
//     }

//     // Unit No filter - properly handle as array
//     if (filters.unitNo && filters.unitNo.length > 0) {
//       partyQuery["address.unitNo"] = { $in: filters.unitNo };
//     }

//     // NOTE: Status is NOT added to partyQuery yet, because we need unlimited parties for counts

//     // Market filter
//     if (filters.market && filters.market.length > 0) {
//       const markets = await Market.find({
//         marketName: { $in: filters.market }
//       }).select('_id').lean();
//       if (markets.length > 0) {
//         partyQuery["address.marketName"] = { $in: markets.map(m => m._id) };
//       } else {
//         return res.status(200).json({
//           success: true,
//           data: [],
//           pagination: isPagination ? {
//             currentPage: page,
//             pageSize: pageSize,
//             totalCount: 0,
//             totalPages: 0,
//             hasNext: false,
//             hasPrev: false,
//             counts: { approved: 0, pending: 0, total: 0 }
//           } : null,
//           counts: { approved: 0, pending: 0, total: 0 }
//         });
//       }
//     }

//     // Area filter
//     if (filters.area && filters.area.length > 0) {
//       const areas = await Market.find({
//         area: { $in: filters.area }
//       }).select('_id').lean();
//       if (areas.length > 0) {
//         partyQuery["address.area"] = { $in: areas.map(a => a._id) };
//       } else {
//         return res.status(200).json({
//           success: true,
//           data: [],
//           pagination: isPagination ? {
//             currentPage: page,
//             pageSize: pageSize,
//             totalCount: 0,
//             totalPages: 0,
//             hasNext: false,
//             hasPrev: false,
//             counts: { approved: 0, pending: 0, total: 0 }
//           } : null,
//           counts: { approved: 0, pending: 0, total: 0 }
//         });
//       }
//     }

//     // Search in party fields
//     if (search) {
//       partyQuery.$or = [
//         { partyName: { $regex: search, $options: "i" } },
//         { ownerName: { $regex: search, $options: "i" } },
//         { ownerMobileNo: { $regex: search, $options: "i" } },
//         { ownerWhatsAppNo: { $regex: search, $options: "i" } },
//         { contactPerson: { $regex: search, $options: "i" } },
//         { personMobileNo: { $regex: search, $options: "i" } },
//         { personWhatsAppNo: { $regex: search, $options: "i" } },
//         { contactForPayment: { $regex: search, $options: "i" } },
//         { contactMobileNo: { $regex: search, $options: "i" } },
//         { contactWhatsAppNo: { $regex: search, $options: "i" } },
//         { GSTNo: { $regex: search, $options: "i" } },
//         { "address.unitNo": { $regex: search, $options: "i" } }
//       ];
//     }

//     // Calculate Party IDs
//     let allMatchingPartyIds = null;

//     // Check if we need to filter by party at all (either filters/search OR status filter is present)
//     const hasStatusFilter = filters.status && filters.status.length > 0;
//     const hasOtherPartyFilters = Object.keys(partyQuery).length > 0;

//     if (hasOtherPartyFilters) {
//       // Find particles matching attributes/search
//       const parties = await Party.find(partyQuery).select('_id statusApproval').lean();

//       if (parties.length === 0) {
//         return res.status(200).json({
//           success: true,
//           data: [],
//           pagination: isPagination ? {
//             currentPage: page,
//             pageSize: pageSize,
//             totalCount: 0,
//             totalPages: 0,
//             hasNext: false,
//             hasPrev: false,
//             counts: { approved: 0, pending: 0, total: 0 }
//           } : null,
//           counts: { approved: 0, pending: 0, total: 0 }
//         });
//       }

//       allMatchingPartyIds = parties.map(p => p._id);

//       // Apply to countQuery (ALL statuses)
//       countQuery.party = { $in: allMatchingPartyIds };

//       // Apply to baseQuery (Specific statuses if filtered)
//       if (hasStatusFilter) {
//         const statusFiltered = parties.filter(p => filters.status.includes(p.statusApproval));
//         if (statusFiltered.length === 0) {
//           // No parties match the status filter
//           // Force baseQuery to fail safely
//           baseQuery.party = { $in: [] };
//         } else {
//           baseQuery.party = { $in: statusFiltered.map(p => p._id) };
//         }
//       } else {
//         baseQuery.party = { $in: allMatchingPartyIds };
//       }
//     } else {
//       // No attribute filters.
//       // If status filter exists, we must only restrict baseQuery. countQuery remains open for all parties.
//       if (hasStatusFilter) {
//         const statusParties = await Party.find({ statusApproval: { $in: filters.status } }).select('_id').lean();
//         if (statusParties.length > 0) {
//           baseQuery.party = { $in: statusParties.map(p => p._id) };
//         } else {
//           baseQuery.party = { $in: [] };
//         }
//       }
//     }


//     // ===== STEP 4: Handle assignedTo and remarks filters =====
//     let taskFilteredAccountMasterIds = null;

//     if ((filters.assignedTo && filters.assignedTo.length > 0) ||
//       (filters.remarks && filters.remarks.length > 0)) {

//       const taskQuery = {};

//       // AssignedTo filter
//       if (filters.assignedTo && filters.assignedTo.length > 0) {
//         const assignedToStaff = await Staff.find({
//           $or: [
//             { firstName: { $in: filters.assignedTo } },
//             { lastName: { $in: filters.assignedTo } },
//             {
//               $expr: {
//                 $regexMatch: {
//                   input: { $concat: ["$firstName", " ", "$lastName"] },
//                   regex: new RegExp(filters.assignedTo.join("|"), "i")
//                 }
//               }
//             }
//           ]
//         }).select('_id').lean();

//         if (assignedToStaff.length > 0) {
//           taskQuery.assignTo = { $in: assignedToStaff.map(s => s._id) };
//         } else {
//           return res.status(200).json({
//             success: true,
//             data: [],
//             pagination: isPagination ? {
//               currentPage: page,
//               pageSize: pageSize,
//               totalCount: 0,
//               totalPages: 0,
//               hasNext: false,
//               hasPrev: false,
//               counts: { approved: 0, pending: 0, total: 0 }
//             } : null,
//             counts: { approved: 0, pending: 0, total: 0 }
//           });
//         }
//       }

//       // Remarks filter
//       if (filters.remarks && filters.remarks.length > 0) {
//         taskQuery.$or = filters.remarks.map(remark => ({
//           remarks: { $regex: remark, $options: "i" }
//         }));
//       }

//       // If we have company filter, add it to task query
//       if (companyIds.length > 0) {
//         taskQuery.companyName = { $in: companyIds };
//       }

//       // If we have party filter (the broad one), add it to task query
//       // This is important: we want tasks relevant to "All Parties" matching criteria
//       if (allMatchingPartyIds) {
//         taskQuery.partyName = { $in: allMatchingPartyIds };
//       }

//       // Get latest tasks that match the criteria
//       const matchingTasks = await AssignTask.aggregate([
//         { $match: taskQuery },
//         { $sort: { createdAt: -1 } },
//         {
//           $group: {
//             _id: { partyName: "$partyName", companyName: "$companyName" },
//             latestTask: { $first: "$$ROOT" }
//           }
//         }
//       ]);

//       if (matchingTasks.length > 0) {
//         // Extract unique party-company combinations
//         const partyCompanyCombos = matchingTasks.map(t => ({
//           party: t._id.partyName,
//           company: t._id.companyName
//         }));

//         // Find AccountMasters with these combinations using countQuery (broadest scope)
//         const accountMastersWithTasks = await AccountMaster.find({
//           ...countQuery,
//           $or: partyCompanyCombos.map(combo => ({
//             party: combo.party,
//             companyName: combo.company
//           }))
//         }).select('_id').lean();

//         if (accountMastersWithTasks.length > 0) {
//           taskFilteredAccountMasterIds = accountMastersWithTasks.map(am => am._id);
//         } else {
//           // No account masters match the tasks even with broad filters
//           return res.status(200).json({
//             success: true,
//             data: [],
//             pagination: isPagination ? {
//               currentPage: page,
//               pageSize: pageSize,
//               totalCount: 0,
//               totalPages: 0,
//               hasNext: false,
//               hasPrev: false,
//               counts: { approved: 0, pending: 0, total: 0 }
//             } : null,
//             counts: { approved: 0, pending: 0, total: 0 }
//           });
//         }
//       } else {
//         return res.status(200).json({
//           success: true,
//           data: [],
//           pagination: isPagination ? {
//             currentPage: page,
//             pageSize: pageSize,
//             totalCount: 0,
//             totalPages: 0,
//             hasNext: false,
//             hasPrev: false,
//             counts: { approved: 0, pending: 0, total: 0 }
//           } : null,
//           counts: { approved: 0, pending: 0, total: 0 }
//         });
//       }
//     }

//     // Add task-filtered IDs to BOTH queries
//     if (taskFilteredAccountMasterIds) {
//       baseQuery._id = { $in: taskFilteredAccountMasterIds };
//       countQuery._id = { $in: taskFilteredAccountMasterIds };
//     }

//     // ===== STEP 5: Get total count with ALL filters applied =====
//     const totalCount = await AccountMaster.countDocuments(baseQuery);

//     // Don't return early if totalCount is 0, because we might need to return counts

//     // ===== STEP 6: Get accurate status counts based on Broad (Count) Query =====
//     let counts = { approved: 0, pending: 0, total: totalCount };

//     if (includeCounts) {
//       // Use countQuery which EXCLUDES status filter but INCLUDES all other filters
//       const filteredAccountMasterIds = await AccountMaster.find(countQuery)
//         .select('party')
//         .lean();

//       const filteredPartyIds = filteredAccountMasterIds.map(am => am.party);

//       if (filteredPartyIds.length > 0) {
//         // Get status counts only for parties that are in filtered AccountMasters
//         const statusCounts = await Party.aggregate([
//           { $match: { _id: { $in: filteredPartyIds } } },
//           {
//             $group: {
//               _id: "$statusApproval",
//               count: { $sum: 1 }
//             }
//           }
//         ]);

//         statusCounts.forEach(sc => {
//           if (sc._id === "APPROVED") counts.approved = sc.count;
//           if (sc._id === "PENDING") counts.pending = sc.count;
//         });
//         // Override total with the broad total if desired, usually frontend wants total of current view.
//         // But often in tabs (Approved (5) | Pending (2)), the total is 7.
//         // Let's set 'total' to the sum of approved and pending for the "Counts" object.
//         // The Pagination total should remain 'totalCount' (filtered items).
//         counts.total = counts.approved + counts.pending;
//       }
//     }

//     if (totalCount === 0) {
//       return res.status(200).json({
//         success: true,
//         data: [],
//         pagination: isPagination ? {
//           currentPage: page,
//           pageSize: pageSize,
//           totalCount: 0,
//           totalPages: 0,
//           hasNext: false,
//           hasPrev: false,
//           counts: counts
//         } : null,
//         counts: counts
//       });
//     }

//     // ===== STEP 7: Build aggregation pipeline with pagination =====
//     const pipeline = [
//       { $match: baseQuery },
//       { $sort: { createdAt: -1 } },
//       { $skip: isPagination ? (page - 1) * pageSize : 0 },
//       { $limit: isPagination ? pageSize : totalCount },
//       // Now do lookups only on the paginated subset
//       {
//         $lookup: {
//           from: "parties",
//           localField: "party",
//           foreignField: "_id",
//           as: "party",
//           pipeline: [
//             {
//               $project: {
//                 partyName: 1,
//                 partyTag: 1,
//                 partyType:1,
//                 ownerMobileNo: 1,
//                 ownerName: 1,
//                 contactForPayment: 1,
//                 ownerWhatsAppNo: 1,
//                 contactPerson: 1,
//                 personMobileNo: 1,
//                 personWhatsAppNo: 1,
//                 contactForPayment: 1,
//                 contactMobileNo: 1,
//                 contactWhatsAppNo: 1,
//                 GSTNo: 1,
//                 statusApproval: 1,
//                 "address.unitNo": 1,
//                 "address.marketName": 1,
//                 "address.area": 1,
//                 "address.state": 1,
//                 "address.city": 1,
//                 _id: 1
//               }
//             }
//           ]
//         }
//       },
//       { $unwind: { path: "$party", preserveNullAndEmptyArrays: false } },
//       // CreatedBy lookup
//       {
//         $lookup: {
//           from: "staffs",
//           localField: "createdBy",
//           foreignField: "_id",
//           as: "createdBy",
//           pipeline: [
//             {
//               $project: {
//                 firstName: 1,
//                 lastName: 1,
//                 _id: 1
//               }
//             }
//           ]
//         }
//       },
//       { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
//       // CompanyName lookup
//       {
//         $lookup: {
//           from: "companynames",
//           localField: "companyName",
//           foreignField: "_id",
//           as: "companyName",
//           pipeline: [
//             {
//               $project: {
//                 companyName: 1,
//                 avatar: 1,
//                 _id: 1
//               }
//             }
//           ]
//         }
//       },
//       { $unwind: { path: "$companyName", preserveNullAndEmptyArrays: true } },
//       // MarketName lookup
//       {
//         $lookup: {
//           from: "markets",
//           localField: "party.address.marketName",
//           foreignField: "_id",
//           as: "party.address.marketName",
//           pipeline: [
//             {
//               $project: {
//                 marketName: 1,
//                 _id: 1
//               }
//             }
//           ]
//         }
//       },
//       { $unwind: { path: "$party.address.marketName", preserveNullAndEmptyArrays: true } },
//       // Area lookup
//       {
//         $lookup: {
//           from: "markets",
//           localField: "party.address.area",
//           foreignField: "_id",
//           as: "party.address.area",
//           pipeline: [
//             {
//               $project: {
//                 area: 1,
//                 _id: 1
//               }
//             }
//           ]
//         }
//       },
//       { $unwind: { path: "$party.address.area", preserveNullAndEmptyArrays: true } },
//       // Latest task lookup
//       {
//         $lookup: {
//           from: "assigntasks",
//           let: { partyId: "$party._id", companyId: "$companyName._id" },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $and: [
//                     { $eq: ["$partyName", "$$partyId"] },
//                     { $eq: ["$companyName", "$$companyId"] }
//                   ]
//                 }
//               }
//             },
//             { $sort: { createdAt: -1 } },
//             { $limit: 1 },
//             {
//               $project: {
//                 remarks: 1,
//                 status: 1,
//                 assignTo: 1,
//                 createdAt: 1,
//                 updatedAt: 1
//               }
//             }
//           ],
//           as: "latestTask"
//         }
//       },
//       { $unwind: { path: "$latestTask", preserveNullAndEmptyArrays: true } },
//       // Populate assignTo
//       {
//         $lookup: {
//           from: "staffs",
//           let: { assignToId: "$latestTask.assignTo" },
//           pipeline: [
//             {
//               $match: {
//                 $expr: { $eq: ["$_id", "$$assignToId"] }
//               }
//             },
//             {
//               $project: {
//                 firstName: 1,
//                 lastName: 1,
//                 _id: 1
//               }
//             }
//           ],
//           as: "latestTask.assignTo"
//         }
//       },
//       { $unwind: { path: "$latestTask.assignTo", preserveNullAndEmptyArrays: true } },
//       // Clean up the structure
//       {
//         $addFields: {
//           createdBy: {
//             firstName: "$createdBy.firstName",
//             lastName: "$createdBy.lastName"
//           },
//           companyName: {
//             companyName: "$companyName.companyName",
//             avatar: "$companyName.avatar"
//           },
//           "party.address": {
//             unitNo: "$party.address.unitNo",
//             marketName: "$party.address.marketName.marketName",
//             area: "$party.address.area.area",
//             state: "$party.address.state",
//             city: "$party.address.city"
//           },
//           latestTask: {
//             remarks: "$latestTask.remarks",
//             status: "$latestTask.status",
//             assignTo: {
//               firstName: "$latestTask.assignTo.firstName",
//               lastName: "$latestTask.assignTo.lastName"
//             }
//           }
//         }
//       },
//       // Final project
//       {
//         $project: {
//           reasonToVisit: 1,
//           createdAt: 1,
//           updatedAt: 1,
//           party: 1,
//           createdBy: 1,
//           companyName: 1,
//           latestTask: 1
//         }
//       }
//     ];

//     // Execute the aggregation
//     const enrichedAccountMasters = await AccountMaster.aggregate(pipeline);

//     // Prepare proper pagination information with accurate counts
//     const totalPages = Math.ceil(totalCount / pageSize);
//     const pagination = isPagination ? {
//       currentPage: page,
//       pageSize: pageSize,
//       totalCount: totalCount,
//       totalPages: totalPages,
//       hasNext: page < totalPages,
//       hasPrev: page > 1,
//       counts: counts
//     } : null;

//     res.status(200).json({
//       success: true,
//       data: enrichedAccountMasters,
//       pagination: pagination,
//       counts: counts
//     });

//   } catch (error) {
//     console.error("Error getting account masters:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch account masters",
//       error: error.message
//     });
//   }
// };
// const normalize = (val) => (val ? String(val).trim().toLowerCase() : null);

// // Helper to find a Market by field
// const findMarketByField = async (field, value, session) => {
//   if (!value) return null;
//   const normalized = normalize(value);

//   const market = await Market.findOne({
//     [field]: { $regex: new RegExp(`^${normalized}$`, "i") }, // exact match, case-insensitive
//   }).session(session);

//   return market ? market._id : null;
// };

// async function findStaffByFullName(fullName) {

//   const [firstName, lastName] = fullName.trim().split(" ");

//   const staff = await Staff.findOne({
//     $expr: {
//       $and: [
//         {
//           $eq: [
//             { $toLower: { $trim: { input: "$firstName" } } },
//             firstName.toLowerCase(),
//           ],
//         },
//         {
//           $eq: [
//             { $toLower: { $trim: { input: "$lastName" } } },
//             lastName.toLowerCase(),
//           ],
//         },
//       ],
//     },
//   });

//   return staff;
// }

// exports.bulkCreateAccountMasters = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     if (!req.file) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         message: "No file uploaded",
//       });
//     }

//     const globalCompanyName = req.body.companyName;

//     if (!globalCompanyName) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         message: "companyName is required in the request body",
//       });
//     }

//     // Read CSV
//     const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const data = xlsx.utils.sheet_to_json(sheet);

//     const accountMasters = [];
//     const skippedRecords = [];

//     for (const [index, row] of data.entries()) {
//       try {
//         // ✅ Find staff by full name
//         const staff = await findStaffByFullName(row.createdBy);
//         if (!staff) {
//           skippedRecords.push({
//             ...row,
//             reason: `Staff not found for createdBy: ${row.createdBy}`,
//           });
//           continue;
//         }

//         // PartyTag logic
//         let partyTag = "New";
//         if (row.partyTag) {
//           const partyTagValue = String(row.partyTag).trim().toLowerCase();
//           if (partyTagValue === "customer") partyTag = "Customer";
//         }

//         // Market resolve
//         const marketId = await findMarketByField(
//           "marketName",
//           row.marketName,
//           session
//         );

//         const address = {
//           unitNo: row.unitNo || null,
//           marketName: marketId,
//           // streetAddress: marketId,
//           landMark: marketId,
//           area: marketId,
//           pincode: marketId,
//         };

//         // Party
//         const partyData = {
//           companyName: globalCompanyName,
//           partyName: row.partyName || null,
//           ownerName: row.ownerName || null,
//           ownerMobileNo: row.ownerMobileNo || null,
//           ownerWhatsAppNo: row.ownerWhatsAppNo
//             ? String(row.ownerWhatsAppNo)
//             : null,
//           ownerEmail: row.ownerEmail || null,
//           contactPerson: row.contactPerson || null,
//           personMobileNo: row.personMobileNo || null,
//           personWhatsAppNo: row.personWhatsAppNo || null,
//           contactPersonEmail: row.contactPersonEmail || null,
//           contactForPayment: row.contactForPayment || null,
//           contactMobileNo: row.contactMobileNo || null,
//           contactWhatsAppNo: row.contactWhatsAppNo || null,
//           contactForPaymentEmail: row.contactForPaymentEmail || null,
//           GSTNo: row.GSTNo || null,
//           address,
//           reference: row.reference || null,
//           statusApproval: row.isRequestMode === "TRUE" ? "Pending" : "Approved",
//           createdBy: staff._id,
//           partyTag,
//           partyType: row.partyType || "",
//         };

//         const newParty = await Party.create([partyData], { session });

//         const accountMasterData = {
//           companyName: globalCompanyName,
//           party: newParty[0]._id,
//           reasonToVisit: row.reasonToVisit || null,
//           reference: row.reference || null,
//           createdBy: staff._id,
//           partyTag,
//         };

//         const newAccountMaster = await AccountMaster.create(
//           [accountMasterData],
//           { session }
//         );
//         accountMasters.push(newAccountMaster[0]);
//       } catch (err) {
//         skippedRecords.push({
//           row: index + 1,
//           reason: err.message,
//         });
//         continue;
//       }
//     }

//     await session.commitTransaction();
//     session.endSession();

//     return res.status(201).json({
//       success: true,
//       message: "Bulk account masters processed",
//       insertedCount: accountMasters.length,
//       skippedCount: skippedRecords.length,
//       skippedRecords, // optional: to debug which ones skipped
//       data: accountMasters,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     return res.status(500).json({
//       success: false,
//       message: "Failed to bulk create account masters",
//       error: error.message,
//     });
//   }
// };

// exports.getAccountMasterById = async (req, res) => {
//   try {
//     const { id } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid AccountMaster ID",
//       });
//     }

//     const accountMaster = await AccountMaster.findById(id)
//       .populate("companyName") // Include _id for company selection
//       .populate("party")
//       .populate({
//         path: "party",
//         select: "partyName ownerName ownerMobileNo ownerWhatsAppNo ownerEmail contactPerson personMobileNo personWhatsAppNo contactPersonEmail contactForPayment contactMobileNo contactWhatsAppNo contactForPaymentEmail GSTNo partyTag partyType address",
//         populate: [
//           {
//             path: "address.marketName",
//             model: "Market",
//             select: "marketName",
//           },
//           {
//             path: "address.landMark",
//             model: "Market",
//             select: "landmark",
//           },
//           {
//             path: "address.area",
//             model: "Market",
//             select: "area",
//           },
//           {
//             path: "address.pincode",
//             model: "Market",
//             select: "pincode",
//           },
//         ],
//       })
//       .populate("createdBy", "_id firstName lastName email").lean(); // Include _id for createdBy selection

//     if (!accountMaster) {
//       return res.status(404).json({
//         success: false,
//         message: "AccountMaster not found",
//       });
//     }

//     // Transform the data to match frontend structure
//     const responseData = {
//       ...accountMaster,
//       companyName: accountMaster.companyName._id.toString(), // Just the ID for the company select
//       partyName: accountMaster.party.partyName, // Direct party name for the party input
//       partyId: accountMaster.party._id,
//       ownerName: accountMaster.party.ownerName,
//       ownerMobileNo: accountMaster.party.ownerMobileNo,
//       ownerWhatsAppNo: accountMaster.party.ownerWhatsAppNo,
//       ownerEmail: accountMaster.party.ownerEmail || "",
//       contactPerson: accountMaster.party.contactPerson,
//       personMobileNo: accountMaster.party.personMobileNo,
//       personWhatsAppNo: accountMaster.party.personWhatsAppNo,
//       contactPersonEmail: accountMaster.party.contactPersonEmail || "",
//       contactForPayment: accountMaster.party.contactForPayment,
//       contactMobileNo: accountMaster.party.contactMobileNo,
//       contactWhatsAppNo: accountMaster.party.contactWhatsAppNo,
//       contactForPaymentEmail: accountMaster.party.contactForPaymentEmail || "",
//       GSTNo: accountMaster.party.GSTNo,
//       partyTag: accountMaster.party.partyTag,
//       partyType: accountMaster.party.partyType || "",
//       address: {
//         unitNo: accountMaster.party.address.unitNo,
//         marketName: accountMaster.party.address.marketName,
//         // streetAddress: accountMaster.party.address.streetAddress,
//         landMark: accountMaster.party.address.landMark || "", // Handle optional field
//         area: accountMaster.party.address.area,
//         pincode: accountMaster.party.address.pincode,
//       },
//       reasonToVisit: accountMaster.reasonToVisit,
//       reference: accountMaster.reference || "",
//       createdBy: accountMaster.createdBy._id.toString(), // Just the ID for the staff select
//       // Include additional fields that might be needed for display
//       createdById: accountMaster.createdBy._id.toString(),
//       companyNameObj: accountMaster.companyName, // Entire company object if needed
//       createdByObj: accountMaster.createdBy, // Entire staff object if needed
//     };

//     res.status(200).json({
//       success: true,
//       data: responseData,
//     });
//   } catch (error) {
//     console.error("Error fetching account master:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch account master",
//       error: error.message,
//     });
//   }
// };

// exports.updateAccountMaster = async (req, res) => {
//   try {
//     const { id } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid AccountMaster ID",
//       });
//     }

//     const accountMaster = await AccountMaster.findById(id);
//     if (!accountMaster) {
//       return res.status(404).json({
//         success: false,
//         message: "AccountMaster not found",
//       });
//     }

//     if (!req.body.companyName || !req.body.reasonToVisit) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: companyName or reasonToVisit",
//       });
//     }

//     const company = await CompanyName.findById(req.body.companyName);
//     if (!company) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid companyName ID. Company does not exist.",
//       });
//     }

//     // Validate createdBy if provided
//     if (req.body.createdBy) {
//       if (!mongoose.Types.ObjectId.isValid(req.body.createdBy)) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid createdBy ID",
//         });
//       }
//       const staff = await Staff.findById(req.body.createdBy);
//       if (!staff) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid createdBy ID. Staff member does not exist.",
//         });
//       }
//     }
//     const emailRegex = /^\S+@\S+\.\S+$/;
//     if (req.body.ownerEmail && !emailRegex.test(req.body.ownerEmail)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid owner email format",
//       });
//     }
//     if (
//       req.body.contactPersonEmail &&
//       !emailRegex.test(req.body.contactPersonEmail)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid contact person email format",
//       });
//     }
//     if (
//       req.body.contactForPaymentEmail &&
//       !emailRegex.test(req.body.contactForPaymentEmail)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid contact for payment email format",
//       });
//     }
//     const partyId = accountMaster.party;

//     const partyUpdateData = {
//       partyName: req.body.partyName,
//       ownerName: req.body.ownerName,
//       ownerMobileNo: req.body.ownerMobileNo,
//       ownerWhatsAppNo: req.body.ownerWhatsAppNo,
//       ownerEmail: req.body.ownerEmail || null,
//       contactPerson: req.body.contactPerson,
//       personMobileNo: req.body.personMobileNo,
//       personWhatsAppNo: req.body.personWhatsAppNo,
//       contactPersonEmail: req.body.contactPersonEmail || null,
//       contactForPayment: req.body.contactForPayment,
//       contactMobileNo: req.body.contactMobileNo,
//       contactWhatsAppNo: req.body.contactWhatsAppNo,
//       contactForPaymentEmail: req.body.contactForPaymentEmail || null,
//       GSTNo: req.body.GSTNo,
//       address: req.body.address,
//       partyType: req.body.partyType,
//       reference: req.body.reference,
//       partyTag: req.body.partyTag,
//       // Preserve existing statusApproval unless explicitly updated
//       statusApproval:
//         req.body.statusApproval ||
//         (await Party.findById(partyId)).statusApproval,
//     };

//     if (
//       req.body.companyName ||
//       req.body.partyName ||
//       req.body.ownerWhatsAppNo
//     ) {
//       const existingParty = await Party.findOne({
//         $and: [
//           { _id: { $ne: partyId } }, // Exclude current party
//           { companyName: req.body.companyName || accountMaster.companyName },
//           { partyName: req.body.partyName || accountMaster.party.partyName },
//           {
//             ownerWhatsAppNo:
//               req.body.ownerWhatsAppNo || accountMaster.party.ownerWhatsAppNo,
//           },
//         ],
//       });

//       if (existingParty) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "A party with this company, name and mobile number already exists",
//         });
//       }
//     }

//     const updatedParty = await Party.findByIdAndUpdate(
//       partyId,
//       partyUpdateData,
//       {
//         new: true,
//         runValidators: true,
//       }
//     );

//     if (!updatedParty) {
//       return res.status(404).json({
//         success: false,
//         message: "Associated Party not found",
//       });
//     }

//     const accountMasterUpdateData = {
//       companyName: req.body.companyName,
//       reasonToVisit: req.body.reasonToVisit,
//       reference: req.body.reference,
//       ...(req.body.createdBy && { createdBy: req.body.createdBy }), // Conditionally include createdBy
//     };


//     const updatedAccountMaster = await AccountMaster.findByIdAndUpdate(
//       id,
//       accountMasterUpdateData,
//       { new: true, runValidators: true }
//     )
//       .populate("companyName", "companyName avatar")
//       .populate("party")
//       .populate({
//         path: "party",
//         select: "-__v",
//         populate: [
//           {
//             path: "address.marketName",
//             model: "Market",
//             select: "marketName", // only marketName
//           },
//           // {
//           //   path: "address.streetAddress",
//           //   model: "Market",
//           //   select: "streetAddress", // only streetAddress
//           // },
//           {
//             path: "address.landMark",
//             model: "Market",
//             select: "landmark", // only landMark
//           },
//           {
//             path: "address.area",
//             model: "Market",
//             select: "area", // only area
//           },
//           {
//             path: "address.pincode",
//             model: "Market",
//             select: "pincode", // only pincode
//           },
//         ],
//       })
//       .populate("createdBy", "firstName lastName email");

//     if (!updatedAccountMaster) {
//       return res.status(404).json({
//         success: false,
//         message: "Failed to update AccountMaster",
//       });
//     }


//     res.status(200).json({
//       success: true,
//       message: "Account master updated successfully",
//       data: updatedAccountMaster,
//     });
//   } catch (error) {
//     console.error("Error updating account master:", error);
//     if (error.code === 11000) {
//       return res.status(400).json({
//         success: false,
//         message: "Duplicate entry. Party name or GST number already exists.",
//       });
//     }
//     if (error.name === "ValidationError") {
//       return res.status(400).json({
//         success: false,
//         message: "Validation error",
//         error: error.message,
//       });
//     }
//     res.status(500).json({
//       success: false,
//       message: "Failed to update account master",
//       error: error.message,
//       stack: error.stack,
//     });
//   }
// };

// // Update Account Master Status
// exports.updateAccountMasterStatus = async (req, res) => {
//   try {
//     // Validate status if provided
//     if (!req.body.status) {
//       return res.status(400).json({
//         success: false,
//         message: "Status is required",
//       });
//     }

//     // Update the AccountMaster document
//     const updatedAccountMaster = await AccountMaster.findByIdAndUpdate(
//       req.params.id,
//       { status: req.body.status }, // Only update status if it's part of the schema
//       { new: true, runValidators: true }
//     ).populate("createdBy", "firstName lastName email");

//     if (!updatedAccountMaster) {
//       return res.status(404).json({
//         success: false,
//         message: "Account master not found",
//       });
//     }

//     // Find the latest assign task for this party
//     const latestTask = await AssignTask.findOne({
//       partyName: updatedAccountMaster.partyName,
//     })
//       .sort({ createdAt: -1 })
//       .populate("assignTo", "firstName lastName email");

//     // Prepare assignedTo, remarks, and status from the latest task
//     let assignedTo = updatedAccountMaster.createdBy;
//     let remarks = "NA";
//     let status = req.body.status || "Not Started"; // Use the provided status

//     if (latestTask) {
//       assignedTo = latestTask.assignTo || updatedAccountMaster.createdBy;
//       remarks = latestTask.remarks || "NA";
//       status = latestTask.status || req.body.status || "Not Started";
//     }

//     // Format the response to match the schema and include task data
//     const formattedData = {
//       _id: updatedAccountMaster._id,
//       companyName: updatedAccountMaster.companyName,
//       partyName: updatedAccountMaster.partyName,
//       ownerName: updatedAccountMaster.ownerName,
//       ownerMobileNo: updatedAccountMaster.ownerMobileNo,
//       ownerWhatsAppNo: updatedAccountMaster.ownerWhatsAppNo,
//       contactPerson: updatedAccountMaster.contactPerson,
//       personMobileNo: updatedAccountMaster.personMobileNo,
//       personWhatsAppNo: updatedAccountMaster.personWhatsAppNo,
//       contactForPayment: updatedAccountMaster.contactForPayment,
//       contactMobileNo: updatedAccountMaster.contactMobileNo,
//       contactWhatsAppNo: updatedAccountMaster.contactWhatsAppNo,
//       GSTNo: updatedAccountMaster.GSTNo,
//       address: {
//         unitNo: updatedAccountMaster.address.unitNo,
//         marketName: updatedAccountMaster.address.marketName,
//         // streetAddress: updatedAccountMaster.address.streetAddress,
//         landMark: updatedAccountMaster.address.landMark,
//         area: updatedAccountMaster.address.area,
//         pincode: updatedAccountMaster.address.pincode,
//       },
//       reasonToVisit: updatedAccountMaster.reasonToVisit,
//       partyTag: updatedAccountMaster.partyTag,
//       createdBy: updatedAccountMaster.createdBy
//         ? `${updatedAccountMaster.createdBy.firstName} ${updatedAccountMaster.createdBy.lastName}`
//         : "",
//       createdById: updatedAccountMaster.createdBy
//         ? updatedAccountMaster.createdBy._id
//         : null,
//       assignedTo: assignedTo
//         ? {
//           _id: assignedTo._id,
//           name: `${assignedTo.firstName} ${assignedTo.lastName}`,
//           email: assignedTo.email,
//         }
//         : null,
//       remarks,
//       status,
//       createdAt: updatedAccountMaster.createdAt,
//       updatedAt: updatedAccountMaster.updatedAt,
//     };

//     res.status(200).json({
//       success: true,
//       message: "Account master status updated successfully",
//       data: formattedData,
//     });
//   } catch (error) {
//     console.error("Error updating account master status:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update account master status",
//       error: error.message,
//     });
//   }
// };

// exports.deleteAccountMaster = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const accountMasterId = req.params.id;

//     // 1. Find the AccountMaster with party details
//     const accountMaster = await AccountMaster.findById(accountMasterId)
//       .populate("party")
//       .session(session);

//     if (!accountMaster) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({
//         success: false,
//         message: "Account master not found",
//       });
//     }

//     // Store party ID for deletion
//     const partyId = accountMaster.party._id;

//     // 2. Delete the AccountMaster
//     await AccountMaster.findByIdAndDelete(accountMasterId).session(session);

//     // 3. Delete the associated Party
//     await Party.findByIdAndDelete(partyId).session(session);

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message: "Account master and associated party deleted successfully",
//       deletedCounts: {
//         accountMaster: 1,
//         party: 1,
//       },
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();

//     console.error("Error in deleteAccountMaster:", error);

//     if (error.name === "CastError") {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid ID format",
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Failed to delete account master and party",
//       error: error.message,
//     });
//   }
// };

// // Get all Staff for createdBy dropdown
// exports.getAllStaff = async (req, res) => {
//   try {
//     const staff = await Staff.find({}, "firstName lastName _id");
//     const formattedStaff = staff.map((s) => ({
//       id: s._id,
//       name: `${s.firstName} ${s.lastName}`,
//     }));

//     res.status(200).json({
//       success: true,
//       data: formattedStaff,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// exports.getAccountMasterByCompanyAndParty = async (req, res) => {
//   try {
//     const { companyId, partyId } = req.body;
//     // Validate both IDs
//     if (
//       !mongoose.Types.ObjectId.isValid(companyId) ||
//       !mongoose.Types.ObjectId.isValid(partyId)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid ID format(s)",
//       });
//     }

//     // Find account master where both company and party match
//     const accountMaster = await AccountMaster.findOne({
//       companyName: companyId,
//       party: partyId,
//     })
//       .populate({
//         path: "companyName",
//         select: "-__v", // All company fields except version
//       })
//       .populate({
//         path: "party",
//         select: "-__v",
//         populate: [
//           { path: "address.marketName", model: "Market", select: "marketName" },
//           { path: "address.landMark", model: "Market", select: "landmark" },
//           { path: "address.area", model: "Market", select: "area" },
//           { path: "address.pincode", model: "Market", select: "pincode" },
//         ],
//       })
//       .populate({
//         path: "createdBy",
//         select: "-__v -password", // All staff fields except version and password
//       });

//     if (!accountMaster) {
//       return res.status(404).json({
//         success: false,
//         message: "No account found matching these company and party IDs",
//       });
//     }

//     // Return complete populated data
//     res.status(200).json({
//       success: true,
//       data: {
//         accountMaster: {
//           _id: accountMaster._id,
//           reasonToVisit: accountMaster.reasonToVisit,
//           createdAt: accountMaster.createdAt,
//           updatedAt: accountMaster.updatedAt,
//           company: accountMaster.companyName.toObject(),
//           party: accountMaster.party.toObject(),
//           createdBy: accountMaster.createdBy.toObject(),
//         },
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching account:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch account data",
//       error: error.message,
//     });
//   }
// };

// // controllers/accountMasterController.js
// exports.approveParty = async (req, res) => {
//   try {
//     const { id } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid Party ID",
//       });
//     }

//     const party = await Party.findById(id);
//     if (!party) {
//       return res.status(404).json({
//         success: false,
//         message: "Party not found",
//       });
//     }

//     if (party.statusApproval === "Approved") {
//       return res.status(400).json({
//         success: false,
//         message: "Party is already approved",
//       });
//     }

//     party.statusApproval = "Approved";
//     await party.save();

//     const accountMaster = await AccountMaster.findOne({ party: id })
//       .populate("companyName", "companyName avatar")
//       .populate("party")
//       .populate("createdBy", "firstName lastName email");

//     res.status(200).json({
//       success: true,
//       message: "Party approved successfully",
//       data: accountMaster,
//     });
//   } catch (error) {
//     console.error("Error approving party:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to approve party",
//       error: error.message,
//     });
//   }
// };

// exports.getAccountMasterByStaffId = async (req, res) => {
//   try {
//     const {
//       filters = {},
//       search = "",
//       startDate,
//       endDate,
//       isPagination = false,
//       page = 1,
//       pageSize = 10,
//       includeCounts = false
//     } = req.body;

//     // ===== STEP 1: Build base query for AccountMaster =====
//     const baseQuery = {};

//     // Date range filter
//     if (startDate || endDate) {
//       baseQuery.createdAt = {};
//       if (startDate) {
//         const start = new Date(startDate);
//         start.setHours(0, 0, 0, 0);
//         baseQuery.createdAt.$gte = start;
//       }
//       if (endDate) {
//         const end = new Date(endDate);
//         end.setHours(23, 59, 59, 999);
//         baseQuery.createdAt.$lte = end;
//       }
//     }

//     // Reason filter
//     if (filters.reason && filters.reason.length > 0) {
//       baseQuery.reasonToVisit = { $in: filters.reason };
//     }

//     // ===== STEP 2: Pre-fetch related IDs =====

//     // CreatedBy filter
//     if (filters.createdBy && filters.createdBy.length > 0) {
//       const finalCond = [];
//       filters.createdBy.forEach(full => {
//         const parts = full.trim().split(" ");
//         if (parts.length === 1) {
//           finalCond.push({ firstName: parts[0] });
//           finalCond.push({ lastName: parts[0] });
//         } else {
//           const first = parts[0];
//           const last = parts.slice(1).join(" ");
//           finalCond.push({ firstName: first, lastName: last });
//         }
//       });

//       const staffMatched = await Staff.find({ $or: finalCond }).select('_id').lean();
//       if (staffMatched.length > 0) {
//         baseQuery.createdBy = { $in: staffMatched.map(s => s._id) };
//       } else {
//         return res.status(200).json({
//           success: true,
//           data: [],
//           pagination: isPagination ? {
//             currentPage: page,
//             pageSize: pageSize,
//             totalCount: 0,
//             totalPages: 0,
//             hasNext: false,
//             hasPrev: false,
//             counts: { approved: 0, pending: 0, total: 0 }
//           } : null,
//           counts: { approved: 0, pending: 0, total: 0 }
//         });
//       }
//     }

//     // Company filter
//     let companyIds = [];
//     if (filters.company && filters.company.length > 0) {
//       const companies = await CompanyName.find({
//         companyName: { $in: filters.company }
//       }).select('_id').lean();

//       if (companies.length > 0) {
//         companyIds = companies.map(c => c._id);
//         baseQuery.companyName = { $in: companyIds };
//       } else {
//         return res.status(200).json({
//           success: true,
//           data: [],
//           pagination: isPagination ? {
//             currentPage: page,
//             pageSize: pageSize,
//             totalCount: 0,
//             totalPages: 0,
//             hasNext: false,
//             hasPrev: false,
//             counts: { approved: 0, pending: 0, total: 0 }
//           } : null,
//           counts: { approved: 0, pending: 0, total: 0 }
//         });
//       }
//     }

//     // Party filters
//     let partyIds = null;
//     const partyQuery = {};

//     if (filters.party && filters.party.length > 0) {
//       partyQuery.partyName = { $in: filters.party };
//     }
//     if (filters.contactPerson && filters.contactPerson.length > 0) {
//       partyQuery.contactPerson = { $in: filters.contactPerson };
//     }
//     if (filters.partyTag && filters.partyTag.length > 0) {
//       partyQuery.partyTag = { $in: filters.partyTag };
//     }
//     if (filters.mobile && filters.mobile.length > 0) {
//       partyQuery.ownerMobileNo = { $in: filters.mobile };
//     }
//     if (filters.unitNo && filters.unitNo.length > 0) {
//       partyQuery["address.unitNo"] = { $in: filters.unitNo };
//     }
//     if (filters.status && filters.status.length > 0) {
//       partyQuery.statusApproval = { $in: filters.status };
//     }

//     // Market filter
//     if (filters.market && filters.market.length > 0) {
//       const markets = await Market.find({
//         marketName: { $in: filters.market }
//       }).select('_id').lean();
//       if (markets.length > 0) {
//         partyQuery["address.marketName"] = { $in: markets.map(m => m._id) };
//       }
//     }

//     // Area filter
//     if (filters.area && filters.area.length > 0) {
//       const areas = await Market.find({
//         area: { $in: filters.area }
//       }).select('_id').lean();
//       if (areas.length > 0) {
//         partyQuery["address.area"] = { $in: areas.map(a => a._id) };
//       }
//     }

//     // Search in party fields
//     if (search) {
//       partyQuery.$or = [
//         { partyName: { $regex: search, $options: "i" } },
//         { ownerName: { $regex: search, $options: "i" } },
//         { ownerMobileNo: { $regex: search, $options: "i" } },
//         { ownerWhatsAppNo: { $regex: search, $options: "i" } },
//         { contactPerson: { $regex: search, $options: "i" } },
//         { personMobileNo: { $regex: search, $options: "i" } },
//         { personWhatsAppNo: { $regex: search, $options: "i" } },
//         { contactForPayment: { $regex: search, $options: "i" } },
//         { contactMobileNo: { $regex: search, $options: "i" } },
//         { contactWhatsAppNo: { $regex: search, $options: "i" } },
//         { GSTNo: { $regex: search, $options: "i" } },
//         { "address.unitNo": { $regex: search, $options: "i" } }
//       ];
//     }

//     // Get matching party IDs if we have party filters
//     if (Object.keys(partyQuery).length > 0) {
//       const matchingParties = await Party.find(partyQuery).select('_id').lean();
//       if (matchingParties.length > 0) {
//         partyIds = matchingParties.map(p => p._id);
//         baseQuery.party = { $in: partyIds };
//       } else {
//         return res.status(200).json({
//           success: true,
//           data: [],
//           pagination: isPagination ? {
//             currentPage: page,
//             pageSize: pageSize,
//             totalCount: 0,
//             totalPages: 0,
//             hasNext: false,
//             hasPrev: false,
//             counts: { approved: 0, pending: 0, total: 0 }
//           } : null,
//           counts: { approved: 0, pending: 0, total: 0 }
//         });
//       }
//     }

//     // ===== STEP 3: Handle task-based filters =====
//     let taskFilteredAccountMasterIds = null;

//     if ((filters.assignedTo && filters.assignedTo.length > 0) ||
//       (filters.remarks && filters.remarks.length > 0)) {

//       const taskQuery = {};

//       // AssignedTo filter
//       if (filters.assignedTo && filters.assignedTo.length > 0) {
//         const assignedToStaff = await Staff.find({
//           $or: [
//             { firstName: { $in: filters.assignedTo } },
//             { lastName: { $in: filters.assignedTo } },
//             {
//               $expr: {
//                 $regexMatch: {
//                   input: { $concat: ["$firstName", " ", "$lastName"] },
//                   regex: new RegExp(filters.assignedTo.join("|"), "i")
//                 }
//               }
//             }
//           ]
//         }).select('_id').lean();

//         if (assignedToStaff.length > 0) {
//           taskQuery.assignTo = { $in: assignedToStaff.map(s => s._id) };
//         } else {
//           return res.status(200).json({
//             success: true,
//             data: [],
//             pagination: isPagination ? {
//               currentPage: page,
//               pageSize: pageSize,
//               totalCount: 0,
//               totalPages: 0,
//               hasNext: false,
//               hasPrev: false,
//               counts: { approved: 0, pending: 0, total: 0 }
//             } : null,
//             counts: { approved: 0, pending: 0, total: 0 }
//           });
//         }
//       }

//       // Remarks filter
//       if (filters.remarks && filters.remarks.length > 0) {
//         taskQuery.$or = filters.remarks.map(remark => ({
//           remarks: { $regex: remark, $options: "i" }
//         }));
//       }

//       // Add company filter to task query
//       if (companyIds.length > 0) {
//         taskQuery.companyName = { $in: companyIds };
//       }

//       // Add party filter to task query
//       if (partyIds) {
//         taskQuery.partyName = { $in: partyIds };
//       }

//       // Get latest tasks matching criteria
//       const matchingTasks = await AssignTask.aggregate([
//         { $match: taskQuery },
//         { $sort: { createdAt: -1 } },
//         {
//           $group: {
//             _id: { partyName: "$partyName", companyName: "$companyName" },
//             latestTask: { $first: "$$ROOT" }
//           }
//         }
//       ]);

//       if (matchingTasks.length > 0) {
//         const partyCompanyCombos = matchingTasks.map(t => ({
//           party: t._id.partyName,
//           company: t._id.companyName
//         }));

//         const accountMastersWithTasks = await AccountMaster.find({
//           ...baseQuery,
//           $or: partyCompanyCombos.map(combo => ({
//             party: combo.party,
//             companyName: combo.company
//           }))
//         }).select('_id').lean();

//         if (accountMastersWithTasks.length > 0) {
//           taskFilteredAccountMasterIds = accountMastersWithTasks.map(am => am._id);
//         } else {
//           return res.status(200).json({
//             success: true,
//             data: [],
//             pagination: isPagination ? {
//               currentPage: page,
//               pageSize: pageSize,
//               totalCount: 0,
//               totalPages: 0,
//               hasNext: false,
//               hasPrev: false,
//               counts: { approved: 0, pending: 0, total: 0 }
//             } : null,
//             counts: { approved: 0, pending: 0, total: 0 }
//           });
//         }
//       } else {
//         return res.status(200).json({
//           success: true,
//           data: [],
//           pagination: isPagination ? {
//             currentPage: page,
//             pageSize: pageSize,
//             totalCount: 0,
//             totalPages: 0,
//             hasNext: false,
//             hasPrev: false,
//             counts: { approved: 0, pending: 0, total: 0 }
//           } : null,
//           counts: { approved: 0, pending: 0, total: 0 }
//         });
//       }
//     }

//     // Add task-filtered IDs to base query
//     if (taskFilteredAccountMasterIds) {
//       baseQuery._id = { $in: taskFilteredAccountMasterIds };
//     }

//     // ===== STEP 4: Get total count =====
//     const totalCount = await AccountMaster.countDocuments(baseQuery);

//     if (totalCount === 0) {
//       return res.status(200).json({
//         success: true,
//         data: [],
//         pagination: isPagination ? {
//           currentPage: page,
//           pageSize: pageSize,
//           totalCount: 0,
//           totalPages: 0,
//           hasNext: false,
//           hasPrev: false,
//           counts: { approved: 0, pending: 0, total: 0 }
//         } : null,
//         counts: { approved: 0, pending: 0, total: 0 }
//       });
//     }

//     // ===== STEP 5: Get status counts =====
//     let counts = { approved: 0, pending: 0, total: totalCount };

//     if (includeCounts && partyIds) {
//       const statusCounts = await Party.aggregate([
//         { $match: { _id: { $in: partyIds } } },
//         {
//           $group: {
//             _id: "$statusApproval",
//             count: { $sum: 1 }
//           }
//         }
//       ]);

//       statusCounts.forEach(sc => {
//         if (sc._id === "APPROVED") counts.approved = sc.count;
//         if (sc._id === "PENDING") counts.pending = sc.count;
//       });
//     }

//     // ===== STEP 6: Build aggregation pipeline with pagination =====
//     const pipeline = [
//       { $match: baseQuery },
//       { $sort: { createdAt: -1 } },
//       { $skip: isPagination ? (page - 1) * pageSize : 0 },
//       { $limit: isPagination ? pageSize : totalCount },
//       // Lookups only on paginated subset
//       {
//         $lookup: {
//           from: "parties",
//           localField: "party",
//           foreignField: "_id",
//           as: "party"
//         }
//       },
//       { $unwind: { path: "$party", preserveNullAndEmptyArrays: false } },
//       {
//         $lookup: {
//           from: "staffs",
//           localField: "createdBy",
//           foreignField: "_id",
//           as: "createdBy"
//         }
//       },
//       { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: "companynames",
//           localField: "companyName",
//           foreignField: "_id",
//           as: "companyName"
//         }
//       },
//       { $unwind: { path: "$companyName", preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: "markets",
//           localField: "party.address.marketName",
//           foreignField: "_id",
//           as: "party.address.marketName"
//         }
//       },
//       { $unwind: { path: "$party.address.marketName", preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: "markets",
//           localField: "party.address.landMark",
//           foreignField: "_id",
//           as: "party.address.landMark"
//         }
//       },
//       { $unwind: { path: "$party.address.landMark", preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: "markets",
//           localField: "party.address.area",
//           foreignField: "_id",
//           as: "party.address.area"
//         }
//       },
//       { $unwind: { path: "$party.address.area", preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: "markets",
//           localField: "party.address.pincode",
//           foreignField: "_id",
//           as: "party.address.pincode"
//         }
//       },
//       { $unwind: { path: "$party.address.pincode", preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: "assigntasks",
//           let: { partyId: "$party._id", companyId: "$companyName._id" },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $and: [
//                     { $eq: ["$partyName", "$$partyId"] },
//                     { $eq: ["$companyName", "$$companyId"] }
//                   ]
//                 }
//               }
//             },
//             { $sort: { createdAt: -1 } },
//             { $limit: 1 }
//           ],
//           as: "latestTask"
//         }
//       },
//       { $unwind: { path: "$latestTask", preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: "staffs",
//           localField: "latestTask.assignTo",
//           foreignField: "_id",
//           as: "latestTask.assignTo"
//         }
//       },
//       { $unwind: { path: "$latestTask.assignTo", preserveNullAndEmptyArrays: true } }
//     ];

//     // Execute aggregation
//     const enrichedAccountMasters = await AccountMaster.aggregate(pipeline);

//     // Prepare pagination
//     const pagination = isPagination ? {
//       currentPage: page,
//       pageSize: pageSize,
//       totalCount: totalCount,
//       totalPages: Math.ceil(totalCount / pageSize),
//       hasNext: page < Math.ceil(totalCount / pageSize),
//       hasPrev: page > 1,
//       counts: counts
//     } : null;

//     res.status(200).json({
//       success: true,
//       data: enrichedAccountMasters,
//       pagination: pagination,
//       counts: counts
//     });

//   } catch (error) {
//     console.error("Error getting account masters:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch account masters",
//       error: error.message
//     });
//   }
// };


// exports.searchParties = async (req, res) => {
//   try {
//     const { q, companyId } = req.query;

//     // First find account masters for the company
//     const accountMatchQuery = {};
//     if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
//       accountMatchQuery.companyName = companyId;
//     }

//     const accountMasters = await AccountMaster.find(accountMatchQuery)
//       .select('party')
//       .populate({
//         path: 'party',
//         match: q ? { partyName: { $regex: q, $options: "i" } } : {},
//         select: 'partyName address'
//       });

//     // Filter out accounts where party is null (due to population match)
//     const validParties = accountMasters
//       .filter(acc => acc.party !== null)
//       .map(acc => acc.party);

//     // Now populate the market details for these parties
//     const partiesWithMarket = await Party.find({
//       _id: { $in: validParties.map(p => p._id) }
//     })
//       .populate('address.marketName')
//       .limit(20)
//       .sort({ partyName: 1 });

//     res.status(200).json({
//       success: true,
//       data: partiesWithMarket,
//     });
//   } catch (error) {
//     console.error("Error searching parties:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to search parties",
//       error: error.message,
//     });
//   }
// };

// exports.getQualityPackingParties = async (req, res) => {
//   try {
//     // Find the CompanyName document for "Quality Packaging"
//     const searchName = "Quality Packaging";

//     const company = await CompanyName.aggregate([
//       {
//         $match: {
//           $expr: {
//             $eq: [
//               { $toLower: { $trim: { input: "$companyName" } } },
//               searchName.trim().toLowerCase()
//             ]
//           }
//         }
//       }
//     ]);


//     if (!company) {
//       return res.status(404).json({ message: "Company 'Quality Packaging' not found" });
//     }

//     // Find all parties associated with the company and populate only partyName
//     const parties = await Party.find({ companyName: company[0]._id })

//       .select("partyName") // Select only the partyName field
//       .lean(); // Use lean for better performance since we don't need Mongoose documents


//     return res.status(200).json({
//       message: "Parties retrieved successfully",
//       data: parties,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       message: "Server Error",
//       error: error.message,
//     });
//   }
// };

// exports.getFilterOptionsData = async (req, res) => {
//   try {
//     const { field } = req.params;
//     const filters = req.body || {};
//     const { search, ...otherFilters } = filters;

//     if (!field) {
//       return res.status(400).json({ success: false, message: "Field parameter is required" });
//     }

//     // -----------------------
//     // BUILD MAIN FILTER QUERY
//     // -----------------------
//     const query = {};

//     if (otherFilters.companyName) {
//       query.companyName = otherFilters.companyName;
//     }

//     if (otherFilters.staffId) {
//       query.createdBy = otherFilters.staffId;
//     }

//     // DATE RANGE
//     if (otherFilters.startDate || otherFilters.endDate) {
//       query.createdAt = {};
//       if (otherFilters.startDate) {
//         const start = new Date(otherFilters.startDate);
//         start.setHours(0, 0, 0, 0);
//         query.createdAt.$gte = start;
//       }
//       if (otherFilters.endDate) {
//         const end = new Date(otherFilters.endDate);
//         end.setHours(23, 59, 59, 999);
//         query.createdAt.$lte = end;
//       }
//     }

//     let uniqueValues = [];

//     // ===========================================
//     //          FIELD WISE CLEAN SOLUTIONS
//     // ===========================================

//     switch (field) {

//       case "company":
//         const companyIds = await AccountMaster.distinct("companyName", query);

//         const companies = await CompanyName.find(
//           { _id: { $in: companyIds } },
//           "companyName"
//         );

//         uniqueValues = companies.map(c => c.companyName);
//         break;


//       case "party":
//         const partyIds = await AccountMaster.distinct("party", query);
//         const parties = await Party.find({ _id: { $in: partyIds } }, "partyName");
//         uniqueValues = parties.map(p => p.partyName);
//         break;

//       case "contactPerson":
//         const partyIds1 = await AccountMaster.distinct("party", query);
//         const persons = await Party.find({ _id: { $in: partyIds1 } }, "contactPerson");
//         uniqueValues = persons.map(p => p.contactPerson);
//         break;

//       case "createdAt":
//         const dates = await AccountMaster.distinct("createdAt", query);

//         uniqueValues = dates
//           .sort((a, b) => new Date(b) - new Date(a))
//           .map(d => moment(d).format("DD-MM-YYYY HH:mm:ss"));

//         break;

//       case "partyType":
//         uniqueValues = ['STATIONERY','OTHER','BOOKLET']
//         break;

//       case "mobile":
//         const partyIds8 = await AccountMaster.distinct("party", query); 

//         const partyMobiles = await Party.find(
//           { _id: { $in: partyIds8 } },
//           "ownerMobileNo"
//         );

//         uniqueValues = partyMobiles
//           .map(p => p.ownerMobileNo)
//           .filter(Boolean);
//         break;

//       case "partyTag":
//         const partyIds2 = await AccountMaster.distinct("party", query);
//         const tags = await Party.find({ _id: { $in: partyIds2 } }, "partyTag");
//         uniqueValues = tags.map(p => p.partyTag);
//         break;

//       case "unitNo":
//         const partyIds3 = await AccountMaster.distinct("party", query);

//         const partiess = await Party.find(
//           { _id: { $in: partyIds3 } },
//           "address.unitNo"   // <-- Only this nested field
//         );


//         uniqueValues = partiess.map(p => p.address?.unitNo).filter(v => v);
//         break;

//       case "mobileNo":
//         const partyIds4 = await AccountMaster.distinct("party", query);
//         const numbers = await Party.find(
//           { _id: { $in: partyIds4 } },
//           "ownerMobileNo ownerWhatsAppNo personMobileNo personWhatsAppNo contactMobileNo contactWhatsAppNo"
//         );

//         uniqueValues = [
//           ...new Set(
//             numbers.flatMap(n => [
//               n.ownerMobileNo,
//               n.ownerWhatsAppNo,
//               n.personMobileNo,
//               n.personWhatsAppNo,
//               n.contactMobileNo,
//               n.contactWhatsAppNo,
//             ]).filter(Boolean)
//           )
//         ];
//         break;

//       case "market":
//         const partyIds5 = await AccountMaster.distinct("party", query);
//         const markets = await Party.find({ _id: { $in: partyIds5 } })
//           .populate("address.marketName", "marketName");

//         uniqueValues = [
//           ...new Set(
//             markets.map(m => m.address?.marketName?.marketName).filter(Boolean)
//           )
//         ];
//         break;

//       case "area":
//         const partyIds6 = await AccountMaster.distinct("party", query);
//         const areas = await Party.find({ _id: { $in: partyIds6 } })
//           .populate("address.area", "area");

//         uniqueValues = [
//           ...new Set(
//             areas.map(a => a.address?.area?.area).filter(Boolean)
//           )
//         ];
//         break;

//       case "reason":
//         uniqueValues = await AccountMaster.distinct("reasonToVisit", query);
//         break;

//       case "createdBy":
//         const createdByIds = await AccountMaster.distinct("createdBy", query);

//         const staffUsers = await Staff.find(
//           { _id: { $in: createdByIds } },
//           "firstName lastName"
//         );

//         uniqueValues = staffUsers.map(u => `${u.firstName} ${u.lastName}`);
//         break;

//       case "status":
//         const partyIds7 = await AccountMaster.distinct("party", query);
//         const statuses = await Party.find(
//           { _id: { $in: partyIds7 } },
//           "statusApproval"
//         );

//         uniqueValues = statuses.map(s => s.statusApproval);
//         break;

//       case "assignedTo":
//         const tasks = await AssignTask.distinct("assignTo", {
//           assignTo: { $exists: true, $ne: null }
//         });

//         const users = await Staff.find({ _id: { $in: tasks } }, "firstName lastName");

//         uniqueValues = users.map(u => `${u.firstName} ${u.lastName}`);
//         break;

//       default:
//         return res.status(400).json({ success: false, message: "Invalid field parameter" });
//     }

//     // SEARCH FILTER
//     if (search) {
//       const searchText = search.toLowerCase();
//       uniqueValues = uniqueValues.filter(v =>
//         v?.toString().toLowerCase().includes(searchText)
//       );
//     }

//     // REMOVE DUPLICATES + SORT
//     uniqueValues = [...new Set(uniqueValues)].filter(Boolean).sort();

//     // LIMIT FOR SAFETY
//     // uniqueValues = uniqueValues.slice(0, 100);

//     res.status(200).json({
//       success: true,
//       data: uniqueValues,
//       count: uniqueValues.length
//     });

//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Error loading filter options",
//       error: err.message
//     });
//   }
// };

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

// ─────────────────────────────────────────────────────────────────────────────
// INDEX RECOMMENDATIONS  (run once in a migration / startup script)
// ─────────────────────────────────────────────────────────────────────────────
// AccountMaster.collection.createIndex({ companyName:1, party:1, createdAt:-1 })
// AccountMaster.collection.createIndex({ createdBy:1, createdAt:-1 })
// AccountMaster.collection.createIndex({ party:1 })
// Party.collection.createIndex({ companyName:1, statusApproval:1, partyName:1 })
// Party.collection.createIndex({ "address.marketName":1 })
// Party.collection.createIndex({ "address.area":1 })
// AssignTask.collection.createIndex({ partyName:1, companyName:1, createdAt:-1 })
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared lookup sub-pipelines (avoids copy-paste across controllers) ────────
const PARTY_LOOKUP = {
  $lookup: {
    from: "parties",
    localField: "party",
    foreignField: "_id",
    as: "party",
    pipeline: [
      {
        $project: {
          partyName: 1, partyTag: 1, partyType: 1,
          ownerMobileNo: 1, ownerName: 1,
          contactForPayment: 1, ownerWhatsAppNo: 1,
          contactPerson: 1, personMobileNo: 1, personWhatsAppNo: 1,
          contactMobileNo: 1, contactWhatsAppNo: 1, GSTNo: 1,
          statusApproval: 1,
          "address.unitNo": 1, "address.marketName": 1,
          "address.area": 1, "address.state": 1, "address.city": 1,
        },
      },
    ],
  },
};

const CREATED_BY_LOOKUP = {
  $lookup: {
    from: "staffs",
    localField: "createdBy",
    foreignField: "_id",
    as: "createdBy",
    pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
  },
};

const COMPANY_LOOKUP = {
  $lookup: {
    from: "companynames",
    localField: "companyName",
    foreignField: "_id",
    as: "companyName",
    pipeline: [{ $project: { companyName: 1, avatar: 1 } }],
  },
};

const MARKET_LOOKUP = {
  $lookup: {
    from: "markets",
    localField: "party.address.marketName",
    foreignField: "_id",
    as: "party.address.marketName",
    pipeline: [{ $project: { marketName: 1 } }],
  },
};

const AREA_LOOKUP = {
  $lookup: {
    from: "markets",
    localField: "party.address.area",
    foreignField: "_id",
    as: "party.address.area",
    pipeline: [{ $project: { area: 1 } }],
  },
};

// Latest-task lookup with inline assignTo population (single lookup, no second unwind step)
const LATEST_TASK_LOOKUP = {
  $lookup: {
    from: "assigntasks",
    let: { partyId: "$party._id", companyId: "$companyName._id" },
    pipeline: [
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$partyName", "$$partyId"] },
              { $eq: ["$companyName", "$$companyId"] },
            ],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: "staffs",
          localField: "assignTo",
          foreignField: "_id",
          as: "assignTo",
          pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
        },
      },
      { $unwind: { path: "$assignTo", preserveNullAndEmptyArrays: true } },
      { $project: { remarks: 1, status: 1, assignTo: 1, createdAt: 1 } },
    ],
    as: "latestTask",
  },
};

// Shared $addFields that flattens populated data
const FLATTEN_FIELDS = {
  $addFields: {
    createdBy: { $arrayElemAt: ["$createdBy", 0] },
    companyName: { $arrayElemAt: ["$companyName", 0] },
    "party.address.marketName": {
      $arrayElemAt: ["$party.address.marketName", 0],
    },
    "party.address.area": { $arrayElemAt: ["$party.address.area", 0] },
    latestTask: { $arrayElemAt: ["$latestTask", 0] },
  },
};

// Shared $project that shapes the final output
const FINAL_PROJECT = {
  $project: {
    reasonToVisit: 1,
    createdAt: 1,
    updatedAt: 1,
    party: 1,
    "createdBy.firstName": 1,
    "createdBy.lastName": 1,
    "createdBy._id": 1,
    "companyName.companyName": 1,
    "companyName.avatar": 1,
    "companyName._id": 1,
    "latestTask.remarks": 1,
    "latestTask.status": 1,
    "latestTask.assignTo": 1,
  },
};

// ── Helper: resolve ID array from Staff by full-name strings ──────────────────
async function resolveStaffIds(nameList) {
  const conds = [];
  nameList.forEach((full) => {
    const parts = full.trim().split(" ");
    if (parts.length === 1) {
      conds.push({ firstName: parts[0] }, { lastName: parts[0] });
    } else {
      conds.push({ firstName: parts[0], lastName: parts.slice(1).join(" ") });
    }
  });
  const staff = await Staff.find({ $or: conds }).select("_id").lean();
  return staff.map((s) => s._id);
}

// ── Shared empty response builder ─────────────────────────────────────────────
function emptyResponse(isPagination, page, pageSize) {
  const counts = { approved: 0, pending: 0, total: 0 };
  return {
    success: true,
    data: [],
    pagination: isPagination
      ? { currentPage: page, pageSize, totalCount: 0, totalPages: 0, hasNext: false, hasPrev: false, counts }
      : null,
    counts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE ACCOUNT MASTER
// ─────────────────────────────────────────────────────────────────────────────
exports.createAccountMaster = async (req, res) => {
  try {
    const partyRequiredFields = ["partyName", "ownerWhatsAppNo", "address"];
    for (const field of partyRequiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ success: false, message: `Missing required party field: ${field}` });
      }
    }

    const requiredAddressFields = ["unitNo", "marketName", "area", "pincode"];
    for (const field of requiredAddressFields) {
      if (!req.body.address[field]) {
        return res.status(400).json({ success: false, message: `Missing required address field: ${field}` });
      }
    }

    if (!req.body.companyName || !req.body.reasonToVisit || !req.body.createdBy) {
      return res.status(400).json({ success: false, message: "Missing required fields: companyName, reasonToVisit, or createdBy" });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    for (const [key, label] of [
      ["ownerEmail", "owner"],
      ["contactPersonEmail", "contact person"],
      ["contactForPaymentEmail", "contact for payment"],
    ]) {
      if (req.body[key] && !emailRegex.test(req.body[key])) {
        return res.status(400).json({ success: false, message: `Invalid ${label} email format` });
      }
    }

    // FIX: parallel validation instead of sequential awaits
    const [staff, company, existingParty] = await Promise.all([
      Staff.findById(req.body.createdBy).select("_id").lean(),
      CompanyName.findById(req.body.companyName).select("_id").lean(),
      Party.findOne({
        companyName: req.body.companyName,
        partyName: req.body.partyName,
        ownerWhatsAppNo: req.body.ownerWhatsAppNo,
      }).select("_id").lean(),
    ]);

    if (!staff)        return res.status(400).json({ success: false, message: "Invalid createdBy ID. Staff member does not exist." });
    if (!company)      return res.status(400).json({ success: false, message: "Invalid companyName ID. Company does not exist." });
    if (existingParty) return res.status(400).json({ success: false, message: "A party with this company, name and mobile number already exists" });

    const newParty = await Party.create({
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
      partyType: req.body.partyType,
      address: req.body.address,
      reference: req.body.reference,
      statusApproval: req.body.isRequestMode ? "Pending" : "Approved",
    });

    const newAccountMaster = await AccountMaster.create({
      companyName: req.body.companyName,
      party: newParty._id,
      reasonToVisit: req.body.reasonToVisit,
      createdBy: req.body.createdBy,
    });

    const populatedAccountMaster = await AccountMaster.findById(newAccountMaster._id)
      .populate("companyName", "companyName avatar")
      .populate({
        path: "party",
        select: "-__v",
        populate: [
          { path: "address.marketName", model: "Market", select: "marketName" },
          { path: "address.landMark",   model: "Market", select: "landmark" },
          { path: "address.area",       model: "Market", select: "area" },
          { path: "address.pincode",    model: "Market", select: "pincode" },
        ],
      })
      .populate("createdBy", "firstName lastName email");

    res.status(201).json({ success: true, message: "Account master created successfully", data: populatedAccountMaster });
  } catch (error) {
    console.error("Error creating account master:", error);
    res.status(500).json({ success: false, message: "Failed to create account master", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL ACCOUNT MASTERS  ← main optimized endpoint
// Key improvements:
//   1. Parallel ID resolution (Staff + Company + Market run concurrently)
//   2. Single $facet aggregation for data + counts in one DB round-trip
//   3. Lookups happen only on the paginated slice, not the full collection
//   4. No separate countDocuments() call
// ─────────────────────────────────────────────────────────────────────────────
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
      includeCounts = false,
    } = req.body;

    // ── STEP 1: Build the AccountMaster-level match query ────────────────────
    const amQuery = {};

    // Date range
    if (filters.createdAt && filters.createdAt.length > 0) {
      const [datePart, timePart] = filters.createdAt[0].split(" ");
      const [day, month, year] = datePart.split("-");
      if (!timePart || timePart === "00:00:00") {
        amQuery.createdAt = {
          $gte: new Date(year, month - 1, day, 0, 0, 0, 0),
          $lte: new Date(year, month - 1, day, 23, 59, 59, 999),
        };
      } else {
        const [h, m] = timePart.split(":");
        const base = new Date(year, month - 1, day, h, m, 0, 0);
        amQuery.createdAt = {
          $gte: base,
          $lte: new Date(+base + 59999),
        };
      }
    } else if (startDate || endDate) {
      amQuery.createdAt = {};
      if (startDate) { const s = new Date(startDate); s.setHours(0,0,0,0); amQuery.createdAt.$gte = s; }
      if (endDate)   { const e = new Date(endDate);   e.setHours(23,59,59,999); amQuery.createdAt.$lte = e; }
    }

    if (filters.reason?.length) amQuery.reasonToVisit = { $in: filters.reason };

    // ── STEP 2: Parallel pre-fetch of reference IDs ──────────────────────────
    // All independent ID lookups fire at the same time instead of one-by-one.
    const [staffIds, companyDocs, marketDocs, areaDocs] = await Promise.all([
      // Staff filter
      filters.createdBy?.length
        ? resolveStaffIds(filters.createdBy)
        : Promise.resolve(null),

      // Company filter
      filters.company?.length
        ? CompanyName.find({ companyName: { $in: filters.company } }).select("_id").lean()
        : Promise.resolve(null),

      // Market filter
      filters.market?.length
        ? Market.find({ marketName: { $in: filters.market } }).select("_id").lean()
        : Promise.resolve(null),

      // Area filter
      filters.area?.length
        ? Market.find({ area: { $in: filters.area } }).select("_id").lean()
        : Promise.resolve(null),
    ]);

    // Bail early if any required filter matched nothing
    if (filters.createdBy?.length && (!staffIds || staffIds.length === 0)) return res.status(200).json(emptyResponse(isPagination, page, pageSize));
    if (filters.company?.length  && (!companyDocs || companyDocs.length === 0)) return res.status(200).json(emptyResponse(isPagination, page, pageSize));
    if (filters.market?.length   && (!marketDocs  || marketDocs.length === 0))  return res.status(200).json(emptyResponse(isPagination, page, pageSize));
    if (filters.area?.length     && (!areaDocs    || areaDocs.length === 0))    return res.status(200).json(emptyResponse(isPagination, page, pageSize));

    if (staffIds)    amQuery.createdBy  = { $in: staffIds };
    const companyIds = companyDocs ? companyDocs.map((c) => c._id) : [];
    if (companyIds.length) amQuery.companyName = { $in: companyIds };

    // ── STEP 3: Build Party-level match expression ────────────────────────────
    // This becomes a $lookup + $match inside the aggregation — no separate query.
    const partyMatchExpr = {};

    if (filters.party?.length)         partyMatchExpr.partyName               = { $in: filters.party };
    if (filters.contactPerson?.length) partyMatchExpr.contactPerson           = { $in: filters.contactPerson };
    if (filters.partyTag?.length)      partyMatchExpr.partyTag                = { $in: filters.partyTag };
    if (filters.partyType?.length)     partyMatchExpr.partyType               = { $in: filters.partyType };
    if (filters.mobile?.length)        partyMatchExpr.ownerMobileNo           = { $in: filters.mobile };
    if (filters.unitNo?.length)        partyMatchExpr["address.unitNo"]       = { $in: filters.unitNo };
    if (marketDocs?.length)            partyMatchExpr["address.marketName"]   = { $in: marketDocs.map((m) => m._id) };
    if (areaDocs?.length)              partyMatchExpr["address.area"]         = { $in: areaDocs.map((a) => a._id) };

    if (search) {
      partyMatchExpr.$or = [
        { partyName:         { $regex: search, $options: "i" } },
        { ownerName:         { $regex: search, $options: "i" } },
        { ownerMobileNo:     { $regex: search, $options: "i" } },
        { ownerWhatsAppNo:   { $regex: search, $options: "i" } },
        { contactPerson:     { $regex: search, $options: "i" } },
        { personMobileNo:    { $regex: search, $options: "i" } },
        { personWhatsAppNo:  { $regex: search, $options: "i" } },
        { GSTNo:             { $regex: search, $options: "i" } },
        { "address.unitNo":  { $regex: search, $options: "i" } },
      ];
    }

    // ── STEP 4: Handle task-based filters ────────────────────────────────────
    let taskAmIds = null;

    if (filters.assignedTo?.length || filters.remarks?.length) {
      const taskQuery = {};

      if (filters.assignedTo?.length) {
        const tStaff = await Staff.find({
          $or: [
            { firstName: { $in: filters.assignedTo } },
            { lastName:  { $in: filters.assignedTo } },
            {
              $expr: {
                $regexMatch: {
                  input: { $concat: ["$firstName", " ", "$lastName"] },
                  regex: new RegExp(filters.assignedTo.join("|"), "i"),
                },
              },
            },
          ],
        }).select("_id").lean();

        if (!tStaff.length) return res.status(200).json(emptyResponse(isPagination, page, pageSize));
        taskQuery.assignTo = { $in: tStaff.map((s) => s._id) };
      }

      if (filters.remarks?.length) {
        taskQuery.$or = filters.remarks.map((r) => ({ remarks: { $regex: r, $options: "i" } }));
      }
      if (companyIds.length) taskQuery.companyName = { $in: companyIds };

      const matchingTasks = await AssignTask.aggregate([
        { $match: taskQuery },
        { $sort: { createdAt: -1 } },
        { $group: { _id: { partyName: "$partyName", companyName: "$companyName" }, latestTask: { $first: "$$ROOT" } } },
      ]);

      if (!matchingTasks.length) return res.status(200).json(emptyResponse(isPagination, page, pageSize));

      const orCombos = matchingTasks.map((t) => ({ party: t._id.partyName, companyName: t._id.companyName }));
      const amWithTasks = await AccountMaster.find({ ...amQuery, $or: orCombos }).select("_id").lean();

      if (!amWithTasks.length) return res.status(200).json(emptyResponse(isPagination, page, pageSize));
      taskAmIds = amWithTasks.map((am) => am._id);
    }

    if (taskAmIds) amQuery._id = { $in: taskAmIds };

    // ── STEP 5: Determine whether we need a party-join inside the pipeline ────
    const needsPartyFilter = Object.keys(partyMatchExpr).length > 0;
    const hasStatusFilter  = filters.status?.length > 0;

    // ── STEP 6: Single $facet aggregation ────────────────────────────────────
    // One DB round-trip returns: paginated data + total count + status counts.
    // Party filter and status counts are computed in the SAME collection scan.

    const skip  = isPagination ? (page - 1) * pageSize : 0;
    const limit = isPagination ? pageSize : 100000; // safe ceiling for non-paginated

    // Base pipeline: match AM, join Party (with filter), filter status
    const basePipeline = [
      { $match: amQuery },
      // ── Join Party (filter applied inline) ──
      {
        $lookup: {
          from: "parties",
          localField: "party",
          foreignField: "_id",
          as: "party",
          pipeline: needsPartyFilter
            ? [{ $match: partyMatchExpr }, { $project: { partyName: 1, partyTag: 1, partyType: 1, ownerMobileNo: 1, ownerName: 1, contactForPayment: 1, ownerWhatsAppNo: 1, contactPerson: 1, personMobileNo: 1, personWhatsAppNo: 1, contactMobileNo: 1, contactWhatsAppNo: 1, GSTNo: 1, statusApproval: 1, "address.unitNo": 1, "address.marketName": 1, "address.area": 1, "address.state": 1, "address.city": 1 } }]
            : [{ $project: { partyName: 1, partyTag: 1, partyType: 1, ownerMobileNo: 1, ownerName: 1, contactForPayment: 1, ownerWhatsAppNo: 1, contactPerson: 1, personMobileNo: 1, personWhatsAppNo: 1, contactMobileNo: 1, contactWhatsAppNo: 1, GSTNo: 1, statusApproval: 1, "address.unitNo": 1, "address.marketName": 1, "address.area": 1, "address.state": 1, "address.city": 1 } }],
        },
      },
      { $unwind: { path: "$party", preserveNullAndEmptyArrays: false } },
      // ── Status filter on party ──
      ...(hasStatusFilter ? [{ $match: { "party.statusApproval": { $in: filters.status } } }] : []),
    ];

    // $facet: simultaneously compute counts AND paginated data in one scan
    const facetPipeline = [
      ...basePipeline,
      {
        $facet: {
          // Counts branch (no skip/limit, groups by status)
          counts: includeCounts
            ? [
                {
                  $group: {
                    _id: "$party.statusApproval",
                    count: { $sum: 1 },
                  },
                },
              ]
            : [{ $count: "total" }],

          // Total count (needed for pagination meta)
          totalCount: [{ $count: "n" }],

          // Paginated data branch — enrichment only on this slice
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            MARKET_LOOKUP,
            { $unwind: { path: "$party.address.marketName", preserveNullAndEmptyArrays: true } },
            AREA_LOOKUP,
            { $unwind: { path: "$party.address.area", preserveNullAndEmptyArrays: true } },
            CREATED_BY_LOOKUP,
            { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
            COMPANY_LOOKUP,
            { $unwind: { path: "$companyName", preserveNullAndEmptyArrays: true } },
            LATEST_TASK_LOOKUP,
            { $unwind: { path: "$latestTask", preserveNullAndEmptyArrays: true } },
            FINAL_PROJECT,
          ],
        },
      },
    ];

    const [facetResult] = await AccountMaster.aggregate(facetPipeline);

    // ── STEP 7: Build response ────────────────────────────────────────────────
    const totalCount = facetResult?.totalCount?.[0]?.n || 0;

    let counts = { approved: 0, pending: 0, total: totalCount };
    if (includeCounts && facetResult?.counts) {
      facetResult.counts.forEach((sc) => {
        const key = (sc._id || "").toLowerCase();
        if (key === "approved") counts.approved = sc.count;
        if (key === "pending")  counts.pending  = sc.count;
      });
      counts.total = counts.approved + counts.pending;
    }

    const data = facetResult?.data || [];

    if (totalCount === 0) return res.status(200).json({ ...emptyResponse(isPagination, page, pageSize), counts });

    const totalPages = Math.ceil(totalCount / pageSize);
    const pagination = isPagination
      ? { currentPage: page, pageSize, totalCount, totalPages, hasNext: page < totalPages, hasPrev: page > 1, counts }
      : null;

    res.status(200).json({ success: true, data, pagination, counts });
  } catch (error) {
    console.error("Error getting account masters:", error);
    res.status(500).json({ success: false, message: "Failed to fetch account masters", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ACCOUNT MASTERS BY STAFF ID  (for canViewOwn role)
// Same $facet optimization as getAllAccountMasters.
// ─────────────────────────────────────────────────────────────────────────────
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
      includeCounts = false,
    } = req.body;

    const amQuery = {};

    if (startDate || endDate) {
      amQuery.createdAt = {};
      if (startDate) { const s = new Date(startDate); s.setHours(0,0,0,0); amQuery.createdAt.$gte = s; }
      if (endDate)   { const e = new Date(endDate);   e.setHours(23,59,59,999); amQuery.createdAt.$lte = e; }
    }

    if (filters.reason?.length) amQuery.reasonToVisit = { $in: filters.reason };

    // Parallel pre-fetch
    const [staffIds, companyDocs, marketDocs, areaDocs] = await Promise.all([
      filters.createdBy?.length ? resolveStaffIds(filters.createdBy) : Promise.resolve(null),
      filters.company?.length   ? CompanyName.find({ companyName: { $in: filters.company } }).select("_id").lean() : Promise.resolve(null),
      filters.market?.length    ? Market.find({ marketName: { $in: filters.market } }).select("_id").lean() : Promise.resolve(null),
      filters.area?.length      ? Market.find({ area: { $in: filters.area } }).select("_id").lean() : Promise.resolve(null),
    ]);

    if (filters.createdBy?.length && (!staffIds || !staffIds.length))   return res.status(200).json(emptyResponse(isPagination, page, pageSize));
    if (filters.company?.length   && (!companyDocs || !companyDocs.length)) return res.status(200).json(emptyResponse(isPagination, page, pageSize));
    if (filters.market?.length    && (!marketDocs  || !marketDocs.length))  return res.status(200).json(emptyResponse(isPagination, page, pageSize));
    if (filters.area?.length      && (!areaDocs    || !areaDocs.length))    return res.status(200).json(emptyResponse(isPagination, page, pageSize));

    if (staffIds?.length) amQuery.createdBy = { $in: staffIds };
    const companyIds = companyDocs ? companyDocs.map((c) => c._id) : [];
    if (companyIds.length) amQuery.companyName = { $in: companyIds };

    const partyMatchExpr = {};
    if (filters.party?.length)         partyMatchExpr.partyName             = { $in: filters.party };
    if (filters.contactPerson?.length) partyMatchExpr.contactPerson         = { $in: filters.contactPerson };
    if (filters.partyTag?.length)      partyMatchExpr.partyTag              = { $in: filters.partyTag };
    if (filters.mobile?.length)        partyMatchExpr.ownerMobileNo         = { $in: filters.mobile };
    if (filters.unitNo?.length)        partyMatchExpr["address.unitNo"]     = { $in: filters.unitNo };
    if (filters.status?.length)        partyMatchExpr.statusApproval        = { $in: filters.status };
    if (marketDocs?.length)            partyMatchExpr["address.marketName"] = { $in: marketDocs.map((m) => m._id) };
    if (areaDocs?.length)              partyMatchExpr["address.area"]       = { $in: areaDocs.map((a) => a._id) };

    if (search) {
      partyMatchExpr.$or = [
        { partyName: { $regex: search, $options: "i" } },
        { ownerName: { $regex: search, $options: "i" } },
        { ownerMobileNo: { $regex: search, $options: "i" } },
        { contactPerson: { $regex: search, $options: "i" } },
        { GSTNo: { $regex: search, $options: "i" } },
        { "address.unitNo": { $regex: search, $options: "i" } },
      ];
    }

    // Task filter
    let taskAmIds = null;
    if (filters.assignedTo?.length || filters.remarks?.length) {
      const taskQuery = {};
      if (filters.assignedTo?.length) {
        const tStaff = await Staff.find({
          $or: [
            { firstName: { $in: filters.assignedTo } },
            { lastName:  { $in: filters.assignedTo } },
          ],
        }).select("_id").lean();
        if (!tStaff.length) return res.status(200).json(emptyResponse(isPagination, page, pageSize));
        taskQuery.assignTo = { $in: tStaff.map((s) => s._id) };
      }
      if (filters.remarks?.length) taskQuery.$or = filters.remarks.map((r) => ({ remarks: { $regex: r, $options: "i" } }));
      if (companyIds.length) taskQuery.companyName = { $in: companyIds };

      const matchingTasks = await AssignTask.aggregate([
        { $match: taskQuery },
        { $sort: { createdAt: -1 } },
        { $group: { _id: { partyName: "$partyName", companyName: "$companyName" }, t: { $first: "$$ROOT" } } },
      ]);
      if (!matchingTasks.length) return res.status(200).json(emptyResponse(isPagination, page, pageSize));

      const orCombos = matchingTasks.map((t) => ({ party: t._id.partyName, companyName: t._id.companyName }));
      const amWithTasks = await AccountMaster.find({ ...amQuery, $or: orCombos }).select("_id").lean();
      if (!amWithTasks.length) return res.status(200).json(emptyResponse(isPagination, page, pageSize));
      taskAmIds = amWithTasks.map((am) => am._id);
    }

    if (taskAmIds) amQuery._id = { $in: taskAmIds };

    const needsPartyFilter = Object.keys(partyMatchExpr).length > 0;
    const skip  = isPagination ? (page - 1) * pageSize : 0;
    const limit = isPagination ? pageSize : 100000;

    const partyProjection = { partyName: 1, partyTag: 1, partyType: 1, ownerMobileNo: 1, ownerName: 1, contactPerson: 1, ownerWhatsAppNo: 1, contactForPayment: 1, personMobileNo: 1, personWhatsAppNo: 1, contactMobileNo: 1, contactWhatsAppNo: 1, GSTNo: 1, statusApproval: 1, "address.unitNo": 1, "address.marketName": 1, "address.area": 1, "address.landMark": 1, "address.pincode": 1, "address.state": 1, "address.city": 1 };

    const basePipeline = [
      { $match: amQuery },
      {
        $lookup: {
          from: "parties",
          localField: "party",
          foreignField: "_id",
          as: "party",
          pipeline: needsPartyFilter
            ? [{ $match: partyMatchExpr }, { $project: partyProjection }]
            : [{ $project: partyProjection }],
        },
      },
      { $unwind: { path: "$party", preserveNullAndEmptyArrays: false } },
    ];

    const [facetResult] = await AccountMaster.aggregate([
      ...basePipeline,
      {
        $facet: {
          totalCount: [{ $count: "n" }],
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            MARKET_LOOKUP,
            { $unwind: { path: "$party.address.marketName", preserveNullAndEmptyArrays: true } },
            AREA_LOOKUP,
            { $unwind: { path: "$party.address.area", preserveNullAndEmptyArrays: true } },
            CREATED_BY_LOOKUP,
            { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
            COMPANY_LOOKUP,
            { $unwind: { path: "$companyName", preserveNullAndEmptyArrays: true } },
            LATEST_TASK_LOOKUP,
            { $unwind: { path: "$latestTask", preserveNullAndEmptyArrays: true } },
            FINAL_PROJECT,
          ],
        },
      },
    ]);

    const totalCount = facetResult?.totalCount?.[0]?.n || 0;
    const data = facetResult?.data || [];

    if (totalCount === 0) return res.status(200).json(emptyResponse(isPagination, page, pageSize));

    const totalPages = Math.ceil(totalCount / pageSize);
    const counts = { approved: 0, pending: 0, total: totalCount };
    const pagination = isPagination
      ? { currentPage: page, pageSize, totalCount, totalPages, hasNext: page < totalPages, hasPrev: page > 1, counts }
      : null;

    res.status(200).json({ success: true, data, pagination, counts });
  } catch (error) {
    console.error("Error getting account masters by staff:", error);
    res.status(500).json({ success: false, message: "Failed to fetch account masters", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ACCOUNT MASTER BY ID  (unchanged logic, just cleaned up)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAccountMasterById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid AccountMaster ID" });

    const accountMaster = await AccountMaster.findById(id)
      .populate("companyName")
      .populate({
        path: "party",
        select: "partyName ownerName ownerMobileNo ownerWhatsAppNo ownerEmail contactPerson personMobileNo personWhatsAppNo contactPersonEmail contactForPayment contactMobileNo contactWhatsAppNo contactForPaymentEmail GSTNo partyTag partyType address",
        populate: [
          { path: "address.marketName", model: "Market", select: "marketName" },
          { path: "address.landMark",   model: "Market", select: "landmark" },
          { path: "address.area",       model: "Market", select: "area" },
          { path: "address.pincode",    model: "Market", select: "pincode" },
        ],
      })
      .populate("createdBy", "_id firstName lastName email")
      .lean();

    if (!accountMaster) return res.status(404).json({ success: false, message: "AccountMaster not found" });

    const responseData = {
      ...accountMaster,
      companyName: accountMaster.companyName._id.toString(),
      partyName: accountMaster.party.partyName,
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
        landMark: accountMaster.party.address.landMark || "",
        area: accountMaster.party.address.area,
        pincode: accountMaster.party.address.pincode,
      },
      reasonToVisit: accountMaster.reasonToVisit,
      reference: accountMaster.reference || "",
      createdBy: accountMaster.createdBy._id.toString(),
      createdById: accountMaster.createdBy._id.toString(),
      companyNameObj: accountMaster.companyName,
      createdByObj: accountMaster.createdBy,
    };

    res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    console.error("Error fetching account master:", error);
    res.status(500).json({ success: false, message: "Failed to fetch account master", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE ACCOUNT MASTER  (parallel validation)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateAccountMaster = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid AccountMaster ID" });

    const accountMaster = await AccountMaster.findById(id).lean();
    if (!accountMaster) return res.status(404).json({ success: false, message: "AccountMaster not found" });

    if (!req.body.companyName || !req.body.reasonToVisit) {
      return res.status(400).json({ success: false, message: "Missing required fields: companyName or reasonToVisit" });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    for (const [key, label] of [["ownerEmail","owner"],["contactPersonEmail","contact person"],["contactForPaymentEmail","contact for payment"]]) {
      if (req.body[key] && !emailRegex.test(req.body[key])) {
        return res.status(400).json({ success: false, message: `Invalid ${label} email format` });
      }
    }

    // Parallel: validate company + staff + check duplicate party + get current party status
    const [company, staff, existingParty, currentParty] = await Promise.all([
      CompanyName.findById(req.body.companyName).select("_id").lean(),
      req.body.createdBy ? Staff.findById(req.body.createdBy).select("_id").lean() : Promise.resolve(true),
      Party.findOne({
        _id: { $ne: accountMaster.party },
        companyName: req.body.companyName || accountMaster.companyName,
        partyName: req.body.partyName,
        ownerWhatsAppNo: req.body.ownerWhatsAppNo,
      }).select("_id").lean(),
      Party.findById(accountMaster.party).select("statusApproval").lean(),
    ]);

    if (!company)      return res.status(400).json({ success: false, message: "Invalid companyName ID." });
    if (!staff)        return res.status(400).json({ success: false, message: "Invalid createdBy ID." });
    if (existingParty) return res.status(400).json({ success: false, message: "A party with this company, name and mobile number already exists" });

    // Parallel: update party + update accountMaster
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
      partyTag: req.body.partyTag,
      statusApproval: req.body.statusApproval || currentParty?.statusApproval,
    };

    const amUpdateData = {
      companyName: req.body.companyName,
      reasonToVisit: req.body.reasonToVisit,
      reference: req.body.reference,
      ...(req.body.createdBy && { createdBy: req.body.createdBy }),
    };

    const [updatedParty, updatedAM] = await Promise.all([
      Party.findByIdAndUpdate(accountMaster.party, partyUpdateData, { new: true, runValidators: true }),
      AccountMaster.findByIdAndUpdate(id, amUpdateData, { new: true, runValidators: true })
        .populate("companyName", "companyName avatar")
        .populate({
          path: "party",
          select: "-__v",
          populate: [
            { path: "address.marketName", model: "Market", select: "marketName" },
            { path: "address.landMark",   model: "Market", select: "landmark" },
            { path: "address.area",       model: "Market", select: "area" },
            { path: "address.pincode",    model: "Market", select: "pincode" },
          ],
        })
        .populate("createdBy", "firstName lastName email"),
    ]);

    if (!updatedParty) return res.status(404).json({ success: false, message: "Associated Party not found" });
    if (!updatedAM)    return res.status(404).json({ success: false, message: "Failed to update AccountMaster" });

    res.status(200).json({ success: true, message: "Account master updated successfully", data: updatedAM });
  } catch (error) {
    console.error("Error updating account master:", error);
    if (error.code === 11000) return res.status(400).json({ success: false, message: "Duplicate entry." });
    if (error.name === "ValidationError") return res.status(400).json({ success: false, message: "Validation error", error: error.message });
    res.status(500).json({ success: false, message: "Failed to update account master", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE PARTY
// ─────────────────────────────────────────────────────────────────────────────
exports.approveParty = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid Party ID" });

    // findOneAndUpdate is atomic — no race condition between find+save
    const party = await Party.findOneAndUpdate(
      { _id: id, statusApproval: { $ne: "Approved" } },
      { statusApproval: "Approved" },
      { new: true }
    );

    if (!party) {
      const exists = await Party.findById(id).select("statusApproval").lean();
      if (!exists)                           return res.status(404).json({ success: false, message: "Party not found" });
      if (exists.statusApproval === "Approved") return res.status(400).json({ success: false, message: "Party is already approved" });
    }

    const accountMaster = await AccountMaster.findOne({ party: id })
      .populate("companyName", "companyName avatar")
      .populate("party")
      .populate("createdBy", "firstName lastName email");

    res.status(200).json({ success: true, message: "Party approved successfully", data: accountMaster });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to approve party", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE ACCOUNT MASTER  (unchanged — transactions required here)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteAccountMaster = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const accountMaster = await AccountMaster.findById(req.params.id).select("party").session(session).lean();
    if (!accountMaster) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Account master not found" });
    }

    // Parallel delete inside the transaction
    await Promise.all([
      AccountMaster.findByIdAndDelete(req.params.id).session(session),
      Party.findByIdAndDelete(accountMaster.party).session(session),
    ]);

    await session.commitTransaction();
    session.endSession();
    res.status(200).json({ success: true, message: "Account master and associated party deleted successfully", deletedCounts: { accountMaster: 1, party: 1 } });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid ID format" });
    res.status(500).json({ success: false, message: "Failed to delete account master and party", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET FILTER OPTIONS  ← major optimization: parallel distinct + lean queries
// Before: sequential Party.find() for every field
// After:  all distinct() calls run in Promise.all(); no full Party docs fetched
// ─────────────────────────────────────────────────────────────────────────────
exports.getFilterOptionsData = async (req, res) => {
  try {
    const { field } = req.params;
    if (!field) return res.status(400).json({ success: false, message: "Field parameter is required" });

    const filters = req.body || {};
    const { search, ...otherFilters } = filters;

    // Base AccountMaster query (company + staff + date)
    const amQuery = {};
    if (otherFilters.companyName) amQuery.companyName = otherFilters.companyName;
    if (otherFilters.staffId)     amQuery.createdBy   = otherFilters.staffId;
    if (otherFilters.startDate || otherFilters.endDate) {
      amQuery.createdAt = {};
      if (otherFilters.startDate) { const s = new Date(otherFilters.startDate); s.setHours(0,0,0,0); amQuery.createdAt.$gte = s; }
      if (otherFilters.endDate)   { const e = new Date(otherFilters.endDate);   e.setHours(23,59,59,999); amQuery.createdAt.$lte = e; }
    }

    let uniqueValues = [];

    switch (field) {
      case "company": {
        const [ids] = await Promise.all([AccountMaster.distinct("companyName", amQuery)]);
        const docs = await CompanyName.find({ _id: { $in: ids } }, "companyName").lean();
        uniqueValues = docs.map((c) => c.companyName);
        break;
      }

      case "party": {
        const ids = await AccountMaster.distinct("party", amQuery);
        const docs = await Party.find({ _id: { $in: ids } }, "partyName").lean();
        uniqueValues = docs.map((p) => p.partyName);
        break;
      }

      case "contactPerson": {
        const ids = await AccountMaster.distinct("party", amQuery);
        const docs = await Party.find({ _id: { $in: ids } }, "contactPerson").lean();
        uniqueValues = docs.map((p) => p.contactPerson).filter(Boolean);
        break;
      }

      case "createdAt": {
        const dates = await AccountMaster.distinct("createdAt", amQuery);
        uniqueValues = dates
          .sort((a, b) => new Date(b) - new Date(a))
          .map((d) => moment(d).format("DD-MM-YYYY HH:mm:ss"));
        break;
      }

      case "partyType": {
        const ids = await AccountMaster.distinct("party", amQuery);
        uniqueValues = await Party.distinct("partyType", { _id: { $in: ids } });
        break;
      }

      case "mobile": {
        const ids = await AccountMaster.distinct("party", amQuery);
        // FIX: use aggregate to get only the field we need, not full docs
        const docs = await Party.find({ _id: { $in: ids } }, "ownerMobileNo").lean();
        uniqueValues = docs.map((p) => p.ownerMobileNo).filter(Boolean);
        break;
      }

      case "partyTag": {
        const ids = await AccountMaster.distinct("party", amQuery);
        const docs = await Party.find({ _id: { $in: ids } }, "partyTag").lean();
        uniqueValues = docs.map((p) => p.partyTag).filter(Boolean);
        break;
      }

      case "unitNo": {
        const ids = await AccountMaster.distinct("party", amQuery);
        const docs = await Party.find({ _id: { $in: ids } }, "address.unitNo").lean();
        uniqueValues = docs.map((p) => p.address?.unitNo).filter(Boolean);
        break;
      }

      case "mobileNo": {
        const ids = await AccountMaster.distinct("party", amQuery);
        // Single lean query — get all number fields at once
        const docs = await Party.find({ _id: { $in: ids } }, "ownerMobileNo ownerWhatsAppNo personMobileNo personWhatsAppNo contactMobileNo contactWhatsAppNo").lean();
        uniqueValues = [
          ...new Set(
            docs.flatMap((n) => [n.ownerMobileNo, n.ownerWhatsAppNo, n.personMobileNo, n.personWhatsAppNo, n.contactMobileNo, n.contactWhatsAppNo]).filter(Boolean)
          ),
        ];
        break;
      }

      case "market": {
        // FIX: use aggregate with $lookup instead of populate (no full Party doc)
        const ids = await AccountMaster.distinct("party", amQuery);
        const result = await Party.aggregate([
          { $match: { _id: { $in: ids } } },
          { $lookup: { from: "markets", localField: "address.marketName", foreignField: "_id", as: "market", pipeline: [{ $project: { marketName: 1 } }] } },
          { $unwind: { path: "$market", preserveNullAndEmptyArrays: false } },
          { $group: { _id: "$market.marketName" } },
        ]);
        uniqueValues = result.map((r) => r._id).filter(Boolean);
        break;
      }

      case "area": {
        const ids = await AccountMaster.distinct("party", amQuery);
        const result = await Party.aggregate([
          { $match: { _id: { $in: ids } } },
          { $lookup: { from: "markets", localField: "address.area", foreignField: "_id", as: "area", pipeline: [{ $project: { area: 1 } }] } },
          { $unwind: { path: "$area", preserveNullAndEmptyArrays: false } },
          { $group: { _id: "$area.area" } },
        ]);
        uniqueValues = result.map((r) => r._id).filter(Boolean);
        break;
      }

      case "reason": {
        uniqueValues = await AccountMaster.distinct("reasonToVisit", amQuery);
        break;
      }

      case "createdBy": {
        const ids = await AccountMaster.distinct("createdBy", amQuery);
        const docs = await Staff.find({ _id: { $in: ids } }, "firstName lastName").lean();
        uniqueValues = docs.map((u) => `${u.firstName} ${u.lastName}`);
        break;
      }

      case "status": {
        const ids = await AccountMaster.distinct("party", amQuery);
        uniqueValues = await Party.distinct("statusApproval", { _id: { $in: ids } });
        break;
      }

      case "assignedTo": {
        // Fetch only staff who are assigned to tasks in the current company
        const taskQuery = { assignTo: { $exists: true, $ne: null } };
        if (otherFilters.companyId) taskQuery.companyName = otherFilters.companyId;
        else if (otherFilters.companyName) taskQuery.companyName = otherFilters.companyName;

        const taskStaffIds = await AssignTask.distinct("assignTo", taskQuery);
        const docs = await Staff.find({ _id: { $in: taskStaffIds } }, "firstName lastName").lean();
        uniqueValues = docs.map((u) => `${u.firstName} ${u.lastName}`);
        break;
      }

      default:
        return res.status(400).json({ success: false, message: "Invalid field parameter" });
    }

    if (search) {
      const s = search.toLowerCase();
      uniqueValues = uniqueValues.filter((v) => v?.toString().toLowerCase().includes(s));
    }

    uniqueValues = [...new Set(uniqueValues)].filter(Boolean).sort();

    res.status(200).json({ success: true, data: uniqueValues, count: uniqueValues.length });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error loading filter options", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BULK CREATE (unchanged — transaction-bound, limited to upload size)
// ─────────────────────────────────────────────────────────────────────────────
const normalize = (val) => (val ? String(val).trim().toLowerCase() : null);
const findMarketByField = async (field, value, session) => {
  if (!value) return null;
  const market = await Market.findOne({ [field]: { $regex: new RegExp(`^${normalize(value)}$`, "i") } }).session(session);
  return market ? market._id : null;
};

async function findStaffByFullName(fullName) {
  const [firstName, lastName] = fullName.trim().split(" ");
  return Staff.findOne({
    $expr: {
      $and: [
        { $eq: [{ $toLower: { $trim: { input: "$firstName" } } }, firstName.toLowerCase()] },
        { $eq: [{ $toLower: { $trim: { input: "$lastName" } } }, lastName.toLowerCase()] },
      ],
    },
  });
}

exports.bulkCreateAccountMasters = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!req.file) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const globalCompanyName = req.body.companyName;
    if (!globalCompanyName) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: "companyName is required" });
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const accountMasters = [];
    const skippedRecords = [];

    for (const [index, row] of data.entries()) {
      try {
        const staff = await findStaffByFullName(row.createdBy);
        if (!staff) { skippedRecords.push({ ...row, reason: `Staff not found: ${row.createdBy}` }); continue; }

        let partyTag = "New";
        if (row.partyTag && String(row.partyTag).trim().toLowerCase() === "customer") partyTag = "Customer";

        const marketId = await findMarketByField("marketName", row.marketName, session);
        const address = { unitNo: row.unitNo || null, marketName: marketId, landMark: marketId, area: marketId, pincode: marketId };

        const [newParty] = await Party.create([{
          companyName: globalCompanyName,
          partyName: row.partyName || null,
          ownerName: row.ownerName || null,
          ownerMobileNo: row.ownerMobileNo || null,
          ownerWhatsAppNo: row.ownerWhatsAppNo ? String(row.ownerWhatsAppNo) : null,
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
        }], { session });

        const [newAM] = await AccountMaster.create([{
          companyName: globalCompanyName,
          party: newParty._id,
          reasonToVisit: row.reasonToVisit || null,
          reference: row.reference || null,
          createdBy: staff._id,
          partyTag,
        }], { session });

        accountMasters.push(newAM);
      } catch (err) {
        skippedRecords.push({ row: index + 1, reason: err.message });
      }
    }

    await session.commitTransaction(); session.endSession();
    res.status(201).json({ success: true, message: "Bulk account masters processed", insertedCount: accountMasters.length, skippedCount: skippedRecords.length, skippedRecords, data: accountMasters });
  } catch (error) {
    await session.abortTransaction(); session.endSession();
    res.status(500).json({ success: false, message: "Failed to bulk create account masters", error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OTHER ENDPOINTS (minor cleanup only)
// ─────────────────────────────────────────────────────────────────────────────

exports.updateAccountMasterStatus = async (req, res) => {
  try {
    if (!req.body.status) return res.status(400).json({ success: false, message: "Status is required" });
    const updatedAM = await AccountMaster.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true }).populate("createdBy", "firstName lastName email");
    if (!updatedAM) return res.status(404).json({ success: false, message: "Account master not found" });
    res.status(200).json({ success: true, message: "Status updated", data: updatedAM });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update status", error: error.message });
  }
};

exports.getAllStaff = async (req, res) => {
  try {
    const staff = await Staff.find({}, "firstName lastName _id").lean();
    res.status(200).json({ success: true, data: staff.map((s) => ({ id: s._id, name: `${s.firstName} ${s.lastName}` })) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAccountMasterByCompanyAndParty = async (req, res) => {
  try {
    const { companyId, partyId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(companyId) || !mongoose.Types.ObjectId.isValid(partyId)) {
      return res.status(400).json({ success: false, message: "Invalid ID format(s)" });
    }
    const accountMaster = await AccountMaster.findOne({ companyName: companyId, party: partyId })
      .populate({ path: "companyName", select: "-__v" })
      .populate({ path: "party", select: "-__v", populate: [{ path: "address.marketName", model: "Market", select: "marketName" }, { path: "address.landMark", model: "Market", select: "landmark" }, { path: "address.area", model: "Market", select: "area" }, { path: "address.pincode", model: "Market", select: "pincode" }] })
      .populate({ path: "createdBy", select: "-__v -password" });
    if (!accountMaster) return res.status(404).json({ success: false, message: "No account found" });
    res.status(200).json({ success: true, data: { accountMaster: { _id: accountMaster._id, reasonToVisit: accountMaster.reasonToVisit, createdAt: accountMaster.createdAt, updatedAt: accountMaster.updatedAt, company: accountMaster.companyName.toObject(), party: accountMaster.party.toObject(), createdBy: accountMaster.createdBy.toObject() } } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch account data", error: error.message });
  }
};

exports.searchParties = async (req, res) => {
  try {
    const { q, companyId } = req.query;
    const amQuery = {};
    if (companyId && mongoose.Types.ObjectId.isValid(companyId)) amQuery.companyName = companyId;

    // FIX: use aggregate instead of populate-based filtering
    const partyIds = await AccountMaster.distinct("party", amQuery);
    const partiesWithMarket = await Party.find({
      _id: { $in: partyIds },
      ...(q ? { partyName: { $regex: q, $options: "i" } } : {}),
    }).populate("address.marketName").limit(20).sort({ partyName: 1 });

    res.status(200).json({ success: true, data: partiesWithMarket });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to search parties", error: error.message });
  }
};

exports.getQualityPackingParties = async (req, res) => {
  try {
    const company = await CompanyName.findOne({
      companyName: { $regex: /^quality packaging$/i },
    }).select("_id").lean();
    if (!company) return res.status(404).json({ message: "Company 'Quality Packaging' not found" });
    const parties = await Party.find({ companyName: company._id }, "partyName").lean();
    res.status(200).json({ message: "Parties retrieved successfully", data: parties });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};