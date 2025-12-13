const PackagingOption = require("../models/packagingOption.model");
const Papa = require("papaparse");
const mongoose = require("mongoose");
const Party = require("../models/Party.model");

// Create a new Packaging Option
exports.createPackagingOption = async (req, res) => {
  try {
    const { party, ply, length, width, height, deckal, paper1GSM, paper2GSM, paper3GSM, noOfPieces, ratePerPiece, isKantan, kantan } = req.body;

    // Validate all required fields
    if (!ply || !length || !width || !height || !deckal || !paper1GSM || !paper2GSM || !paper3GSM || !noOfPieces || !ratePerPiece) {
      return res.status(400).json({ message: "All fields (ply, length, width, height, deckal, paper1GSM, paper2GSM, paper3GSM, no of pieces, rate per piece) are required" });
    }

    if (isKantan === true && !kantan) {
      return res.status(400).json({
        message: "Kantan field is required when isKantan is true"
      });
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
      isKantan,
      kantan
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
      isKantan: isKantan || false,
      kantan: isKantan ? kantan : null
    });
    await newOption.save();
    await newOption.populate(["party", "kantan"]);
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
      .populate("party")
      .populate("kantan", "kantanName") // NEW: populate kantan
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
    const { party, ply, length, width, height, deckal, paper1GSM, paper2GSM, paper3GSM, noOfPieces, ratePerPiece, isKantan, kantan } = req.body;

    // Validate all required fields
    if (!ply || !length || !width || !height || !deckal || !paper1GSM || !paper2GSM || !paper3GSM || !noOfPieces || !ratePerPiece) {
      return res.status(400).json({ message: "All fields (ply, length, width, height, deckal, paper1GSM, paper2GSM, paper3GSM, no of pieces, rate per piece) are required" });
    }

    if (isKantan === true && !kantan) {
      return res.status(400).json({
        message: "Kantan field is required when isKantan is true"
      });
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
      isKantan,
      kantan,
      _id: { $ne: id },
    });

    if (existingOption) {
      return res.status(400).json({ message: "Data already exists" });
    }

    const updatedOption = await PackagingOption.findByIdAndUpdate(
      id,
      { party, ply, length, width, height, deckal, paper1GSM, paper2GSM, paper3GSM, noOfPieces, ratePerPiece, isKantan: isKantan || false, kantan: isKantan ? kantan : null },
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
      transform: (value, field) => {
        // Trim whitespace from all fields
        if (typeof value === 'string') {
          return value.trim();
        }
        return value;
      }
    });

    const records = parsedData.data;
    const validRecords = [];
    const skippedRecords = [];

    for (const [index, row] of records.entries()) {
      try {
        const { 
          party, ply, length, width, height, deckal, 
          paper1GSM, paper2GSM, paper3GSM,
          noOfPieces, ratePerPiece,
          isKantan, kantan // Kantan will be name, not ID
        } = row;

        // Validate required fields
        if (!party || !ply || !length || !width || !height || !deckal || !paper1GSM || !paper2GSM || !paper3GSM) {
          skippedRecords.push({
            row: index + 1,
            ...row,
            reason: "Missing required fields",
          });
          continue;
        }

        // Parse isKantan (can be "true", "false", "1", "0", "yes", "no", etc.)
        let parsedIsKantan = false;
        if (isKantan) {
          const isKantanStr = isKantan.toString().toLowerCase().trim();
          parsedIsKantan = (
            isKantanStr === "true" || 
            isKantanStr === "1" || 
            isKantanStr === "yes" || 
            isKantanStr === "y"
          );
        }

        // Validate if isKantan is true, then kantan name must be provided
        if (parsedIsKantan && (!kantan || kantan.trim() === "")) {
          skippedRecords.push({
            row: index + 1,
            ...row,
            reason: "Kantan name is required when isKantan is true",
          });
          continue;
        }

        // Find party by name in Party model
        const partyDoc = await Party.findOne({ 
          partyName: { $regex: new RegExp(`^${party.trim()}$`, 'i') }
        }).session(session);
        
        if (!partyDoc) {
          skippedRecords.push({
            row: index + 1,
            ...row,
            reason: `Party not found: ${party}`,
          });
          continue;
        }

        // If isKantan is true, find kantan by name
        let kantanId = null;
        if (parsedIsKantan && kantan) {
          const kantanDoc = await mongoose.model("Kantan").findOne({ 
            kantanName: { $regex: new RegExp(`^${kantan.trim()}$`, 'i') }
          }).session(session);
          
          if (!kantanDoc) {
            skippedRecords.push({
              row: index + 1,
              ...row,
              reason: `Kantan not found: ${kantan}`,
            });
            continue;
          }
          kantanId = kantanDoc._id;
        }

        // Check for duplicate (case-insensitive comparison for strings)
        const existingOption = await PackagingOption.findOne({
          party: partyDoc._id,
          ply: ply.trim(),
          length: length.trim(),
          width: width.trim(),
          height: height.trim(),
          deckal: deckal.trim(),
          paper1GSM: paper1GSM.trim(),
          paper2GSM: paper2GSM.trim(),
          paper3GSM: paper3GSM.trim(),
          noOfPieces: noOfPieces ? noOfPieces.trim() : "",
          ratePerPiece: ratePerPiece ? ratePerPiece.trim() : "",
          isKantan: parsedIsKantan,
          kantan: kantanId
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
          ply: ply.trim(),
          length: length.trim(),
          width: width.trim(),
          height: height.trim(),
          deckal: deckal.trim(),
          paper1GSM: paper1GSM.trim(),
          paper2GSM: paper2GSM.trim(),
          paper3GSM: paper3GSM.trim(),
          noOfPieces: noOfPieces ? noOfPieces.trim() : "",
          ratePerPiece: ratePerPiece ? ratePerPiece.trim() : "",
          isKantan: parsedIsKantan,
          kantan: kantanId
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

    // Populate party and kantan for each inserted option
    const populatedOptions = await Promise.all(
      insertedOptions.map(async (opt) => {
        return await PackagingOption.findById(opt._id)
          .populate("party")
          .populate("kantan", "kantanName")
          .session(session);
      })
    );

    await session.commitTransaction();
    session.endSession();

    // Generate CSV for skipped records
    let skippedCsv = "";
    if (skippedRecords.length > 0) {
      skippedCsv = Papa.unparse([
        {
          party: "party (Party Name)",
          ply: "ply",
          length: "length",
          width: "width",
          height: "height",
          deckal: "deckal",
          paper1GSM: "paper1GSM",
          paper2GSM: "paper2GSM",
          paper3GSM: "paper3GSM",
          noOfPieces: "noOfPieces",
          ratePerPiece: "ratePerPiece",
          isKantan: "isKantan (true/false)",
          kantan: "kantan (Kantan Name if isKantan=true)",
          reason: "reason",
        },
        ...skippedRecords,
      ]);
    }

    // Set headers for CSV download if there are skipped records
    if (skippedCsv) {
      res.setHeader("Content-Disposition", "attachment; filename=skipped_packaging_options.csv");
      res.setHeader("Content-Type", "text/csv");
      return res.status(201).send(skippedCsv);
    }

    return res.status(201).json({
      success: true,
      message: "Bulk upload processed successfully",
      insertedCount: populatedOptions.length,
      skippedCount: skippedRecords.length,
      skippedRecords,
      data: populatedOptions,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Error in bulk upload:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};