const Order = require("../models/order.model");
const mongoose = require("mongoose");
const Sequence = require("../models/sequence.model");
const Company = require("../models/companyName.model");
const AssignTask = require("../models/assignTask.model");
const Party = require("../models/Party.model");
const Staff = require("../models/staff.model");
const Inventory = require("../models/inventory.model");
const ProductItem = require("../models/productItem.model");
const moment = require("moment");

const computeNotificationSummary = async () => {
  const [designer, printer, binder, bookletBinder] = await Promise.all([
    Order.countDocuments({ designerNotificationUnread: true }),
    Order.countDocuments({ printerNotificationUnread: true }),
    Order.countDocuments({ binderNotificationUnread: true }),
    Order.countDocuments({ bookletBinderNotificationUnread: true }),
  ]);

  return { designer, printer, binder, bookletBinder };
};

exports.cancelOrder = async (req, res) => {
  try {
    const { orderId, cancelRemarks } = req.body;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        status: "Cancelled",
        cancelRemarks: cancelRemarks || "",
        cancelledAt: new Date(),
      },
      { new: true }
    )
      .populate("companyName", "companyName avatar")
      .populate("bindingType", "name")
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
      .populate("productItem", "itemName")
      .populate("createdBy")
      .populate("designer", "name")
      .populate({
        path: "followUp.staff",
        select: "firstName lastName avatar"
      });

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findByIdAndDelete(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete order",
      error: error.message,
    });
  }
};

