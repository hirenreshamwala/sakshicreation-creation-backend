const CompanyName = require("../models/companyName.model");
const AccountMaster = require("../models/accountMaster.model");
const mongoose = require("mongoose");

// Create a new CompanyName
exports.createCompanyName = async (req, res) => {
  try {
    // Check for required fields
    const requiredFields = ["companyName"];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`,
        });
      }
    }

    // Check if companyName already exists
    const existingCompany = await CompanyName.findOne({ companyName: req.body.companyName });
    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: "Company name already exists",
      });
    }

    // Create company name object
    const companyData = {
      companyName: req.body.companyName,
      avatar: req.body.avatar || null, // Include avatar field
    }

    // Create and save the company name
    const newCompany = new CompanyName(companyData);
    await newCompany.save();

    res.status(201).json({
      success: true,
      message: "Company name created successfully",
      data: newCompany,
    });
  } catch (error) {
    console.error("Error creating company name:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create company name",
      error: error.message,
    });
  }
};

// // Get all CompanyNames
// exports.getCompanyNames = async (req, res) => {
//   try {
//     const companies = await CompanyName.find().populate();
//     res.status(200).json({
//       success: true,
//       data: companies,
//     });
//   } catch (error) {
//     console.error("Error fetching company names:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch company names",
//       error: error.message,
//     });
//   }
// };

// Backend - controllers/companyName.controller.js (assuming this file)
exports.getAllCompanyNames = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      companyNames = [],
      defaults = []
    } = req.query;
    
    const skip = (page - 1) * limit;
    let filter = {};
    
    if (search) {
      filter.$or = [
        { companyName: { $regex: search, $options: "i" } }
      ];
    }
    
    if (companyNames.length) filter.companyName = { $in: companyNames };
    
    // FIX: Handle defaults properly (it might come as string, boolean, or array)
    if (defaults) {
      let defaultsArray;
      
      // If defaults is already an array
      if (Array.isArray(defaults)) {
        defaultsArray = defaults;
      } 
      // If defaults is a string (e.g., "true", "false", "Yes", "No")
      else if (typeof defaults === 'string') {
        // Handle both "Yes"/"No" and "true"/"false" formats
        if (defaults === "Yes" || defaults === "true") {
          defaultsArray = [true];
        } else if (defaults === "No" || defaults === "false") {
          defaultsArray = [false];
        } else {
          defaultsArray = [defaults === "true"];
        }
      }
      // If defaults is a boolean
      else if (typeof defaults === 'boolean') {
        defaultsArray = [defaults];
      }
      // If it's something else, try to convert
      else {
        defaultsArray = [Boolean(defaults)];
      }
      
      if (defaultsArray.length > 0) {
        filter.default = { $in: defaultsArray };
      }
    }
    
    const total = await CompanyName.countDocuments(filter);
    const companyNamesData = await CompanyName.find(filter)
      .select("companyName avatar default")
      .skip(Number(skip))
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: companyNamesData,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: Number(limit)
      }
    });
  } catch (error) {
    console.error("Error fetching company names:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch company names",
      error: error.message
    });
  }
};
exports.getCompanyNameFilters = async (req, res) => {
  try {
    const companyNames = await CompanyName.distinct("companyName");
    res.json({
      companyNames: companyNames.sort(),
      defaults: ["Yes", "No"]
    });
  } catch (err) {
    console.error("Error in getCompanyNameFilters:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getCompanyNames = async (req, res) => {
  try {
    const companies = await CompanyName.aggregate([
      {
        $lookup: {
          from: "accountmasters", // must match MongoDB collection name (lowercase plural)
          localField: "_id",
          foreignField: "companyName",
          as: "partyList"
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: companies,
    });
  } catch (error) {
    console.error("Error fetching company names:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch company names",
      error: error.message,
    });
  }
};


// exports.getCompanyNames = async (req, res) => {
//   try {
//     const companiesWithParties = await CompanyName.aggregate([
//       {
//         $lookup: {
//           from: "accountmasters", // collection name in lowercase and plural
//           localField: "_id",
//           foreignField: "companyName",
//           as: "parties"
//         }
//       }
//     ]);

//     res.status(200).json({
//       success: true,
//       data: companiesWithParties,
//     });
//   } catch (error) {
//     console.error("Error fetching company names with parties:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch company names with parties",
//       error: error.message,
//     });
//   }
// };

// Get a single CompanyName by ID
exports.getCompanyNameById = async (req, res) => {
  try {
    const company = await CompanyName.findById(req.params.id);
    if (company) {
      res.status(200).json({
        success: true,
        data: company,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Company name not found",
      });
    }
  } catch (error) {
    console.error("Error fetching company name:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch company name",
      error: error.message,
    });
  }
};

// Update a CompanyName by ID
exports.updateCompanyName = async (req, res) => {
  try {
    // Check if companyName is being updated and if it already exists
    if (req.body.companyName) {
      const existingCompany = await CompanyName.findOne({
        companyName: req.body.companyName,
        _id: { $ne: req.params.id },
      });
      if (existingCompany) {
        return res.status(400).json({
          success: false,
          message: "Company name already in use",
        });
      }
    }

    // If setting this company as default, find and update the current default company
    if (req.body.default === true) {
      const currentDefaultCompany = await CompanyName.findOne({ default: true });
      
      // If there's an existing default company and it's not the one being updated
      if (currentDefaultCompany && currentDefaultCompany._id.toString() !== req.params.id) {
        // Update the previous default company to false
        await CompanyName.findByIdAndUpdate(
          currentDefaultCompany._id,
          { default: false },
          { new: true, runValidators: true }
        );
      }
    }

    // Prepare update data
    const updateData = {
      companyName: req.body.companyName,
      default: req.body.default,
      ...(req.body.avatar && { avatar: req.body.avatar }), // Only include avatar if provided
    };

    const updatedCompany = await CompanyName.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (updatedCompany) {
      res.status(200).json({
        success: true,
        message: "Company name updated successfully",
        data: updatedCompany,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Company name not found",
      });
    }
  } catch (error) {
    console.error("Error updating company name:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update company name",
      error: error.message,
    });
  }
};

// Delete a CompanyName by ID
exports.deleteCompanyName = async (req, res) => {
  try {
    const company = await CompanyName.findByIdAndDelete(req.params.id);
    if (company) {
      res.status(200).json({
        success: true,
        message: "Company name deleted successfully",
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Company name not found",
      });
    }
  } catch (error) {
    console.error("Error deleting company name:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete company name",
      error: error.message,
    });
  }
};

exports.getPartywithCompany = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID format",
      });
    }

    const user = req.user;
    console.log("DEBUG : user:", user);

    let query = { companyName: id };
    console.log("DEBUG : query:", query);



    if (!["admin", "manager","factory manager","godown manager", "driver"].includes(user.role?.toLowerCase())) {
      query.createdBy = user.id;
      console.log("DEBUG : query.createdBy:", query.createdBy);

    }

    // Find all account masters that belong to the specified company
    const accountMasters = await AccountMaster.find(query)
      .populate({
        path: "party",
        match: { statusApproval: "APPROVED" },
        select: "partyName _id statusApproval address.unitNo address.marketName",
        populate: {
          path: "address.marketName", // nested populate
          model: "Market",
          select: "marketName _id",
        },
      })
      .sort({ "party.partyName": 1 });

    // Filter out null parties (due to match)
    const filteredAccounts = accountMasters.filter(
      (account) => account.party !== null
    );

    // Transform data
    const parties = filteredAccounts.map((account) => ({
      _id: account.party._id,
      partyName: account.party.partyName,
      unitNo: account.party.address.unitNo,
      marketName: account.party.address.marketName?.marketName || "",
    }));

    res.status(200).json({
      success: true,
      data: parties,
      count: parties.length,
      message:
        parties.length > 0
          ? "Approved parties fetched successfully"
          : "No approved parties found for this company",
    });
  } catch (error) {
    console.error("Error fetching approved parties by company:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch approved parties for the company",
      error: error.message,
    });
  }
};