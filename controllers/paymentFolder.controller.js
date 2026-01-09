const mongoose = require("mongoose");
const PaymentFolder = require("../models/paymentFolder.model");
const AssignTask = require("../models/assignTask.model")
const Company = require("../models/companyName.model");
const Party = require("../models/Party.model");
const Staff = require("../models/staff.model");
exports.createPaymentFolder = async (req, res) => {
  try {
    const {
      company,
      party,
      assignedTo,
      assignedDate,
      remarks,
      paymentType,
      month,
      paymentAmount,
      area,
      paymentTerms,
      receivedAmount = 0
    } = req.body;

    const pendingAmount = paymentAmount - receivedAmount;

    // First create the assign task
    const newAssignTask = new AssignTask({
      companyName: company,
      partyName: party,
      date: new Date(assignedDate),
      time: assignedDate,
      reasonForVisit: "Get Payment",
      remarks: remarks || "",
      assignTo: assignedTo,
      status: "Pending",
      visitDate: req.body.visitDate ? new Date(req.body.visitDate) : null,
      visitTime: req.body.visitTime || "",
      feedback: req.body.feedback || "",
      isRescheduledTask: req.body.isRescheduledTask || false,
      originalTaskId: req.body.originalTaskId || null,
    });

    const savedAssignTask = await newAssignTask.save();

    // Now create payment folder with assignTask ID
    const data = await PaymentFolder.create({
      company,
      party,
      assignedTo,
      assignedDate,
      remarks,
      paymentType,
      month,
      paymentAmount,
      area,
      paymentTerms,
      receivedAmount,
      pendingAmount,
      assignTask: savedAssignTask._id, // Store the assign task ID
    });

    const newData = await PaymentFolder.findById(data._id)
      .populate("company")
      .populate({
        path: "party",
        select: "-__v",
        populate: [
          {
            path: "address.marketName",
            model: "Market",
            select: "marketName",
          },
          {
            path: "address.landMark",
            model: "Market",
            select: "landmark",
          },
          {
            path: "address.area",
            model: "Market",
            select: "area",
          },
          {
            path: "address.pincode",
            model: "Market",
            select: "pincode",
          },
        ],
      })
      .populate("assignedTo", "firstName lastName email")
      .populate("assignTask") // Populate assign task as well
      .populate({
        path: "payments.receivedBy",
        select: "firstName lastName",
      })
      .sort({ createdAt: -1 });

    res.status(201).json({
      message: "Payment Folder Created Successfully",
      newData
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.getPaymentFolders = async (req, res) => {
  try {
    const {
      filters = {},
      search = "",
      startDate,
      endDate,
      isPagination = true,
      page = 1,
      pageSize = 10,
      includeCounts = true
    } = req.body;

    // Build query object
    const query = {};

    // Helper function to build multi-word search conditions
    const buildMultiWordSearch = (searchStr, fields) => {
      if (!searchStr || !searchStr.trim()) return [];
      const parts = searchStr.trim().split(/\s+/).filter(p => p.length > 0);
      if (parts.length === 0) return [];

      const partConditions = parts.map(part => ({
        $or: fields.map(field => ({
          [field]: { $regex: part, $options: "i" }
        }))
      }));

      if (parts.length === 1) {
        return partConditions[0].$or;
      } else {
        return [{ $and: partConditions }];
      }
    };

    // Search functionality
    if (search && search.trim()) {
      const directOr = [
        { remarks: { $regex: search, $options: "i" } },
        { month: { $regex: search, $options: "i" } },
        { area: { $regex: search, $options: "i" } },
      ];

      // Company search with multi-word support
      const companyFields = ['companyName'];
      const companyConditions = buildMultiWordSearch(search, companyFields);
      if (companyConditions.length > 0) {
        const matchingCompanies = await Company.find({
          $or: companyConditions
        }).select('_id').lean();
        const companyIds = matchingCompanies.map(c => c._id);
        if (companyIds.length > 0) {
          directOr.push({ company: { $in: companyIds } });
        }
      }

      // Party search with multi-word support
      const partyFields = ['partyName'];
      const partyConditions = buildMultiWordSearch(search, partyFields);
      if (partyConditions.length > 0) {
        const matchingParties = await Party.find({
          $or: partyConditions
        }).select('_id').lean();
        const partyIds = matchingParties.map(p => p._id);
        if (partyIds.length > 0) {
          directOr.push({ party: { $in: partyIds } });
        }
      }

      // Assigned to (Staff) search with multi-word support
      const staffFields = ['firstName', 'lastName', 'email'];
      const staffConditions = buildMultiWordSearch(search, staffFields);
      if (staffConditions.length > 0) {
        const matchingStaff = await Staff.find({
          $or: staffConditions
        }).select('_id').lean();
        const staffIds = matchingStaff.map(s => s._id);
        if (staffIds.length > 0) {
          directOr.push({ assignedTo: { $in: staffIds } });
        }
      }

      if (directOr.length > 0) {
        query.$or = directOr;
      }
    }

    // AssignedDate filter - Match exact dates from array
    if (filters.assignedDate && Array.isArray(filters.assignedDate) && filters.assignedDate.length > 0) {
      // Filter out null/empty values
      const validDates = filters.assignedDate.filter(d => d && d !== 'null');
      
      if (validDates.length > 0) {
        // Create date range conditions for each date (match full day)
        const dateConditions = validDates.map(dateStr => {
          const startOfDay = new Date(dateStr);
          startOfDay.setHours(0, 0, 0, 0);
          
          const endOfDay = new Date(dateStr);
          endOfDay.setHours(23, 59, 59, 999);
          
          return {
            assignedDate: {
              $gte: startOfDay,
              $lte: endOfDay
            }
          };
        });
        
        // Use $or to match any of the dates
        if (dateConditions.length === 1) {
          query.assignedDate = dateConditions[0].assignedDate;
        } else {
          query.$or = query.$or 
            ? [...query.$or, ...dateConditions]
            : dateConditions;
        }
      }
    }
    
    // Top-level startDate/endDate (for date range if needed separately)
    if ((startDate || endDate) && (!filters.assignedDate || filters.assignedDate.length === 0)) {
      query.assignedDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.assignedDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.assignedDate.$lte = end;
      }
    }

    // Company filter
    if (filters.company && filters.company.length > 0) {
      const companies = await Company.find({
        companyName: { $in: filters.company }
      }).select('_id').lean();
      if (companies.length > 0) {
        query.company = { $in: companies.map(c => c._id) };
      }
    }

    // Party filter
    if (filters.party && filters.party.length > 0) {
      const parties = await Party.find({
        partyName: { $in: filters.party }
      }).select('_id').lean();
      if (parties.length > 0) {
        query.party = { $in: parties.map(p => p._id) };
      }
    }

    // Area filter
    if (filters.area && filters.area.length > 0) {
      query.area = { $in: filters.area };
    }

    // Month filter
    if (filters.month && filters.month.length > 0) {
      query.month = { $in: filters.month };
    }
    
    // Remarks filter
    if (filters.remarks && filters.remarks.length > 0) {
      query.remarks = { $in: filters.remarks };
    }

    // Assigned to filter
    if (filters.assignTo && filters.assignTo.length > 0) {
      const nameConditions = filters.assignTo.map(name => {
        const parts = name.split(' ');
        if (parts.length === 2) {
          return {
            firstName: { $regex: `^${parts[0]}`, $options: "i" },
            lastName: { $regex: `^${parts[1]}`, $options: "i" }
          };
        } else {
          return {
            $or: [
              { firstName: { $regex: `^${name}`, $options: "i" } },
              { lastName: { $regex: `^${name}`, $options: "i" } }
            ]
          };
        }
      });
      const matchingStaff = await Staff.find({
        $or: nameConditions
      }).select('_id').lean();

      if (matchingStaff.length > 0) {
        query.assignedTo = { $in: matchingStaff.map(s => s._id) };
      }
    }

    // Payment amount range filter
    if (filters.paymentAmount && (filters.paymentAmount.min !== undefined || filters.paymentAmount.max !== undefined)) {
      query.paymentAmount = {};
      if (filters.paymentAmount.min !== undefined) {
        query.paymentAmount.$gte = filters.paymentAmount.min;
      }
      if (filters.paymentAmount.max !== undefined) {
        query.paymentAmount.$lte = filters.paymentAmount.max;
      }
    }

    // Debug: Log the final query
    console.log("🔍 Final Query:", JSON.stringify(query, null, 2));

    // Get total count
    const totalCount = await PaymentFolder.countDocuments(query);

    // Common populate options
    const commonPopulate = [
      { path: "company", select: "companyName" },
      {
        path: "party",
        select: "-__v",
        populate: [
          {
            path: "address.marketName",
            model: "Market",
            select: "marketName",
          },
          {
            path: "address.landMark",
            model: "Market",
            select: "landmark",
          },
          {
            path: "address.area",
            model: "Market",
            select: "area",
          },
          {
            path: "address.pincode",
            model: "Market",
            select: "pincode",
          },
        ],
      },
      { path: "assignedTo", select: "firstName lastName email" },
      { path: "assignTask", select: "date time reasonForVisit remarks status" },
      {
        path: "payments.receivedBy",
        select: "firstName lastName",
      }
    ];

    let data = [];
    if (isPagination) {
      // PAGINATED: Apply skip/limit
      const skip = (page - 1) * pageSize;
      data = await PaymentFolder.find(query)
        .skip(skip)
        .limit(pageSize)
        .populate(commonPopulate)
        .sort({ createdAt: -1 });
    } else {
      // NON-PAGINATED: Fetch all data
      data = await PaymentFolder.find(query)
        .populate(commonPopulate)
        .sort({ createdAt: -1 });
    }

    // Prepare response
    const pagination = isPagination ? {
      currentPage: parseInt(page),
      pageSize: parseInt(pageSize),
      totalCount: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      hasNext: page < Math.ceil(totalCount / pageSize),
      hasPrev: page > 1,
    } : null;

    res.status(200).json({
      success: true,
      data: data,
      pagination: pagination,
      totalCount: totalCount,
      message: "Payment folders fetched successfully"
    });
  } catch (error) {
    console.error("❌ Error fetching payment folders:", error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment folders: ' + error.message,
    });
  }
};

// ====================== GET PAYMENT FOLDER FILTER OPTIONS ======================
exports.getPaymentFolderFilterOptions = async (req, res) => {
  try {
    const { field } = req.params;
    const filters = req.body || {};
    const { search = "", ...otherFilters } = filters;
    if (!field) {
      return res.status(400).json({
        success: false,
        message: "Field parameter is required"
      });
    }

    const validFields = ['company', 'party', 'area', 'month', 'assignTo', 'paymentAmount', 'receivedAmount', 'pendingAmount', 'assignedDate', 'remarks'];

    if (!validFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: `Invalid field parameter. Valid fields are: ${validFields.join(', ')}`
      });
    }

    // Build main query - SAME AS getPaymentFolders
    const query = {};

    // Apply filters from request (same as before)
    if (otherFilters.company && otherFilters.company.length > 0) {
      const companies = await Company.find({
        companyName: { $in: otherFilters.company }
      }).select('_id').lean();
      if (companies.length > 0) {
        query.company = { $in: companies.map(c => c._id) };
      }
    }
    // Date range filter
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
    // Party filter
    if (otherFilters.party && otherFilters.party.length > 0) {
      const parties = await Party.find({
        partyName: { $in: otherFilters.party }
      }).select('_id').lean();
      if (parties.length > 0) {
        query.party = { $in: parties.map(p => p._id) };
      }
    }
    // Area filter
    if (otherFilters.area && otherFilters.area.length > 0) {
      query.area = { $in: otherFilters.area };
    }
    // Month filter
    if (otherFilters.month && otherFilters.month.length > 0) {
      query.month = { $in: otherFilters.month };
    }

    let uniqueValues = [];
    // Field-specific queries
    switch (field) {
      case "company":
        const companyIds = await PaymentFolder.distinct("company", query);
        const companies = await Company.find(
          { _id: { $in: companyIds } },
          "companyName"
        ).lean();
        uniqueValues = companies.map(c => c.companyName).filter(Boolean);
        break;
      case "party":
        const partyIds = await PaymentFolder.distinct("party", query);
        const parties = await Party.find(
          { _id: { $in: partyIds } },
          "partyName"
        ).lean();
        uniqueValues = parties.map(p => p.partyName).filter(Boolean);
        break;
      case "area":
        uniqueValues = await PaymentFolder.distinct("area", query);
        uniqueValues = uniqueValues.filter(val => val && String(val).trim() !== "");
        break;
      case "month":
        uniqueValues = await PaymentFolder.distinct("month", query);
        uniqueValues = uniqueValues.filter(val => val && String(val).trim() !== "");
        break;
      case "assignTo":
        const assignToIds = await PaymentFolder.distinct("assignedTo", query);
        const staffMembers = await Staff.find(
          { _id: { $in: assignToIds } },
          "firstName lastName"
        ).lean();
        uniqueValues = staffMembers.map(s => `${s.firstName || ""} ${s.lastName || ""}`.trim())
          .filter(name => name !== "");
        break;
      case "paymentAmount":
        uniqueValues = await PaymentFolder.distinct("paymentAmount", query);
        uniqueValues = uniqueValues.filter(val => val !== null && val !== undefined).sort((a, b) => a - b);
        break;
      case "receivedAmount":
        uniqueValues = await PaymentFolder.distinct("receivedAmount", query);
        uniqueValues = uniqueValues.filter(val => val !== null && val !== undefined).sort((a, b) => a - b);
        break;
      case "pendingAmount":
        uniqueValues = await PaymentFolder.distinct("pendingAmount", query);
        uniqueValues = uniqueValues.filter(val => val !== null && val !== undefined).sort((a, b) => a - b);
        break;
      case "assignedDate":
        const dateValues = await PaymentFolder.distinct("assignedDate", query);
        uniqueValues = dateValues
          .filter(d => d && new Date(d).getTime() > 0)
          .map(d => new Date(d).toISOString().split('T')[0]) // Format YYYY-MM-DD
          .filter((v, i, self) => self.indexOf(v) === i)
          .sort();
        break;
      case "remarks":
        uniqueValues = await PaymentFolder.distinct("remarks", query);
        uniqueValues = uniqueValues.filter(val => val && String(val).trim() !== "");
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid field parameter"
        });
    }

    // Apply search filter
    if (search && search.trim()) {
      const regex = new RegExp(search, 'i');
      uniqueValues = uniqueValues.filter(val => regex.test(String(val)));
    }

    // Remove duplicates and sort (already handled in cases)
    // uniqueValues = uniqueValues.slice(0, 100); // Limit for safety

    res.status(200).json({
      success: true,
      data: uniqueValues,
      count: uniqueValues.length
    });
  } catch (err) {
    console.error("❌ Error loading payment folder filter options:", err);
    res.status(500).json({
      success: false,
      message: "Error loading filter options",
      error: err.message
    });
  }
};
exports.getPaymentFolderById = async (req, res) => {
  try {
    const data = await PaymentFolder.findById(req.params.id)
      .populate("company")
      .populate({
        path: "party",
        select: "-__v",
        populate: [
          {
            path: "address.marketName",
            model: "Market",
            select: "marketName",
          },
          {
            path: "address.landMark",
            model: "Market",
            select: "landmark",
          },
          {
            path: "address.area",
            model: "Market",
            select: "area",
          },
          {
            path: "address.pincode",
            model: "Market",
            select: "pincode",
          },
        ],
      })
      .populate("assignedTo", "firstName lastName email")
      .populate("assignTask") // Populate assign task
      .populate({
        path: "payments.receivedBy",
        select: "firstName lastName",
      })

    if (!data)
      return res.status(404).json({ message: "Payment folder not found" });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updatePaymentFolder = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Fetch existing document
    const existing = await PaymentFolder.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Payment folder not found" });
    }

    // If assignedDate is being updated, also update the assign task
    if (updateData.assignedDate && existing.assignTask) {
      await AssignTask.findByIdAndUpdate(existing.assignTask, {
        date: new Date(updateData.assignedDate),
        time: updateData.assignedDate,
      });
    }

    // If assignedTo is being updated, also update the assign task
    if (updateData.assignedTo && existing.assignTask) {
      await AssignTask.findByIdAndUpdate(existing.assignTask, {
        assignTo: updateData.assignedTo,
      });
    }

    // If remarks is being updated, also update the assign task
    if (updateData.remarks && existing.assignTask) {
      await AssignTask.findByIdAndUpdate(existing.assignTask, {
        remarks: updateData.remarks,
      });
    }

    // If only receivedAmount comes, recalculate pending
    if (updateData.receivedAmount !== undefined) {
      const newReceived = updateData.receivedAmount;
      const paymentAmount = existing.paymentAmount;
      updateData.pendingAmount = paymentAmount - newReceived;
    }

    // If paymentAmount updated (rare case)
    if (
      updateData.paymentAmount !== undefined &&
      updateData.receivedAmount === undefined
    ) {
      updateData.pendingAmount =
        updateData.paymentAmount - existing.receivedAmount;
    }

    const updated = await PaymentFolder.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
      }
    )
      .populate("company")
      .populate({
        path: "party",
        select: "-__v",
        populate: [
          {
            path: "address.marketName",
            model: "Market",
            select: "marketName",
          },
          {
            path: "address.landMark",
            model: "Market",
            select: "landmark",
          },
          {
            path: "address.area",
            model: "Market",
            select: "area",
          },
          {
            path: "address.pincode",
            model: "Market",
            select: "pincode",
          },
        ],
      })
      .populate("assignedTo", "firstName lastName email")
      .populate("assignTask") // Populate assign task
      .populate({
        path: "payments.receivedBy",
        select: "firstName lastName",
      })
      .sort({ createdAt: -1 });

    res.json({
      message: "Payment folder updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deletePaymentFolder = async (req, res) => {
  try {
    // First find the payment folder to get assignTask ID
    const paymentFolder = await PaymentFolder.findById(req.params.id);

    if (!paymentFolder) {
      return res.status(404).json({ message: "Payment folder not found" });
    }

    // Delete the associated assign task
    if (paymentFolder.assignTask) {
      await AssignTask.findByIdAndDelete(paymentFolder.assignTask);
    }

    // Delete the payment folder
    await PaymentFolder.findByIdAndDelete(req.params.id);

    res.json({ message: "Payment folder and associated task deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMultiplePaymentFolder = async (req, res) => {
  try {
    const { ids } = req.body;

    if (ids && Array.isArray(ids)) {
      if (ids.length === 0) {
        return res.status(400).json({ error: "No IDs provided for deletion" });
      }

      // First find all payment folders to get their assignTask IDs
      const paymentFolders = await PaymentFolder.find({
        _id: { $in: ids }
      });

      // Extract all assignTask IDs
      const assignTaskIds = paymentFolders
        .map(folder => folder.assignTask)
        .filter(taskId => taskId);

      // Delete all associated assign tasks
      if (assignTaskIds.length > 0) {
        await AssignTask.deleteMany({
          _id: { $in: assignTaskIds }
        });
      }

      // Delete all payment folders
      const result = await PaymentFolder.deleteMany({
        _id: { $in: ids }
      });

      res.json({
        message: `${result.deletedCount} payment folder(s) and associated tasks deleted successfully`,
        deletedCount: result.deletedCount
      });
    } else {
      res.status(400).json({ error: "No ID provided for deletion" });
    }
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.addPaymentToFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, note, paymentMethod, receivedBy, remark } = req.body;

    // Validate required fields
    if (!amount || !receivedBy) {
      return res.status(400).json({
        message: "Amount and receivedBy are required fields",
      });
    }

    // Fetch existing payment folder
    const existingFolder = await PaymentFolder.findById(id);
    if (!existingFolder) {
      return res.status(404).json({ message: "Payment folder not found" });
    }

    // Validate amount doesn't exceed pending amount
    const currentPending = existingFolder.pendingAmount;
    if (amount > currentPending) {
      return res.status(400).json({
        message: `Payment amount (₹${amount}) cannot exceed pending amount (₹${currentPending})`,
      });
    }

    // Create new payment object
    const newPayment = {
      date: date || new Date(),
      amount: amount,
      note: remark || "",
      paymentMethod: paymentMethod || "Cash",
      receivedBy: receivedBy,
    };

    // Add payment to the beginning of payments array (latest first)
    existingFolder.payments.unshift(newPayment);

    // Calculate new received amount from all payments
    const totalReceived = existingFolder.payments.reduce(
      (total, payment) => total + payment.amount,
      0
    );

    // Update received and pending amounts
    existingFolder.receivedAmount = totalReceived;
    existingFolder.pendingAmount = existingFolder.paymentAmount - totalReceived;

    // Save the updated document
    const updatedFolder = await existingFolder.save();

    // Populate and return the updated document
    const populatedFolder = await PaymentFolder.findById(updatedFolder._id)
      .populate("company")
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
      .populate("assignedTo", "firstName lastName email")
      .populate("assignTask") // Populate assign task
      .populate({
        path: "payments.receivedBy",
        select: "firstName lastName",
      })
      .sort({ createdAt: -1 }); // Ensures folder-level sorting if needed

    res.status(200).json({
      message: "Payment added successfully",
      data: populatedFolder,
    });
  } catch (error) {
    console.error("Error adding payment:", error);
    res.status(500).json({
      message: "Server error while adding payment",
      error: error.message,
    });
  }
};