// const Size = require('../models/size.model');
exports.createOrder = async (req, res) => {
  try {
    // console.log("=== CREATE ORDER DEBUG ===");
    // console.log("req.body:", req.body);
    // console.log("=========================");

    const {
      companyName,
      party,
      productItem,
      qty,
      remarks,
      filePaths,
      createdBy,
      isGst,
      size,
      rate,
      rateType,
      isLamination,
      laminationType,
      color,
      color1,
      color2,
      description,
    } = req.body;

    // Validate required fields
    if (!companyName || !party || !productItem || !qty) {
      return res.status(400).json({
        success: false,
        message: "Company, Party, Product Item, and Quantity are required",
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(companyName)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Company ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(party)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Party ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productItem)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Product Item ID",
      });
    }

    // Validate rate and rateType
    if (rate !== undefined && (isNaN(rate) || rate < 0)) {
      return res.status(400).json({
        success: false,
        message: "Rate must be a non-negative number",
      });
    }

    if (rateType !== undefined && !["old", "new"].includes(rateType)) {
      return res.status(400).json({
        success: false,
        message: "Rate type must be either 'old' or 'new'",
      });
    }

    if (isLamination !== undefined && typeof isLamination !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isLamination must be a boolean",
      });
    }

    if (
      isLamination &&
      laminationType &&
      !["Matte", "Gloss"].includes(laminationType)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Lamination type must be either 'Matte' or 'Gloss' when lamination is selected",
      });
    }

    const company = await Company.findById(companyName).select("companyName");
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Generate company initials (first two characters of the first two words)
    const companyWords = company.companyName.trim().split(/\s+/);
    let initials = "";
    if (companyWords.length >= 2) {
      initials = (companyWords[0][0] + companyWords[1][0]).toUpperCase();
    } else {
      initials = companyWords[0].substring(0, 2).toUpperCase();
    }

    // Get or create global sequence
    let sequence = await Sequence.findOne({ type: "global_order" });
    if (!sequence) {
      sequence = new Sequence({ type: "global_order", lastSequence: 100 });
      await sequence.save();
    }

    // Increment sequence and generate order number
    sequence.lastSequence += 1;
    const orderNumber = `${initials}-${sequence.lastSequence}`; // This will generate order number starting from 101
    await sequence.save();

    // Process file paths with remarks
    let processedFilePaths = [];
    if (filePaths) {
      try {
        if (typeof filePaths === "string") {
          const parsed = JSON.parse(filePaths);
          processedFilePaths = Array.isArray(parsed)
            ? parsed.map((item) => ({
              path: typeof item === "string" ? item : item.path,
              remark: typeof item === "object" ? item.remark || "" : "",
              uploadedAt: new Date(),
            }))
            : [];
        } else if (Array.isArray(filePaths)) {
          processedFilePaths = filePaths.map((item) => ({
            path: typeof item === "string" ? item : item.path,
            remark: typeof item === "object" ? item.remark || "" : "",
            uploadedAt: new Date(),
          }));
        }
        // console.log("Processed file paths:", processedFilePaths);
      } catch (error) {
        console.error("Error processing file paths:", error);
        processedFilePaths = [];
      }
    }

    // Create order
    const orderData = {
      companyName,
      party,
      productItem,
      qty: Number.parseInt(qty),
      remarks: remarks || "",
      filePaths: processedFilePaths,
      createdBy: createdBy || req.user?.id,
      orderNumber,
      isGst: isGst !== false,
      size: size || "",
      pType: req.body.pType,
      binding: req.body.binding,
      bindingType: req.body.bindingType,
      bookletFolder: req.body.bookletFolder,
      bookletFolderType: req.body.bookletFolderType,
      bindingPage: req.body.bindingPage,
      rate: rate !== undefined ? Number.parseFloat(rate) : undefined,
      rateType: rateType || undefined,
      isLamination: isLamination !== undefined ? isLamination : false,
      laminationType: isLamination ? laminationType || "" : "",
      description: description || "",
    };

    if (req.body.number === "Yes") {
      orderData.number = req.body.number;
      orderData.endNumber = req.body.endNumber;
      orderData.startNumber = req.body.startNumber;
    }

    if (color) {
      orderData.color = color;
      orderData.color1 = color1 || "";
      orderData.color2 = color2 || "";
    }

    const order = new Order(orderData);
    await order.save();
    const partyDoc = await Party.findById(party);
    if (partyDoc && partyDoc.partyTag === "NEW") {
      partyDoc.partyTag = "CUSTOMER";
      await partyDoc.save();
      // console.log(`Updated party ${partyDoc._id} tag from New to Customer`);
      // console.log("🚀 ~ Update:", Update);
    }
    // Populate the order for response
    const populatedOrder = await Order.findById(order._id)
      .populate("companyName", "companyName avatar")
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
      .populate("productItem", "itemName")
      .populate("createdBy")
      .populate("designer", "name")
      .populate("bindingType", "name");

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: populatedOrder,
    });
  } catch (error) {
    console.error("❌ Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
};

// Add this to your order controller
exports.getFilterOptionsData = async (req, res) => {
  try {
    const { field } = req.params;
    const filters = req.body || {};
    const { search, ...otherFilters } = filters;

    if (!field) {
      return res
        .status(400)
        .json({ success: false, message: "Field parameter is required" });
    }

    // console.log(
    //   "Order Filter Options - Field:",
    //   field,
    //   "Filters:",
    //   otherFilters
    // );

    // Build main filter query
    const query = {};

    // Company filter
    if (otherFilters.company && otherFilters.company.length > 0) {
      const companies = await Company.find({
        companyName: { $in: otherFilters.company },
      })
        .select("_id")
        .lean();

      if (companies.length > 0) {
        query.companyName = { $in: companies.map((c) => c._id) };
      }
    }

    // Staff filter
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

    // FIELD WISE SOLUTIONS FOR ORDERS
    switch (field) {
      case "company":
        const companyIds = await Order.distinct("companyName", query);
        const companies = await Company.find(
          { _id: { $in: companyIds } },
          "companyName"
        );
        uniqueValues = companies.map((c) => c.companyName).filter(Boolean);
        break;

      case "party":
        const partyIds = await Order.distinct("party", query);
        const parties = await Party.find(
          { _id: { $in: partyIds } },
          "partyName"
        );
        uniqueValues = parties.map((p) => p.partyName).filter(Boolean);
        break;

      case "orderNumber":
        uniqueValues = await Order.distinct("orderNumber", query);
        uniqueValues = uniqueValues.filter((val) => val && val.trim() !== "");
        break;

      case "item":
        const productItemIds = await Order.distinct("productItem", query);
        const productItems = await ProductItem.find(
          { _id: { $in: productItemIds } },
          "itemName"
        );
        uniqueValues = productItems.map((p) => p.itemName).filter(Boolean);
        break;

      case "size":
        // FIXED: Assume size is string field, direct distinct
        uniqueValues = await Order.distinct("size", query);
        uniqueValues = uniqueValues.filter((val) => val && val.trim() !== "");
        break;

      case "remarks":
        uniqueValues = await Order.distinct("remarks", query);
        uniqueValues = uniqueValues.filter((val) => val && val.trim() !== "");
        break;

      case "orderedBy":
        const createdByIds = await Order.distinct("createdBy", query);
        const staffUsers = await Staff.find(
          { _id: { $in: createdByIds } },
          "firstName lastName"
        );
        uniqueValues = staffUsers
          .map((u) => `${u.firstName} ${u.lastName}`)
          .filter(Boolean);
        break;

      case "orderStatus":
        uniqueValues = await Order.distinct("status", query);
        uniqueValues = uniqueValues.filter((val) => val && val.trim() !== "");
        break;

      case "date":
      case "createdAt":
        const dates = await Order.distinct("createdAt", query);
        uniqueValues = dates
          .map((d) => moment(d).format("DD-MM-YYYY"))
          .filter((v, i, self) => v && self.indexOf(v) === i)
          .sort((a, b) => moment(a, "DD-MM-YYYY").toDate().getTime() - moment(b, "DD-MM-YYYY").toDate().getTime());
        break;

      default:
        console.log("Invalid field parameter:", field);
        return res
          .status(400)
          .json({ success: false, message: "Invalid field parameter" });
    }

    // SEARCH FILTER
    if (search) {
      const searchText = search.toLowerCase();
      uniqueValues = uniqueValues.filter((v) =>
        v?.toString().toLowerCase().includes(searchText)
      );
    }

    // REMOVE DUPLICATES + SORT
    uniqueValues = [...new Set(uniqueValues)].filter(Boolean).sort();

    // LIMIT FOR SAFETY
    // uniqueValues = uniqueValues.slice(0, 100);

    // console.log(`Filter options for ${field}:`, uniqueValues.length, "items");

    res.status(200).json({
      success: true,
      data: uniqueValues,
      count: uniqueValues.length,
    });
  } catch (err) {
    console.error("Error loading order filter options:", err);
    res.status(500).json({
      success: false,
      message: "Error loading filter options",
      error: err.message,
    });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const {
      status, // array of statuses
      companyName,
      party,
      staffId, // createdBy staff id
      startDate,
      endDate,
    } = req.body;

    const filter = {};

    // ✅ Status filter (multiple)
    if (status && Array.isArray(status) && status.length > 0) {
      filter.status = { $in: status };
    }

    // Company filter
    if (companyName && mongoose.Types.ObjectId.isValid(companyName)) {
      filter.companyName = companyName;
    }

    // Party filter
    if (party && mongoose.Types.ObjectId.isValid(party)) {
      filter.party = party;
    }

    // Staff filter → match createdBy
    if (staffId && mongoose.Types.ObjectId.isValid(staffId)) {
      filter.createdBy = staffId;
    }

    // Date range filter
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    // Fetch orders without pagination
    const orders = await Order.find(filter)
      .populate("companyName", "companyName avatar")
      .populate("bindingType", "name")
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
      .populate("productItem", "itemName itemSize")
      .populate("createdBy", "firstName lastName")
      .populate("designer", "firstName lastName")
      .populate("printer", "firstName lastName")
      .populate("binder", "firstName lastName")
      .populate("bookletBinder", "firstName lastName")
      .populate("deliveryStaff", "firstName lastName")
      .populate({
          path: "followUp.staff",
          select: "firstName lastName avatar"
        })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("❌ Get all orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// In your order controller, update getAllOrders method:
// exports.getAllOrdersPagination = async (req, res) => {
//   try {
//     const {
//       filters = {},
//       search = "",
//       startDate,
//       endDate,
//       isPagination = true,
//       page = 1,
//       pageSize = 10,
//       includeCounts = true
//     } = req.body;

//     // Build query object
//     const query = {};

//     // Search functionality
//     if (search) {
//       const directOr = [
//         { "orderNumber": { $regex: search, $options: "i" } },
//         { "remarks": { $regex: search, $options: "i" } },
//         { "size": { $regex: search, $options: "i" } },
//         { "status": { $regex: search, $options: "i" } },
//       ];

//       // For populated fields: Fetch matching IDs first, then add $in conditions
//       // Company
//       const matchingCompanies = await Company.find({
//         companyName: { $regex: search, $options: "i" }
//       }).select('_id').lean();
//       const companyIds = matchingCompanies.map(c => c._id);
//       if (companyIds.length > 0) {
//         directOr.push({ companyName: { $in: companyIds } });
//       }

//       // Party
//       const matchingParties = await Party.find({
//         partyName: { $regex: search, $options: "i" }
//       }).select('_id').lean();
//       const partyIds = matchingParties.map(p => p._id);
//       if (partyIds.length > 0) {
//         directOr.push({ party: { $in: partyIds } });
//       }

//       // Item (productItem)
//       const matchingItems = await ProductItem.find({
//         itemName: { $regex: search, $options: "i" }
//       }).select('_id').lean();
//       const itemIds = matchingItems.map(i => i._id);
//       if (itemIds.length > 0) {
//         directOr.push({ productItem: { $in: itemIds } });
//       }

//       // Ordered By (createdBy name)
//       const nameRegex = new RegExp(search, "i");
//       const matchingStaff = await Staff.find({
//         $or: [
//           { firstName: nameRegex },
//           { lastName: nameRegex },
//           // Add if you have a full 'name' field: { name: nameRegex }
//         ],
//       })
//         .select("_id")
//         .lean();
//       const creatorIds = matchingStaff.map((s) => s._id);
//       if (creatorIds.length > 0) {
//         directOr.push({ createdBy: { $in: creatorIds } });
//       }

//       // Apply $or if multiple conditions
//       if (directOr.length > 0) {
//         query.$or = directOr;
//       }
//     }
//     if (startDate || endDate) {
//       query.createdAt = {};
//       if (startDate) {
//         const start = new Date(startDate);
//         start.setHours(0, 0, 0, 0);
//         query.createdAt.$gte = start;
//       }
//       if (endDate) {
//         const end = new Date(endDate);
//         end.setHours(23, 59, 59, 999);
//         query.createdAt.$lte = end;
//       }
//     }

//     // FIXED: Apply additional filters for all fields
//     // Company filter
//     if (filters.company && filters.company.length > 0) {
//       const companies = await Company.find({
//         companyName: { $in: filters.company },
//       })
//         .select("_id")
//         .lean();

//       if (companies.length > 0) {
//         if (query.companyName) {
//           // Combine with existing if any
//           query.companyName.$in = [
//             ...(query.companyName.$in || []),
//             ...companies.map((c) => c._id),
//           ];
//         } else {
//           query.companyName = { $in: companies.map((c) => c._id) };
//         }
//       }
//     }
//     // Party filter
//     if (filters.party && filters.party.length > 0) {
//       const parties = await Party.find({
//         partyName: { $in: filters.party },
//       })
//         .select("_id")
//         .lean();

//       if (parties.length > 0) {
//         if (query.party) {
//           query.party.$in = [
//             ...(query.party.$in || []),
//             ...parties.map((p) => p._id),
//           ];
//         } else {
//           query.party = { $in: parties.map((p) => p._id) };
//         }
//       }
//     }
//     // Order Status filter
//     if (filters.orderStatus && filters.orderStatus.length > 0) {
//       if (query.status) {
//         query.status.$in = [
//           ...(query.status.$in || []),
//           ...filters.orderStatus,
//         ];
//       } else {
//         query.status = { $in: filters.orderStatus };
//       }
//     }
//     // Item filter
//     if (filters.item && filters.item.length > 0) {
//       const itemDocs = await ProductItem.find({
//         itemName: { $in: filters.item },
//       })
//         .select("_id")
//         .lean();

//       if (itemDocs.length > 0) {
//         if (query.productItem) {
//           query.productItem.$in = [
//             ...(query.productItem.$in || []),
//             ...itemDocs.map((i) => i._id),
//           ];
//         } else {
//           query.productItem = { $in: itemDocs.map((i) => i._id) };
//         }
//       }
//     }
//     // Size filter
//     if (filters.size && filters.size.length > 0) {
//       if (query.size) {
//         query.size.$in = [...(query.size.$in || []), ...filters.size];
//       } else {
//         query.size = { $in: filters.size };
//       }
//     }
//     // Order Number filter
//     if (filters.orderNumber && filters.orderNumber.length > 0) {
//       if (query.orderNumber) {
//         query.orderNumber.$in = [
//           ...(query.orderNumber.$in || []),
//           ...filters.orderNumber,
//         ];
//       } else {
//         query.orderNumber = { $in: filters.orderNumber };
//       }
//     }
//     // Remarks filter
//     if (filters.remarks && filters.remarks.length > 0) {
//       if (query.remarks) {
//         query.remarks.$in = [...(query.remarks.$in || []), ...filters.remarks];
//       } else {
//         query.remarks = { $in: filters.remarks };
//       }
//     }
//     // Ordered By filter (unchanged, but now combines with search)
//     if (filters.orderedBy && filters.orderedBy.length > 0) {
//       const staffQuery = {
//         $or: filters.orderedBy.map((name) => ({
//           $or: [
//             {
//               firstName: {
//                 $regex: `^${name.split(" ")[0] || ""}`,
//                 $options: "i",
//               },
//             },
//             { lastName: { $regex: name.split(" ")[1] || "", $options: "i" } },
//           ],
//         })),
//       };
//       const staffDocs = await Staff.find(staffQuery).select("_id").lean();

//       if (staffDocs.length > 0) {
//         if (query.createdBy) {
//           query.createdBy.$in = [
//             ...(query.createdBy.$in || []),
//             ...staffDocs.map((s) => s._id),
//           ];
//         } else {
//           query.createdBy = { $in: staffDocs.map((s) => s._id) };
//         }
//       }
//     }

//     // Get total count
//     const totalCount = await Order.countDocuments(query);

//     // Apply pagination
//     let orders = [];
//     if (isPagination) {
//       const skip = (page - 1) * pageSize;
//       orders = await Order.find(query)
//         .skip(skip)
//         .limit(pageSize)
//         .populate("companyName", "companyName avatar")
//         .populate({
//           path: "party",
//           select: "-__v",
//           populate: [
//             {
//               path: "address.marketName",
//               model: "Market",
//               select: "marketName",
//             },
//             { path: "address.landMark", model: "Market", select: "landmark" },
//             { path: "address.area", model: "Market", select: "area" },
//             { path: "address.pincode", model: "Market", select: "pincode" },
//           ],
//         })
//         .populate("productItem", "itemName")
//         .populate("createdBy", "firstName lastName")
//         .populate("designer", "firstName lastName")
//         .populate("printer", "firstName lastName")
//         .populate("binder", "firstName lastName")
//         .populate("bookletBinder", "firstName lastName")
//         .populate("followUp.staff", "firstName lastName avatar")
//         .sort({ createdAt: -1 });
//     } else {
//       orders = await Order.find(query)
//         .populate("companyName", "companyName avatar")
//         .populate({
//           path: "party",
//           select: "-__v",
//           populate: [
//             {
//               path: "address.marketName",
//               model: "Market",
//               select: "marketName",
//             },
//             { path: "address.landMark", model: "Market", select: "landmark" },
//             { path: "address.area", model: "Market", select: "area" },
//             { path: "address.pincode", model: "Market", select: "pincode" },
//           ],
//         })
//         .populate("productItem", "itemName")
//         .populate("createdBy", "firstName lastName")
//         .populate("designer", "firstName lastName")
//         .populate("printer", "firstName lastName")
//         .populate("binder", "firstName lastName")
//         .populate("bookletBinder", "firstName lastName")
//         .populate("followUp.staff", "firstName lastName avatar")
//         .sort({ createdAt: -1 });
//     }

//     // Prepare pagination information
//     const pagination = isPagination
//       ? {
//         currentPage: parseInt(page),
//         pageSize: parseInt(pageSize),
//         totalCount: totalCount,
//         totalPages: Math.ceil(totalCount / pageSize),
//         hasNext: page < Math.ceil(totalCount / pageSize),
//         hasPrev: page > 1,
//       }
//       : null;

//     res.status(200).json({
//       success: true,
//       data: orders,
//       pagination: pagination,
//       totalCount: totalCount,
//     });
//   } catch (error) {
//     console.error("Error getting orders:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch orders",
//       error: error.message,
//     });
//   }
// };
exports.getAllOrdersPagination = async (req, res) => {
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

    // Build query object with Cancelled orders excluded
    const query = {
      status: { $ne: "Cancelled" } // Exclude Cancelled orders
    };

    // Search functionality
    if (search) {
      const directOr = [
        { orderNumber: { $regex: search, $options: "i" } },
        { remarks: { $regex: search, $options: "i" } },
        { size: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];

      // Company
      const matchingCompanies = await Company.find({
        companyName: { $regex: search, $options: "i" }
      }).select('_id').lean();
      const companyIds = matchingCompanies.map(c => c._id);
      if (companyIds.length > 0) directOr.push({ companyName: { $in: companyIds } });

      // Party
      const matchingParties = await Party.find({
        partyName: { $regex: search, $options: "i" }
      }).select('_id').lean();
      const partyIds = matchingParties.map(p => p._id);
      if (partyIds.length > 0) directOr.push({ party: { $in: partyIds } });

      // Item
      const matchingItems = await ProductItem.find({
        itemName: { $regex: search, $options: "i" }
      }).select('_id').lean();
      const itemIds = matchingItems.map(i => i._id);
      if (itemIds.length > 0) directOr.push({ productItem: { $in: itemIds } });

      // Created By (Staff)
      const nameRegex = new RegExp(search, "i");
      const matchingStaff = await Staff.find({
        $or: [
          { firstName: nameRegex },
          { lastName: nameRegex },
        ]
      }).select("_id").lean();
      const creatorIds = matchingStaff.map(s => s._id);
      if (creatorIds.length > 0) directOr.push({ createdBy: { $in: creatorIds } });

      if (directOr.length > 0) query.$or = directOr;
    }

    // Date filter
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

    // Additional filters

    // Company filter
    if (filters.company && filters.company.length > 0) {
      const companies = await Company.find({
        companyName: { $in: filters.company },
      }).select("_id").lean();
      if (companies.length > 0) {
        query.companyName = { $in: companies.map(c => c._id) };
      }
    }

    // Party filter
    if (filters.party && filters.party.length > 0) {
      const parties = await Party.find({
        partyName: { $in: filters.party },
      }).select("_id").lean();
      if (parties.length > 0) query.party = { $in: parties.map(p => p._id) };
    }

    // Order Status filter (exclude Cancelled)
    if (filters.orderStatus && filters.orderStatus.length > 0) {
      const filteredStatus = filters.orderStatus.filter(s => s !== "Cancelled");
      if (filteredStatus.length > 0) {
        query.status = query.status
          ? { ...query.status, $in: filteredStatus }
          : { $in: filteredStatus };
      }
    }

    // Item filter
    if (filters.item && filters.item.length > 0) {
      const itemDocs = await ProductItem.find({
        itemName: { $in: filters.item },
      }).select("_id").lean();
      if (itemDocs.length > 0) query.productItem = { $in: itemDocs.map(i => i._id) };
    }

    // Size filter
    if (filters.size && filters.size.length > 0) query.size = { $in: filters.size };

    // Order Number filter
    if (filters.orderNumber && filters.orderNumber.length > 0) query.orderNumber = { $in: filters.orderNumber };

    // Remarks filter
    if (filters.remarks && filters.remarks.length > 0) query.remarks = { $in: filters.remarks };

    // Ordered By filter
    if (filters.orderedBy && filters.orderedBy.length > 0) {
      const staffQuery = {
        $or: filters.orderedBy.map(name => ({
          $or: [
            { firstName: { $regex: `^${name.split(" ")[0] || ""}`, $options: "i" } },
            { lastName: { $regex: name.split(" ")[1] || "", $options: "i" } },
          ]
        }))
      };
      const staffDocs = await Staff.find(staffQuery).select("_id").lean();
      if (staffDocs.length > 0) query.createdBy = { $in: staffDocs.map(s => s._id) };
    }

    // Get total count
    const totalCount = await Order.countDocuments(query);

    // Apply pagination
    let orders = [];
    if (isPagination) {
      const skip = (page - 1) * pageSize;
      orders = await Order.find(query)
        .skip(skip)
        .limit(pageSize)
        .populate("companyName", "companyName avatar")
        .populate({
          path: "party",
          select: "-__v",
          populate: [
            { path: "address.marketName", model: "Market", select: "marketName" },
            { path: "address.landMark", model: "Market", select: "landmark" },
            { path: "address.area", model: "Market", select: "area" },
            { path: "address.pincode", model: "Market", select: "pincode" },
          ]
        })
        .populate("productItem", "itemName")
        .populate("createdBy", "firstName lastName")
        .populate("designer", "firstName lastName")
        .populate("printer", "firstName lastName")
        .populate("binder", "firstName lastName")
        .populate("bookletBinder", "firstName lastName")
        .populate({ path: "followUp.staff", select: "firstName lastName avatar" })
        .populate({ path: "followUp.taskId", model: "AssignTask", select: "status rescheduleDate" })
        .sort({ createdAt: -1 });
    } else {
      orders = await Order.find(query)
        .populate("companyName", "companyName avatar")
        .populate({
          path: "party",
          select: "-__v",
          populate: [
            { path: "address.marketName", model: "Market", select: "marketName" },
            { path: "address.landMark", model: "Market", select: "landmark" },
            { path: "address.area", model: "Market", select: "area" },
            { path: "address.pincode", model: "Market", select: "pincode" },
          ]
        })
        .populate("productItem", "itemName")
        .populate("createdBy", "firstName lastName")
        .populate("designer", "firstName lastName")
        .populate("printer", "firstName lastName")
        .populate("binder", "firstName lastName")
        .populate("bookletBinder", "firstName lastName")
        .populate({ path: "followUp.staff", select: "firstName lastName avatar" })
        .populate({ path: "followUp.taskId", model: "AssignTask", select: "status rescheduleDate" })
        .sort({ createdAt: -1 });
    }

    // Prepare pagination information
    const pagination = isPagination
      ? {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNext: page < Math.ceil(totalCount / pageSize),
        hasPrev: page > 1,
      }
      : null;

    res.status(200).json({
      success: true,
      data: orders,
      pagination,
      totalCount,
    });
  } catch (error) {
    console.error("Error getting orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    // console.log("=== GET ORDER BY ID DEBUG ===");
    // console.log("Order ID:", id);
    // console.log("=============================");

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID",
      });
    }

    const order = await Order.findById(id)
      .populate("companyName", "companyName avatar")
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
      .populate("productItem", "itemName")
      .populate("createdBy")
      .populate("designer", "name")
      .populate("printer", "name")
      .populate("deliveryStaff", "name")
      .populate("binder", "name")
      .populate("printer", "firstName lastName")
      .populate("bookletBinder", "name")
      .populate("reworkHistory.createdBy", "name")
      .populate("bindingType", "name");

    // order = order.map((order) => {
    //   if (!order.isGst && order.party) {
    //     // Create a new party object without GSTNo
    //     const { GSTNo, ...partyWithoutGst } = order.party.toObject();
    //     return {
    //       ...order.toObject(),
    //       party: partyWithoutGst,
    //     };
    //   }
    //   return order;
    // });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // console.log("✅ Order found:", order._id);
    // console.log("File paths:", order.filePaths);
    // console.log("Design files:", order.designFiles);

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("❌ Get order by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      isGst,
      size,
      rate,
      rateType,
      printerWastedSheet,
      binderWastedSheet,
      bookletBinderWastedSheet,
      isLamination,
      laminationType,
      printerPapers,
      binderPapers,
      bookletPapers,
      color,
      color1,
      color2,
      ...updateData
    } = req.body;
    // console.log("DEBUG : req.body:", req.body);


    const orderData = await Order.findById(id);
    if (
      updateData.designer &&
      updateData.designer !== orderData.designer?.toString()
    ) {
      // Set designer assigned timestamp
      updateData.designerAssignedAt = new Date();
    }
    if (
      updateData.printer &&
      updateData.printer !== orderData.printer?.toString()
    ) {
      // Set printer assigned timestamp
      updateData.printerAssignedAt = new Date();
    }
    if (
      updateData.binder &&
      updateData.binder !== orderData.binder?.toString()
    ) {
      // Set binder assigned timestamp
      updateData.binderAssignedAt = new Date();
    }
    if (
      updateData.bookletBinder &&
      updateData.bookletBinder !== orderData.bookletBinder?.toString()
    ) {
      // Set booklet binder assigned timestamp
      updateData.bookletBinderAssignedAt = new Date();
    }
    if (
      updateData.designerStatus === "Approved" &&
      !orderData.designApprovedAt
    ) {
      updateData.designApproved = new Date();
    }

    if (updateData.printerStatus === "Done" && !orderData.printingCompletedAt) {
      updateData.printingCompletedAt = new Date();
    }
    if (updateData.binderStatus === "Done" && !orderData.bindingCompletedAt) {
      updateData.bindingCompletedAt = new Date();
    }
    if (
      updateData.bookletBinderStatus === "Done" &&
      !orderData.bookletBindingCompletedAt
    ) {
      updateData.bookletBindingCompletedAt = new Date();
    }

    if (
      updateData.printerStatus === "In Progress" &&
      !orderData.printingStartedAt
    ) {
      updateData.printingStartedAt = new Date();
    }
    if (
      updateData.binderStatus === "In Progress" &&
      !orderData.bindingStartedAt
    ) {
      updateData.bindingStartedAt = new Date();
    }
    if (
      updateData.bookletBinderStatus === "In Progress" &&
      !orderData.bookletBindingStartedAt
    ) {
      updateData.bookletBindingStartedAt = new Date();
    }
    if (!orderData) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const actorRole =
      (req.user && typeof req.user.role === "string"
        ? req.user.role.toLowerCase()
        : null) || null;

    if (actorRole === "designer" && updateData.designerStatus === "Done") {
      updateData.designerNotificationUnread = true;
    }

    if (actorRole === "printer" && updateData.printerStatus === "Done") {
      updateData.printerNotificationUnread = true;
    }

    if (actorRole === "binder" && updateData.binderStatus === "Done") {
      updateData.binderNotificationUnread = true;
    }

    if (
      actorRole === "booklet & folder binder" &&
      updateData.bookletBinderStatus === "Done"
    ) {
      updateData.bookletBinderNotificationUnread = true;
    }

    if (typeof isGst !== "undefined") {
      updateData.isGst = isGst;
    }
    // console.log(req.body,"askjikaebf")
    if (
      req.body.status === "Delivery" &&
      req.body.deliveryStaff &&
      req.body.deliveryDate
      // req.body.deliveryTime
    ) {
      const orderget = await Order.findById(id);

      if (!orderget) {
        return res.status(404).json({
          success: false,
          message: "Order not found for assigning delivery task",
        });
      }

      const newAssignTask = new AssignTask({
        date: req.body.deliveryDate,
        time: req.body.deliveryTime || "",
        assignTo: req.body.deliveryStaff,
        companyName: orderget.companyName,
        partyName: orderget.party,
        reasonForVisit: "Delivery",
        remarks: req.body.remarks || "",
      });
      // console.log("🚀 ~ newAssignTask:", newAssignTask);

      const dataassigntask = await newAssignTask.save();

      // console.log("dataassigntask", dataassigntask);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID",
      });
    }

    if (printerWastedSheet !== undefined) {
      if (isNaN(printerWastedSheet) || printerWastedSheet < 0) {
        return res.status(400).json({
          success: false,
          message: "Printer Wasted Sheet must be a non-negative number",
        });
      }
      updateData.printerWastedSheet = Number.parseInt(printerWastedSheet);
    }

    if (binderWastedSheet !== undefined) {
      if (isNaN(binderWastedSheet) || binderWastedSheet < 0) {
        return res.status(400).json({
          success: false,
          message: "Binder Wasted Sheet must be a non-negative number",
        });
      }
      updateData.binderWastedSheet = Number.parseInt(binderWastedSheet);
    }

    if (bookletBinderWastedSheet !== undefined) {
      if (isNaN(bookletBinderWastedSheet) || bookletBinderWastedSheet < 0) {
        return res.status(400).json({
          success: false,
          message: "Booklet Binder Wasted Sheet must be a non-negative number",
        });
      }
      updateData.bookletBinderWastedSheet = Number.parseInt(
        bookletBinderWastedSheet
      );
    }

    if (updateData.designerId) {
      if (!mongoose.Types.ObjectId.isValid(updateData.designerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Designer ID",
        });
      }
      updateData.designer = updateData.designerId;
      delete updateData.designerId;
    }
    if (printerPapers) {
      if (!Array.isArray(printerPapers)) {
        return res.status(400).json({
          success: false,
          message: "Printer papers must be an array",
        });
      }
      updateData.printerPapers = printerPapers.map((paper) => ({
        paperName:
          paper.paperName || `Paper-${Math.floor(Math.random() * 1000)}`,
        numberOfSheetsUsed: paper.numberOfSheetsUsed || "",
        sheetSize: paper.sheetSize || "",
        materialSize: paper.materialSize || "",
        paperType: paper.paperType || "",
        gsm: paper.gsm || "",
        wastage: paper.wastage || "",
        ratePerUnit: paper.ratePerUnit || "",
      }));
    }

    if (binderPapers) {
      if (!Array.isArray(binderPapers)) {
        return res.status(400).json({
          success: false,
          message: "Binder papers must be an array",
        });
      }
      updateData.binderPapers = binderPapers.map((paper) => ({
        paperName:
          paper.paperName || `Binder-Paper-${Math.floor(Math.random() * 1000)}`,
        numberOfSheetsUsed: paper.numberOfSheetsUsed || "",
        sheetSize: paper.sheetSize || "",
        paperType: paper.paperType || "",
        gsm: paper.gsm || "",
        wastage: paper.wastage || "",
        ratePerUnit: paper.ratePerUnit || "",
      }));
    }

    if (bookletPapers) {
      if (!Array.isArray(bookletPapers)) {
        return res.status(400).json({
          success: false,
          message: "Booklet papers must be an array",
        });
      }
      updateData.bookletPapers = bookletPapers.map((paper) => ({
        paperName:
          paper.paperName ||
          `Booklet-Paper-${Math.floor(Math.random() * 1000)}`,
        numberOfSheetsUsed: paper.numberOfSheetsUsed || "",
        sheetSize: paper.sheetSize || "",
        paperType: paper.paperType || "",
        gsm: paper.gsm || "",
        wastage: paper.wastage || "",
        ratePerUnit: paper.ratePerUnit || "",
      }));
    }
    // Validate ObjectIds if they are being updated
    if (
      updateData.companyName &&
      !mongoose.Types.ObjectId.isValid(updateData.companyName)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Company ID",
      });
    }

    if (
      updateData.party &&
      !mongoose.Types.ObjectId.isValid(updateData.party)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Party ID",
      });
    }

    if (
      updateData.productItem &&
      !mongoose.Types.ObjectId.isValid(updateData.productItem)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Product Item ID",
      });
    }

    // Convert qty to number if provided
    if (updateData.qty) {
      updateData.qty = Number.parseInt(updateData.qty);
    }

    // Validate rate and rateType if provided
    if (rate !== undefined) {
      if (isNaN(rate) || rate < 0) {
        return res.status(400).json({
          success: false,
          message: "Rate must be a non-negative number",
        });
      }
      updateData.rate = Number.parseFloat(rate);
    }

    if (rateType !== undefined) {
      if (!["old", "new"].includes(rateType)) {
        return res.status(400).json({
          success: false,
          message: "Rate type must be either 'old' or 'new'",
        });
      }
      updateData.rateType = rateType;
    }

    if (isLamination !== undefined) {
      if (typeof isLamination !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isLamination must be a boolean",
        });
      }
      updateData.isLamination = isLamination;
    }

    if (isLamination && laminationType) {
      if (!["Matte", "Gloss"].includes(laminationType)) {
        return res.status(400).json({
          success: false,
          message:
            "Lamination type must be either 'Matte' or 'Gloss' when lamination is selected",
        });
      }
      updateData.laminationType = laminationType;
    } else if (!isLamination) {
      updateData.laminationType = "";
    }

    if (size !== undefined) {
      updateData.size = size;
    }

    if (color) {
      updateData.color = color;
      updateData.color1 = color1 || "";
      updateData.color2 = color2 || "";
    }

    // Process file paths with remarks if provided
    if (updateData.filePaths) {
      try {
        if (typeof updateData.filePaths === "string") {
          const parsed = JSON.parse(updateData.filePaths);
          updateData.filePaths = Array.isArray(parsed)
            ? parsed.map((item) => ({
              path: typeof item === "string" ? item : item.path,
              remark: typeof item === "object" ? item.remark || "" : "",
              uploadedAt: new Date(),
            }))
            : [];
        } else if (Array.isArray(updateData.filePaths)) {
          updateData.filePaths = updateData.filePaths.map((item) => ({
            path: typeof item === "string" ? item : item.path,
            remark: typeof item === "object" ? item.remark || "" : "",
            uploadedAt: new Date(),
          }));
        }
      } catch (error) {
        console.error("Error processing file paths:", error);
      }
    }

    // Process design files with remarks if provided
    if (updateData.designFiles) {
      try {
        if (typeof updateData.designFiles === "string") {
          const parsed = JSON.parse(updateData.designFiles);
          updateData.designFiles = Array.isArray(parsed)
            ? parsed.map((item) => ({
              path: typeof item === "string" ? item : item.path,
              remark: typeof item === "object" ? item.remark || "" : "",
              uploadedAt: new Date(),
            }))
            : [];
        } else if (Array.isArray(updateData.designFiles)) {
          updateData.designFiles = updateData.designFiles.map((item) => ({
            path: typeof item === "string" ? item : item.path,
            remark: typeof item === "object" ? item.remark || "" : "",
            uploadedAt: new Date(),
          }));
        }
      } catch (error) {
        console.error("Error processing design files:", error);
      }
    }

    const order = await Order.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("companyName", "companyName avatar")
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
      .populate("productItem", "itemName")
      .populate("createdBy")
      .populate("designer", "firstName lastName");

    const staffRole = await Staff.findById(req.user.id);
    if (
      req.body.printerStatus === "Done" &&
      printerPapers &&
      Array.isArray(printerPapers)
    ) {
      for (const paper of printerPapers) {
        if (paper.numberOfSheetsUsed && Number(paper.numberOfSheetsUsed) > 0) {
          // Create outward entry for sheets used
          await Inventory.create({
            category: "printer",
            type: "outward",
            material: paper.paperType || "Unknown",
            quantity: Number(paper.numberOfSheetsUsed),
            date: new Date(),
            companyName: orderData.companyName,
            for: staffRole.role,
            forCompany: req.user.id,
            orderId: id, // Reference to the order
            paperName: paper.paperType || "Unnamed Paper",
            sheetSize: paper.sheetSize || "",
            gsm: paper.gsm || "",
          });
          
          // Create additional outward entry for wastage if any
          if (paper.wastage && Number(paper.wastage) > 0) {
            await Inventory.create({
              category: "printer",
              type: "outward",
              material: paper.paperType || "Unknown",
              quantity: Number(paper.wastage),
              date: new Date(),
              companyName: orderData.companyName,
              for: staffRole.role,
              forCompany: req.user.id,
              orderId: id,
              paperName: `${paper.paperType || "Unnamed Paper"} (Wastage)`,
              sheetSize: paper.sheetSize || "",
              gsm: paper.gsm || "",
            });
          }
        }
      }
    }

    // Process binder papers for inventory if binder status is Done
    if (
      req.body.binderStatus === "Done" &&
      binderPapers &&
      Array.isArray(binderPapers)
    ) {
      for (const paper of binderPapers) {
        if (paper.numberOfSheetsUsed && Number(paper.numberOfSheetsUsed) > 0) {
          // Create outward entry for sheets used
          await Inventory.create({
            category: "binder",
            type: "outward",
            material: paper.paperType || "Unknown",
            quantity: Number(paper.numberOfSheetsUsed),
            date: new Date(),
            companyName: orderData.companyName,
            for: staffRole.role,
            forCompany: req.user.id,
            orderId: id,
            paperName: paper.paperType || "Unnamed Paper",
            sheetSize: paper.sheetSize || "",
            gsm: paper.gsm || "",
          });
          
          // Create additional outward entry for wastage if any
          if (paper.wastage && Number(paper.wastage) > 0) {
            await Inventory.create({
              category: "binder",
              type: "outward",
              material: paper.paperType || "Unknown",
              quantity: Number(paper.wastage),
              date: new Date(),
              companyName: orderData.companyName,
              for: staffRole.role,
              forCompany: req.user.id,
              orderId: id,
              paperName: `${paper.paperType || "Unnamed Paper"} (Wastage)`,
              sheetSize: paper.sheetSize || "",
              gsm: paper.gsm || "",
            });
          }
        }
      }
    }

    // Process booklet papers for inventory if booklet status is Done
    if (
      req.body.bookletBinderStatus === "Done" &&
      bookletPapers &&
      Array.isArray(bookletPapers)
    ) {
      for (const paper of bookletPapers) {
        if (paper.numberOfSheetsUsed && Number(paper.numberOfSheetsUsed) > 0) {
          // Create outward entry for sheets used
          await Inventory.create({
            category: "booklet",
            type: "outward",
            material: paper.paperType || "Unknown",
            quantity: Number(paper.numberOfSheetsUsed),
            date: new Date(),
            companyName: orderData.companyName,
            for: staffRole.role,
            forCompany: req.user.id,
            orderId: id,
            paperName: paper.paperType || "Unnamed Paper",
            sheetSize: paper.sheetSize || "",
            gsm: paper.gsm || "",
          });
          
          // Create additional outward entry for wastage if any
          if (paper.wastage && Number(paper.wastage) > 0) {
            await Inventory.create({
              category: "booklet",
              type: "outward",
              material: paper.paperType || "Unknown",
              quantity: Number(paper.wastage),
              date: new Date(),
              companyName: orderData.companyName,
              for: staffRole.role,
              forCompany: req.user.id,
              orderId: id,
              paperName: `${paper.paperType || "Unnamed Paper"} (Wastage)`,
              sheetSize: paper.sheetSize || "",
              gsm: paper.gsm || "",
            });
          }
        }
      }
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // console.log("✅ Order updated successfully:", order._id);

    try {
      const io = req.app.get("io");
      if (io) {
        const summary = await computeNotificationSummary();
        io.emit("orderNotificationUpdated", {
          orderId: order._id,
          summary,
        });
      }
    } catch (socketError) {
      console.error("WebSocket notification error (updateOrder):", socketError);
    }

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("❌ Update order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order",
      error: error.message,
    });
  }
};

