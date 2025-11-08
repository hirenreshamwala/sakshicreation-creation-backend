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

// Get all Packaging Options
exports.getAllPackagingOptions = async (req, res) => {
  try {
    const options = await PackagingOption.find()
      .populate("party") // Populate the party reference
      .sort({ createdAt: -1 });
    return res.status(200).json({ data: options });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
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