const PackagingOption = require("../models/packagingOption.model");
const Papa = require("papaparse");
const mongoose = require("mongoose");
const Party = require("../models/Party.model");

// Create a new Packaging Option
exports.createPackagingOption = async (req, res) => {
  try {
    const { party, ply, length, width, height, deckal, paper1GSM, paper2GSM, paper3GSM, noOfPieces, ratePerPiece } = req.body;

    // Validate all required fields
    if (!ply || !length || !width || !height || !deckal || !paper1GSM || !paper2GSM || !paper3GSM || !noOfPieces || !ratePerPiece) {
      return res.status(400).json({ message: "All fields (ply, length, width, height, deckal, paper1GSM, paper2GSM, paper3GSM, no of pieces, rate per piece) are required" });
    }

    // Check if identical data already exists
    const existingOption = await PackagingOption.findOne({
      party,
      ply,
      length,
      width,
      height,
      deckal,
      paper1GSM,
      paper2GSM,
      paper3GSM,
      noOfPieces,
      ratePerPiece,
    });

    if (existingOption) {
      return res.status(400).json({ message: "Data already exists" });
    }

    const newOption = new PackagingOption({
      party,
      ply,
      length,
      width,
      height,
      deckal,
      paper1GSM,
      paper2GSM,
      paper3GSM,
      noOfPieces,
      ratePerPiece,
    });
    await newOption.save();
    await newOption.populate("party"); // Populate party to include partyName in response

    return res.status(201).json({
      message: "Packaging option created successfully",
      data: newOption,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// controllers/packagingOptionController.js
exports.getAllPackagingOptions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      dates = [],
      parties = [],
      plys = [],
      lengths = [],
      widths = [],
      heights = [],
      deckals = [],
      paper1GSMs = [],
      paper2GSMs = [],
      paper3GSMs = [],
      noOfPieces = [],
      ratePerPiece = [],
    } = req.query;

    // SAFELY CONVERT STRING → ARRAY
    const toArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      return [val];
    };

    const datesArr      = toArray(dates);
    const partiesArr    = toArray(parties);
    const plysArr       = toArray(plys);
    const lengthsArr    = toArray(lengths);
    const widthsArr     = toArray(widths);
    const heightsArr    = toArray(heights);
    const deckalsArr    = toArray(deckals);
    const paper1GSMsArr = toArray(paper1GSMs);
    const paper2GSMsArr = toArray(paper2GSMs);
    const paper3GSMsArr = toArray(paper3GSMs);
    const noOfPiecesArr = toArray(noOfPieces);
    const ratePerPieceArr = toArray(ratePerPiece);

    let filter = {};

    // 1. Search
    if (search) {
      filter.$or = [
        { ply: { $regex: search, $options: "i" } },
        { length: { $regex: search, $options: "i" } },
        { width: { $regex: search, $options: "i" } },
        { height: { $regex: search, $options: "i" } },
        { "party.partyName": { $regex: search, $options: "i" } },
      ];
    }

    // 2. Party Filter
    if (partiesArr.length > 0) {
      const partyDocs = await Party.find({
        partyName: { $in: partiesArr.map(name => new RegExp(`^${name}$`, 'i')) }
      }).lean();

      const partyIds = partyDocs.map(p => p._id);
      if (partyIds.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { currentPage: +page, totalPages: 0, totalItems: 0, itemsPerPage: +limit }
        });
      }
      filter.party = { $in: partyIds };
    }

    // 3. Simple filters (convert to Number where needed)
    if (plysArr.length) filter.ply = { $in: plysArr.map(Number) };
    if (lengthsArr.length) filter.length = { $in: lengthsArr.map(Number) };
    if (widthsArr.length) filter.width = { $in: widthsArr.map(Number) };
    if (heightsArr.length) filter.height = { $in: heightsArr.map(Number) };
    if (deckalsArr.length) filter.deckal = { $in: deckalsArr.map(Number) };
    if (paper1GSMsArr.length) filter.paper1GSM = { $in: paper1GSMsArr.map(Number) };
    if (paper2GSMsArr.length) filter.paper2GSM = { $in: paper2GSMsArr.map(Number) };
    if (paper3GSMsArr.length) filter.paper3GSM = { $in: paper3GSMsArr.map(Number) };
    if (noOfPiecesArr.length) filter.noOfPieces = { $in: noOfPiecesArr.map(Number) };
    if (ratePerPieceArr.length) filter.ratePerPiece = { $in: ratePerPieceArr.map(Number) };

    // 4. MULTIPLE EXACT DATES FILTER (DD/MM/YYYY) – SAME AS STAFF PAGE
    if (datesArr.length > 0) {
      const dateConditions = datesArr.map(dateStr => {
        const [day, month, year] = dateStr.split('/');
        if (!day || !month || !year) return null;

        const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
        const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

        return {
          $or: [
            { createdAt: { $gte: start, $lte: end } },
            { updatedAt: { $gte: start, $lte: end } }
          ]
        };
      }).filter(Boolean);

      if (dateConditions.length > 0) {
        filter.$and = filter.$and || [];
        filter.$and.push({ $or: dateConditions });
      }
    }

    console.log("Final Filter →", JSON.stringify(filter, null, 2));

    const total = await PackagingOption.countDocuments(filter);

    const data = await PackagingOption.find(filter)
      .populate("party", "partyName")
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    res.json({
      success: true,
      data,
      pagination: {
        currentPage: +page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: +limit,
      },
    });
  } catch (err) {
    console.error("getAllPackagingOptions error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
// GET /api/packaging-options/filters
exports.getPackagingFilters = async (req, res) => {
  try {
    const [
      partyIds,
      plys, lengths, widths, heights, deckals,
      paper1GSMs, paper2GSMs, paper3GSMs,
      noOfPiecesList, ratePerPieceList
    ] = await Promise.all([
      PackagingOption.distinct("party"),
      PackagingOption.distinct("ply"),
      PackagingOption.distinct("length"),
      PackagingOption.distinct("width"),
      PackagingOption.distinct("height"),
      PackagingOption.distinct("deckal"),
      PackagingOption.distinct("paper1GSM"),
      PackagingOption.distinct("paper2GSM"),
      PackagingOption.distinct("paper3GSM"),
      PackagingOption.distinct("noOfPieces"),
      PackagingOption.distinct("ratePerPiece"),
    ]);

    const partyDocs = await Party.find({ _id: { $in: partyIds } }).select("partyName");
    const partyNames = partyDocs.map(p => p.partyName).sort();

    // Get unique DD/MM/YYYY dates from createdAt & updatedAt
    const dateResult = await PackagingOption.aggregate([
      {
        $match: {
          $or: [{ createdAt: { $exists: true } }, { updatedAt: { $exists: true } }]
        }
      },
      {
        $project: {
          dates: {
            $setUnion: [
              [{ $dateToString: { format: "%d/%m/%Y", date: "$createdAt", timezone: "UTC" } }],
              [{ $dateToString: { format: "%d/%m/%Y", date: "$updatedAt", timezone: "UTC" } }]
            ]
          }
        }
      },
      { $unwind: "$dates" },
      { $match: { dates: { $ne: null, $ne: "" } } },
      { $group: { _id: "$dates" } },
      { $sort: { _id: -1 } }
    ]);

    const dates = dateResult.map(d => d._id);

    res.json({
      success: true,
      parties: partyNames,
      plys: plys.sort((a,b) => a - b),
      lengths: lengths.sort((a,b) => a - b),
      widths: widths.sort((a,b) => a - b),
      heights: heights.sort((a,b) => a - b),
      deckals: deckals.sort((a,b) => a - b),
      paper1GSMs: paper1GSMs.sort((a,b) => a - b),
      paper2GSMs: paper2GSMs.sort((a,b) => a - b),
      paper3GSMs: paper3GSMs.sort((a,b) => a - b),
      noOfPiecesOptions: noOfPiecesList.sort((a,b) => a - b),
      ratePerPieceOptions: ratePerPieceList.sort((a,b) => a - b),
      dates,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to load filters" });
  }
};
// Edit (Update) a Packaging Option
exports.updatePackagingOption = async (req, res) => {
  try {
    const { id } = req.params;
    const { party, ply, length, width, height, deckal, paper1GSM, paper2GSM, paper3GSM, noOfPieces, ratePerPiece } = req.body;

    // Validate all required fields
    if (!ply || !length || !width || !height || !deckal || !paper1GSM || !paper2GSM || !paper3GSM || !noOfPieces || !ratePerPiece) {
      return res.status(400).json({ message: "All fields (ply, length, width, height, deckal, paper1GSM, paper2GSM, paper3GSM, no of pieces, rate per piece) are required" });
    }

    // Check if identical data already exists (excluding the current record)
    const existingOption = await PackagingOption.findOne({
      party,
      ply,
      length,
      width,
      height,
      deckal,
      paper1GSM,
      paper2GSM,
      paper3GSM,
      noOfPieces,
      ratePerPiece,
      _id: { $ne: id },
    });

    if (existingOption) {
      return res.status(400).json({ message: "Data already exists" });
    }

    const updatedOption = await PackagingOption.findByIdAndUpdate(
      id,
      { party, ply, length, width, height, deckal, paper1GSM, paper2GSM, paper3GSM, noOfPieces, ratePerPiece },
      { new: true, runValidators: true }
    ).populate("party");

    if (!updatedOption) {
      return res.status(404).json({ message: "Packaging option not found" });
    }

    return res.status(200).json({
      message: "Packaging option updated successfully",
      data: updatedOption,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// Delete a Packaging Option
exports.deletePackagingOption = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedOption = await PackagingOption.findByIdAndDelete(id);

    if (!deletedOption) {
      return res.status(404).json({ message: "Packaging option not found" });
    }

    return res
      .status(200)
      .json({ message: "Packaging option deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

exports.bulkUploadPackagingOptions = async (req, res) => {
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

    const fileContent = req.file.buffer.toString("utf8");

    if (!fileContent) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Uploaded file is empty",
      });
    }

    const parsedData = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    const records = parsedData.data;
    const validRecords = [];
    const skippedRecords = [];

    for (const [index, row] of records.entries()) {
      try {
        const { 
          party, ply, length, width, height, deckal, 
          paper1GSM, paper2GSM, paper3GSM,
          noOfPieces, ratePerPiece // Add new fields
        } = row;

        // Validate required fields (only existing ones are required)
        if (!party || !ply || !length || !width || !height || !deckal || !paper1GSM || !paper2GSM || !paper3GSM) {
          skippedRecords.push({
            row: index + 1,
            ...row,
            reason: "Missing required fields",
          });
          continue;
        }

        // Find party by name in Party model
        const partyDoc = await Party.findOne({ partyName: party.trim().toUpperCase() }).session(session);
        if (!partyDoc) {
          skippedRecords.push({
            row: index + 1,
            ...row,
            reason: `Party not found: ${party}`,
          });
          continue;
        }

        // Check for duplicate
        const existingOption = await PackagingOption.findOne({
          party: partyDoc._id,
          ply,
          length,
          width,
          height,
          deckal,
          paper1GSM,
          paper2GSM,
          paper3GSM,
          noOfPieces, // Include in duplicate check
          ratePerPiece, // Include in duplicate check
        }).session(session);

        if (existingOption) {
          skippedRecords.push({
            row: index + 1,
            ...row,
            reason: "Data already exists",
          });
          continue;
        }

        // Push with ObjectId
        validRecords.push({
          party: partyDoc._id,
          ply,
          length,
          width,
          height,
          deckal,
          paper1GSM,
          paper2GSM,
          paper3GSM,
          noOfPieces, // Add new fields
          ratePerPiece, // Add new fields
        });

      } catch (err) {
        skippedRecords.push({
          row: index + 1,
          ...row,
          reason: err.message || "Invalid data",
        });
        continue;
      }
    }

    let insertedOptions = [];
    if (validRecords.length > 0) {
      insertedOptions = await PackagingOption.insertMany(validRecords, { session });
    }

    // Populate party for each inserted option
    const populatedOptions = await Promise.all(
      insertedOptions.map(async (opt) => {
        return await PackagingOption.findById(opt._id).populate("party").session(session);
      })
    );

    await session.commitTransaction();
    session.endSession();

    // Generate CSV for skipped records
    let skippedCsv = "";
    if (skippedRecords.length > 0) {
      skippedCsv = Papa.unparse([
        {
          party: "party",
          ply: "ply",
          length: "length",
          width: "width",
          height: "height",
          deckal: "deckal",
          paper1GSM: "paper1GSM",
          paper2GSM: "paper2GSM",
          paper3GSM: "paper3GSM",
          noOfPieces: "noOfPieces", // Add new headers
          ratePerPiece: "ratePerPiece", // Add new headers
          reason: "reason",
        },
        ...skippedRecords,
      ]);
    }

    // Set headers for CSV download if there are skipped records
    if (skippedCsv) {
      res.setHeader("Content-Disposition", "attachment; filename=skipped_packaging_options.csv");
      res.setHeader("Content-Type", "text/csv");
    }

    return res.status(201).json({
      success: true,
      message: "Bulk upload processed",
      insertedCount: populatedOptions.length,
      skippedCount: skippedRecords.length,
      skippedRecords,
      data: populatedOptions,
      skippedCsv: skippedCsv || null,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};