exports.getNotificationSummary = async (req, res) => {
  try {
    const summary = await computeNotificationSummary();
    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("❌ Get notification summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notification summary",
      error: error.message,
    });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { roleType } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID",
      });
    }

    const allowedRoles = ["designer", "printer", "binder", "bookletBinder"];
    if (!roleType || !allowedRoles.includes(roleType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid roleType",
      });
    }

    const notificationField =
      roleType === "designer"
        ? "designerNotificationUnread"
        : roleType === "printer"
          ? "printerNotificationUnread"
          : roleType === "binder"
            ? "binderNotificationUnread"
            : "bookletBinderNotificationUnread";

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { [notificationField]: false },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    try {
      const io = req.app.get("io");
      if (io) {
        const summary = await computeNotificationSummary();
        io.emit("orderNotificationUpdated", {
          orderId: updatedOrder._id,
          summary,
        });
      }
    } catch (socketError) {
      console.error("WebSocket notification error (markNotificationRead):", socketError);
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("❌ Mark notification read error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // console.log("=== DELETE ORDER DEBUG ===");
    // console.log("Order ID:", id);
    // console.log("=========================");

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID",
      });
    }

    const order = await Order.findByIdAndDelete(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const remainingOrders = await Order.countDocuments();
    if (remainingOrders === 0) {
      // Reset the sequence if no orders remain
      await Sequence.findOneAndUpdate(
        { type: "global_order" },
        { lastSequence: 100 },
        { upsert: true }
      );
      // console.log("✅ Sequence reset to 100 as no orders remain");
    }

    // console.log("✅ Order deleted successfully:", order._id);

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
      data: { id: order._id },
    });
  } catch (error) {
    console.error("❌ Delete order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete order",
      error: error.message,
    });
  }
};

