const mongoose = require('mongoose');
const Vendor = require('../models/vendor.model');
const CompanyName = require('../models/companyName.model');
const csv = require('csv-parser');
const fs = require('fs');
const { Readable } = require('stream');
const path = require('path');
// Get all vendors
exports.getVendors = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    let { companyNames = [], vendorNames = [], contactNumbers = [], whatsappNumbers = [], gstNumbers = [] ,address=[]} = req.query;
    const skip = (page - 1) * limit;

    if (typeof companyNames === "string") {
      companyNames = companyNames.split(",");
    }

    let filter = {};

    if (search) {
      const regex = { $regex: search, $options: "i" };
      filter.$or = [
        { name: regex },
        { contactNumber: regex },
        { whatsappNumber: regex },
        { gst: regex },
        { address: regex },
        { "companyName.companyName": regex }
      ];
    }

    if (companyNames.length) {
      const companyIds = await CompanyName.find({ companyName: { $in: companyNames } }, '_id').then(cs => cs.map(c => c._id));
      filter.companyName = { $in: companyIds };
    }
    if (vendorNames.length) {
  if (typeof vendorNames === "string") vendorNames = [vendorNames];
  filter.name = { $in: vendorNames };
}

if (contactNumbers.length) {
  if (typeof contactNumbers === "string") contactNumbers = [contactNumbers];
  filter.contactNumber = { $in: contactNumbers };
}

if (whatsappNumbers.length) {
  if (typeof whatsappNumbers === "string") whatsappNumbers = [whatsappNumbers];
  filter.whatsappNumber = { $in: whatsappNumbers };
}

if (gstNumbers.length) {
  if (typeof gstNumbers === "string") gstNumbers = [gstNumbers];
  filter.gst = { $in: gstNumbers };
}
if (address.length) {
  let addrArray = address;
  if (typeof address === "string") addrArray = [address];
  filter.address = { $in: addrArray.map(a => new RegExp(a, 'i')) }; // partial match
  // Or exact match: filter.address = { $in: addrArray };
}

    const total = await Vendor.countDocuments(filter);

    const vendors = await Vendor.find(filter)
      .populate('companyName', 'companyName')
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit));

    res.status(200).json({
      data: vendors,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get filter options
exports.getVendorFilters = async (req, res) => {
  try {
    const [companyNames, vendorNames, contacts, whatsapps, gsts,adds] = await Promise.all([
      // Company Names
      Vendor.distinct("companyName").then(ids =>
        CompanyName.find({ _id: { $in: ids } }, "companyName")
          .then(companies => companies.map(c => c.companyName).sort())
      ),

      // Vendor Names (top 50 most common)
      Vendor.aggregate([
        { $group: { _id: "$name", count: { $sum: 1 } }},
        { $sort: { count: -1 } },
        { $limit: 100 },
        { $project: { name: "$_id", _id: 0 } }
      ]).then(results => results.map(r => r.name)),

      // Contact Numbers (unique)
      Vendor.distinct("contactNumber").then(nums => nums.sort()),

      // WhatsApp Numbers (unique)
      Vendor.distinct("whatsappNumber").then(nums => nums.sort()),

      // GST Numbers (only non-empty)
      Vendor.distinct("gst").then(gsts => gsts.filter(g => g).sort()),

      // Addresses (top 50 most common)
      // Add this to the Promise.all array
Vendor.distinct("address")
  .then(addrs => addrs.filter(a => a && a.trim()).slice(0, 100).sort())
    ]);

    res.json({
      companyNames,
      vendorNames,
      contactNumbers: contacts,
      whatsappNumbers: whatsapps,
      gstNumbers: gsts,
      address: adds
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load filters" });
  }
};

// Get single vendor by ID
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).populate(
      'companyName',
      'companyName'
    );
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }
    res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor: ' + error.message,
    });
  }
};