exports.getOrdersByCompanyAndParty = async (req, res) => {
  try {
    const { companyId, partyId } = req.params;

    // console.log("=== GET ORDERS BY COMPANY AND PARTY DEBUG ===");
    // console.log("Company ID:", companyId);
    // console.log("Party ID:", partyId);
    // console.log("============================================");

    if (
      !mongoose.Types.ObjectId.isValid(companyId) ||
      !mongoose.Types.ObjectId.isValid(partyId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Company ID or Party ID",
      });
    }

    const orders = await Order.find({
      companyName: companyId,
      party: partyId,
    })
      .populate("companyName", "companyName avatar")
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
      .populate("productItem", "itemName")
      .populate("createdBy")
      .populate("designer", "name")
      .sort({ createdAt: -1 });

    // console.log(
    //   `📊 Found ${orders.length} orders for company-party combination`
    // );

    res.status(200).json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error("❌ Get orders by company and party error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

exports.getDesignerById = async (req, res) => {
  try {
    const { id } = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Designer ID",
      });
    }

    const orders = await Order.find({ designer: id })
      .populate("companyName", "companyName avatar")
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
      .populate("productItem", "itemName")
      .populate("createdBy")
      .populate("designer", "name")
      .populate("reworkHistory.createdBy", "name")
      .populate("bindingType", "name")
      .sort({ createdAt: -1 });

    // if (!orders || orders.length === 0) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "No orders found for this designer",
    //   });
    // }
    // console.log(orders.filter((el) => el.designerStatus !== "Approved").length);
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("❌ Get orders by designer error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch designer's orders",
      error: error.message,
    });
  }
};

exports.getPrinterById = async (req, res) => {
  try {
    const { id } = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Printer ID",
      });
    }

    const orders = await Order.find({ printer: id })
      .populate("companyName", "companyName avatar")
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
      .populate("productItem", "itemName")
      .populate("createdBy")
      .populate("designer", "name")
      .populate("printer", "name")
      .populate("reworkHistory.createdBy", "name")
      .populate("bindingType", "name")
      .sort({ createdAt: -1 });

    // if (!orders || orders.length === 0) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "No orders found for this printer",
    //   });
    // }

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("❌ Get orders by printer error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch printer's orders",
      error: error.message,
    });
  }
};

exports.getBinderById = async (req, res) => {
  try {
    const { id } = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Binder ID",
      });
    }

    const orders = await Order.find({ binder: id })
      .populate("companyName", "companyName avatar")
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
      .populate("productItem", "itemName")
      .populate("createdBy")
      .populate("designer", "name")
      .populate("printer", "name")
      .populate("binder", "name")
      .populate("bookletBinder", "name")
      .populate("reworkHistory.createdBy", "name")
      .populate("bindingType", "name")
      .sort({ createdAt: -1 });

    // if (!orders || orders.length === 0) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "No orders found for this binder",
    //   });
    // }

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("❌ Get orders by binder error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch binder's orders",
      error: error.message,
    });
  }
};