// Create a new vendor
exports.createVendor = async (req, res) => {
  try {
    const { companyName, name, contactNumber, whatsappNumber, gst, address } =
      req.body;

    // Validate required fields
    if (!companyName || !name || !contactNumber || !whatsappNumber || !address) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided',
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(companyName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID',
      });
    }

    // Verify company exists
    const companyExists = await CompanyName.findById(companyName);
    if (!companyExists) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company',
      });
    }

    // Create new vendor
    const newVendor = new Vendor({
      companyName,
      name,
      contactNumber,
      whatsappNumber,
      gst: gst || '',
      address,
    });

    const savedVendor = await newVendor.save();

    // Populate companyName
    const populatedVendor = await Vendor.findById(savedVendor._id).populate(
      'companyName',
      'companyName'
    );

    res.status(201).json({
      success: true,
      data: populatedVendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating vendor: ' + error.message,
    });
  }
};

// Update vendor by ID
exports.updateVendor = async (req, res) => {
  try {
    const { companyName, name, contactNumber, whatsappNumber, gst, address } =
      req.body;

    // Validate ObjectId if provided
    if (companyName && !mongoose.Types.ObjectId.isValid(companyName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID',
      });
    }

    // Verify company exists if provided
    if (companyName) {
      const companyExists = await CompanyName.findById(companyName);
      if (!companyExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid company',
        });
      }
    }

    const updatedVendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      {
        companyName,
        name,
        contactNumber,
        whatsappNumber,
        gst,
        address,
      },
      { new: true, runValidators: true }
    ).populate('companyName', 'companyName');

    if (!updatedVendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    res.status(200).json({
      success: true,
      data: updatedVendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating vendor: ' + error.message,
    });
  }
};

// Delete vendor by ID
exports.deleteVendor = async (req, res) => {
  try {
    const deletedVendor = await Vendor.findByIdAndDelete(req.params.id);

    if (!deletedVendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Vendor deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting vendor: ' + error.message,
    });
  }
};
exports.bulkCreateVendors = async (req, res) => {
  try {
    const file = req.file;
    const { companyName } = req.body;

    if (!file || !file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    if (!companyName) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(companyName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID',
      });
    }

    const companyExists = await CompanyName.findById(companyName);
    if (!companyExists) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    const results = [];
    const stream = Readable.from(file.buffer);

    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          const vendors = [];
          const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

          for (const row of results) {
            const { name, contactNumber, whatsappNumber, gst, address } = row;

            if (!name || !contactNumber || !whatsappNumber || !address) {
              return res.status(400).json({
                success: false,
                message: `Missing required fields in row: ${JSON.stringify(row)}`,
              });
            }

            if (!/^[0-9]{10}$/.test(contactNumber)) {
              return res.status(400).json({
                success: false,
                message: `Invalid contact number in row: ${JSON.stringify(row)}`,
              });
            }

            if (!/^[0-9]{10}$/.test(whatsappNumber)) {
              return res.status(400).json({
                success: false,
                message: `Invalid WhatsApp number in row: ${JSON.stringify(row)}`,
              });
            }

            if (gst && !gstRegex.test(gst)) {
              return res.status(400).json({
                success: false,
                message: `Invalid GST number in row: ${JSON.stringify(row)}`,
              });
            }

            vendors.push({
              companyName,
              name,
              contactNumber,
              whatsappNumber,
              gst: gst || '',
              address,
            });
          }

          const savedVendors = await Vendor.insertMany(vendors);

          const populatedVendors = await Vendor.find({
            _id: { $in: savedVendors.map((v) => v._id) }
          }).populate('companyName', 'companyName');

          return res.status(200).json({
            success: true,
            message: 'Bulk vendor upload completed successfully',
            count: savedVendors.length,
            data: populatedVendors,
          });

        } catch (error) {
          console.error('Error processing bulk upload:', error);
          return res.status(500).json({
            success: false,
            message: `Failed to process bulk upload: ${error.message}`,
          });
        }
      });
  } catch (error) {
    console.error('Error in bulk upload:', error);
    return res.status(500).json({
      success: false,
      message: `Server error during bulk upload: ${error.message}`,
    });
  }
};