exports.getBookletBinderById = async (req, res) => {
  try {
    const { id } = req.user;
    // console.log("bookletBinder", id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Booklet Binder ID",
      });
    }

    const orders = await Order.find({ bookletBinder: id })
      .populate("companyName", "companyName avatar")
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
      .populate("productItem", "itemName")
      .populate("createdBy")
      .populate("designer", "name")
      .populate("printer", "name")
      .populate("binder", "name")
      .populate("bookletBinder", "name")
      .populate("reworkHistory.createdBy", "name")
      .populate("bindingType", "name")
      .sort({ createdAt: -1 });

    // console.log("orders", orders);

    // if (!orders || orders.length === 0) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "No orders found for this booklet binder",
    //   });
    // }

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("❌ Get orders by booklet binder error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booklet binder's orders",
      error: error.message,
    });
  }
};

exports.getOrdersByStaffId = async (req, res) => {
  try {
    const { id } = req.params;
    // console.log(id, "id");
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

    const {
      filters = {},
      search = "",
      startDate,
      endDate,
      isPagination = true,
      page = 1,
      pageSize = 10,
      includeCounts = true,
    } = req.body;

    // Build query object - FIXED: Add createdBy = id
    const query = { createdBy: id };

    // Search functionality
    if (search) {
      const directOr = [
        { orderNumber: { $regex: search, $options: "i" } },
        { remarks: { $regex: search, $options: "i" } },
        { size: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];

      // For populated fields: Fetch matching IDs first
      // Company
      const matchingCompanies = await Company.find({
        companyName: { $regex: search, $options: "i" },
      })
        .select("_id")
        .lean();
      const companyIds = matchingCompanies.map((c) => c._id);
      if (companyIds.length > 0) {
        directOr.push({ companyName: { $in: companyIds } });
      }

      // Party
      const matchingParties = await Party.find({
        partyName: { $regex: search, $options: "i" },
      })
        .select("_id")
        .lean();
      const partyIds = matchingParties.map((p) => p._id);
      if (partyIds.length > 0) {
        directOr.push({ party: { $in: partyIds } });
      }

      // Item
      const matchingItems = await ProductItem.find({
        itemName: { $regex: search, $options: "i" },
      })
        .select("_id")
        .lean();
      const itemIds = matchingItems.map((i) => i._id);
      if (itemIds.length > 0) {
        directOr.push({ productItem: { $in: itemIds } });
      }

      // Ordered By (but since createdBy is fixed to id, skip or add if search matches the fixed staff's name - but for now, skip as it's single)

      // Apply $or if multiple
      if (directOr.length > 0) {
        query.$or = directOr;
      }

      // console.log(
      //   "🔍 Built search conditions for staff:",
      //   JSON.stringify(query.$or, null, 2)
      // ); // Debug log
    }

    // Date range filter (unchanged)
    if (startDate || endDate) {
      if (!query.createdAt) query.createdAt = {};
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

    // FIXED: Apply filters same as getAllOrders
    // Company filter
    if (filters.company && filters.company.length > 0) {
      const companies = await Company.find({
        companyName: { $in: filters.company },
      })
        .select("_id")
        .lean();

      if (companies.length > 0) {
        if (query.companyName) {
          query.companyName.$in = [
            ...(query.companyName.$in || []),
            ...companies.map((c) => c._id),
          ];
        } else {
          query.companyName = { $in: companies.map((c) => c._id) };
        }
      }
    }
    // Party filter
    if (filters.party && filters.party.length > 0) {
      const parties = await Party.find({
        partyName: { $in: filters.party },
      })
        .select("_id")
        .lean();

      if (parties.length > 0) {
        query.party = { $in: parties.map((p) => p._id) };
      }
    }

    // Order Status filter
    if (filters.orderStatus && filters.orderStatus.length > 0) {
      query.status = { $in: filters.orderStatus };
    }

    // Item filter
    if (filters.item && filters.item.length > 0) {
      const itemDocs = await ProductItem.find({
        itemName: { $in: filters.item },
      })
        .select("_id")
        .lean();

      if (itemDocs.length > 0) {
        query.productItem = { $in: itemDocs.map((i) => i._id) };
      }
    }

    // Size filter
    if (filters.size && filters.size.length > 0) {
      query.size = { $in: filters.size };
    }

    // Order Number filter
    if (filters.orderNumber && filters.orderNumber.length > 0) {
      query.orderNumber = { $in: filters.orderNumber };
    }

    // Remarks filter
    if (filters.remarks && filters.remarks.length > 0) {
      query.remarks = { $in: filters.remarks };
    }


    // Get total count
    const totalCount = await Order.countDocuments(query);

    // Apply pagination
    let orders = [];
    if (isPagination) {
      const skip = (page - 1) * pageSize;
      orders = await Order.find(query)
        .skip(skip)
        .limit(pageSize)
        .populate({
          path: "companyName",
          select: "companyName",
        })
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
        .populate({
          path: "productItem",
          select: "itemName",
        })
        .populate({
          path: "createdBy",
          select: "firstName lastName",
        })
        .populate({
          path: "designer",
          select: "name",
        })
        .populate({
          path: "printer",
          select: "name",
        })
        .populate({
          path: "binder",
          select: "name",
        })
        .populate({
          path: "bookletBinder",
          select: "name",
        })
        .populate({
          path: "reworkHistory.createdBy",
          select: "name",
        })
        .populate("bindingType", "name")
        .sort({ createdAt: -1 });
    } else {
      orders = await Order.find(query)
        .populate("companyName", "companyName avatar")
        .populate({
          path: "party",
          select: "-__v",
          populate: [
            {
              path: "address.marketName",
              model: "Market",
              select: "marketName",
            },
            { path: "address.landMark", model: "Market", select: "landmark" },
            { path: "address.area", model: "Market", select: "area" },
            { path: "address.pincode", model: "Market", select: "pincode" },
          ],
        })
        .populate("productItem", "itemName")
        .populate("createdBy", "firstName lastName")
        .populate("designer", "name")
        .populate("printer", "name")
        .populate("binder", "name")
        .populate("bookletBinder", "name")
        .populate("reworkHistory.createdBy", "name")
        .populate("bindingType", "name")
        .sort({ createdAt: -1 });
    }

    // Prepare pagination information
    const pagination = isPagination
      ? {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNext: page < Math.ceil(totalCount / pageSize),
        hasPrev: page > 1,
      }
      : null;

    // 4. If no orders found, return an empty array with a message
    if (!orders || orders.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No orders found for this staff member",
        count: 0,
        totalCount: 0,
        data: [],
        pagination: pagination,
      });
    }

    // 5. Return the orders
    res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      count: orders.length,
      totalCount: totalCount, // FIXED: Add totalCount
      data: orders,
      pagination: pagination,
    });
  } catch (error) {
    console.error("Error fetching orders by staff ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

exports.updateStaffStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { statusType, status } = req.body;

    // console.log("📥 Incoming request:", { orderId, statusType, status });

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      // console.log("❌ Invalid Order ID:", orderId);
      return res
        .status(400)
        .json({ success: false, message: "Invalid Order ID" });
    }

    const validStatusTypes = ["printer", "binder", "bookletBinder"];
    const validStatusValues = ["Pending", "In Progress", "Done"];

    if (!validStatusTypes.includes(statusType)) {
      // console.log("❌ Invalid status type:", statusType);
      return res
        .status(400)
        .json({ success: false, message: "Invalid status type" });
    }

    if (!validStatusValues.includes(status)) {
      // console.log("❌ Invalid status value:", status);
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value" });
    }

    // console.log("🔍 Fetching order:", orderId);
    const currentOrder = await Order.findById(orderId)
      .populate("companyName", "companyName avatar")
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
      .populate("productItem", "itemName");

    if (!currentOrder) {
      // console.log("❌ Order not found:", orderId);
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    let startedAtUpdate = {};

    if (status === "In Progress") {
      if (statusType === "printer" && !currentOrder.printingStartedAt) {
        startedAtUpdate.printingStartedAt = new Date();
      }

      if (statusType === "binder" && !currentOrder.bindingStartedAt) {
        startedAtUpdate.bindingStartedAt = new Date();
      }

      if (
        statusType === "bookletBinder" &&
        !currentOrder.bookletBindingStartedAt
      ) {
        startedAtUpdate.bookletBindingStartedAt = new Date();
      }
    }


    const staffRole = await Staff.findById(req.user.id);
    if (!staffRole) {
      // console.log("❌ Staff not found:", req.user.id);
      return res
        .status(404)
        .json({ success: false, message: "Staff not found" });
    }

    // console.log("✅ Staff role found:", staffRole.role);

    // Helper to process inventory for any category
    const processInventory = async (category, papers) => {
      // console.log(`📦 Processing inventory for category: ${category}`);

      if (!papers || !Array.isArray(papers)) {
        // console.log("⚠️ No papers found for", category, papers);
        return;
      }

      for (const paper of papers) {
        // console.log("➡️ Checking paper:", paper);

        if (paper.numberOfSheetsUsed && Number(paper.numberOfSheetsUsed) > 0) {
          // Create outward entry for sheets used
          await Inventory.create({
            category,
            type: "outward",
            material: paper.paperType || "Unknown",
            quantity: Number(paper.numberOfSheetsUsed),
            date: new Date(),
            companyName: currentOrder.companyName || "Unknown",
            for: staffRole.role,
            forCompany: req.user.id,
            orderId: currentOrder._id,
            paperName: paper.paperType || "Unnamed Paper",
            sheetSize: paper.sheetSize || "",
            gsm: paper.gsm || "",
          });
          
          // Create additional outward entry for wastage if any
          if (paper.wastage && Number(paper.wastage) > 0) {
            await Inventory.create({
              category,
              type: "outward",
              material: paper.paperType || "Unknown",
              quantity: Number(paper.wastage),
              date: new Date(),
              companyName: currentOrder.companyName || "Unknown",
              for: staffRole.role,
              forCompany: req.user.id,
              orderId: currentOrder._id,
              paperName: `${paper.paperType || "Unnamed Paper"} (Wastage)`,
              sheetSize: paper.sheetSize || "",
              gsm: paper.gsm || "",
            });
          }
        } else {
          console.log("⚠️ Skipping paper, no sheets used:", paper);
        }
      }
    };

    // Process inventory if status is "Done" - when work is completed
    if (status === "Done") {
      // console.log("🔄 Processing inventory because status = Done");
      if (statusType === "printer") {
        await processInventory("printer", currentOrder.printerPapers);
      } else if (statusType === "binder") {
        await processInventory("binder", currentOrder.binderPapers);
      } else if (statusType === "bookletBinder") {
        await processInventory("booklet", currentOrder.bookletPapers);
      }
    } else {
      console.log(
        "ℹ️ Inventory not processed because status is not Done"
      );
    }

    // Update order status
    const updateField = `${statusType}Status`;
    const notificationField =
      statusType === "printer"
        ? "printerNotificationUnread"
        : statusType === "binder"
          ? "binderNotificationUnread"
          : "bookletBinderNotificationUnread";

    // console.log("📝 Updating order status:", updateField, "=>", status);

    const updatePayload = {
      [updateField]: status,
      ...startedAtUpdate,
    };

    if (status === "Done") {
      updatePayload[notificationField] = true;
    }

    const updatedOrder = await Order.findByIdAndUpdate(orderId, updatePayload, {
      new: true,
    })
      .populate("companyName", "companyName avatar")
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
      .populate("productItem", "itemName");

    console.log("✅ Order updated successfully:", updatedOrder._id);

    try {
      const io = req.app.get("io");
      if (io) {
        const summary = await computeNotificationSummary();
        io.emit("orderNotificationUpdated", {
          orderId: updatedOrder._id,
          summary,
        });
      }
    } catch (socketError) {
      console.error("WebSocket notification error (updateStaffStatus):", socketError);
    }

    return res.status(200).json({
      success: true,
      message: `${statusType} status updated successfully`,
      data: updatedOrder,
    });
  } catch (error) {
    console.error("❌ Update staff status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: error.message,
    });
  }
};

// Assign or update follow-up for an order
// exports.assignFollowUp = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const { staffId, remarks } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(orderId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid Order ID",
//       });
//     }

//     if (!mongoose.Types.ObjectId.isValid(staffId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid Staff ID",
//       });
//     }

//     // Find the order
//     const order = await Order.findById(orderId)
//       .populate("companyName", "companyName")
//       .populate("party", "partyName address")
//       .populate("productItem", "itemName");

//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     // Verify staff exists
//     const staff = await Staff.findById(staffId);
//     if (!staff) {
//       return res.status(404).json({
//         success: false,
//         message: "Staff not found",
//       });
//     }

//     // Create a task for the follow-up
//     const assignTaskData = {
//       companyName: order.companyName._id,
//       partyName: order.party._id,
//       date: new Date(),
//       orderId: order._id,
//       time: moment().format("HH:mm"),
//       reasonForVisit: `Follow up for Order: ${order.orderNumber} - ${order.productItem?.itemName || "N/A"}`,
//       remarks: remarks || `Follow up assigned for order ${order.orderNumber}`,
//       assignTo: staffId,
//       status: "Pending",
//     };

//     const newTask = new AssignTask(assignTaskData);
//     await newTask.save();

//     // Update order with follow-up info
//     const updatedOrder = await Order.findByIdAndUpdate(
//       orderId,
//       {
//         followUp: {
//           staff: staffId,
//           taskId: newTask._id,
//           status: "Pending",
//           assignedAt: new Date(),
//           remarks: remarks || "",
//         },
//       },
//       { new: true }
//     )
//       .populate("companyName", "companyName avatar")
//       .populate({
//         path: "party",
//         select: "-__v",
//         populate: [
//           {
//             path: "address.marketName",
//             model: "Market",
//             select: "marketName",
//           },
//           { path: "address.landMark", model: "Market", select: "landmark" },
//           { path: "address.area", model: "Market", select: "area" },
//           { path: "address.pincode", model: "Market", select: "pincode" },
//         ],
//       })
//       .populate("productItem", "itemName")
//       .populate("createdBy", "firstName lastName")
//       .populate("followUp.staff", "firstName lastName")
//       .populate("followUp.taskId", "status");

//     res.status(200).json({
//       success: true,
//       message: "Follow-up assigned successfully",
//       data: updatedOrder,
//     });
//   } catch (error) {
//     console.error("❌ Assign follow-up error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to assign follow-up",
//       error: error.message,
//     });
//   }
// };

// // Update follow-up status
// exports.updateFollowUpStatus = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const { status } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(orderId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid Order ID",
//       });
//     }

//     if (!["Pending", "In Progress", "Completed", "Cancelled"].includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid status value",
//       });
//     }

//     const order = await Order.findById(orderId);
//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     if (!order.followUp || !order.followUp.staff) {
//       return res.status(400).json({
//         success: false,
//         message: "No follow-up assigned to this order",
//       });
//     }

//     // Update order follow-up status
//     const updatedOrder = await Order.findByIdAndUpdate(
//       orderId,
//       {
//         "followUp.status": status,
//       },
//       { new: true }
//     )
//       .populate("companyName", "companyName avatar")
//       .populate({
//         path: "party",
//         select: "-__v",
//         populate: [
//           {
//             path: "address.marketName",
//             model: "Market",
//             select: "marketName",
//           },
//           { path: "address.landMark", model: "Market", select: "landmark" },
//           { path: "address.area", model: "Market", select: "area" },
//           { path: "address.pincode", model: "Market", select: "pincode" },
//         ],
//       })
//       .populate("productItem", "itemName")
//       .populate("createdBy", "firstName lastName")
//       .populate("followUp.staff", "firstName lastName")
//       .populate("followUp.taskId", "status");

//     // Also update the associated task status
//     if (order.followUp.taskId) {
//       await AssignTask.findByIdAndUpdate(order.followUp.taskId, {
//         status: status,
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Follow-up status updated successfully",
//       data: updatedOrder,
//     });
//   } catch (error) {
//     console.error("❌ Update follow-up status error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update follow-up status",
//       error: error.message,
//     });
//   }
// };



exports.assignFollowUp = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { staffId, remarks, date } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Staff ID",
      });
    }

    // Find the order
    const order = await Order.findById(orderId)
      .populate("companyName", "companyName")
      .populate("party", "partyName address")
      .populate("productItem", "itemName");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify staff exists
    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    // Delete ALL existing tasks for this order when reassigning
    await AssignTask.deleteMany({ orderId: order._id });

    // Create a task for the follow-up with orderId in the task data
    const assignTaskData = {
      companyName: order.companyName._id,
      partyName: order.party._id,
      date: date ? new Date(date) : new Date(),
      orderId: order._id, // Pass orderId to the task
      time: moment().format("HH:mm"),
      reasonForVisit: `Follow up for Order: ${order.orderNumber} - ${order.productItem?.itemName || "N/A"}`,
      remarks: remarks || `Follow up assigned for order ${order.orderNumber}`,
      assignTo: staffId,
      status: "Pending",
    };

    const newTask = new AssignTask(assignTaskData);
    await newTask.save();

    // Update order with follow-up info
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        followUp: {
          staff: staffId,
          taskId: newTask._id,
          status: "Pending",
          assignedAt: new Date(),
          remarks: remarks || "",
          date: date ? new Date(date) : new Date(),
        },
      },
      { new: true }
    )
      .populate("companyName", "companyName avatar")
      .populate({
        path: "party",
        select: "-__v",
        populate: [
          {
            path: "address.marketName",
            model: "Market",
            select: "marketName",
          },
          { path: "address.landMark", model: "Market", select: "landmark" },
          { path: "address.area", model: "Market", select: "area" },
          { path: "address.pincode", model: "Market", select: "pincode" },
        ],
      })
      .populate("productItem", "itemName")
      .populate("createdBy", "firstName lastName")
      .populate("followUp.staff", "firstName lastName")
      .populate("followUp.taskId", "status rescheduleDate");

    res.status(200).json({
      success: true,
      message: "Follow-up assigned successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("❌ Assign follow-up error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign follow-up",
      error: error.message,
    });
  }
};

// Update follow-up status
exports.updateFollowUpStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID",
      });
    }

    if (!["Pending", "In Progress", "Completed", "Cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!order.followUp || !order.followUp.staff) {
      return res.status(400).json({
        success: false,
        message: "No follow-up assigned to this order",
      });
    }

    // Update order follow-up status
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        "followUp.status": status,
      },
      { new: true }
    )
      .populate("companyName", "companyName avatar")
      .populate({
        path: "party",
        select: "-__v",
        populate: [
          {
            path: "address.marketName",
            model: "Market",
            select: "marketName",
          },
          { path: "address.landMark", model: "Market", select: "landmark" },
          { path: "address.area", model: "Market", select: "area" },
          { path: "address.pincode", model: "Market", select: "pincode" },
        ],
      })
      .populate("productItem", "itemName")
      .populate("createdBy", "firstName lastName")
      .populate("followUp.staff", "firstName lastName")
      .populate("followUp.taskId", "status");

    // Also update ALL associated tasks status for this order
    await AssignTask.updateMany(
      { orderId: order._id },
      { status: status }
    );

    res.status(200).json({
      success: true,
      message: "Follow-up status updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("❌ Update follow-up status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update follow-up status",
      error: error.message,
    });
  }
};