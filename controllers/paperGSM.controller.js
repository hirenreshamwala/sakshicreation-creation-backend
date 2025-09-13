const PaperGSM = require("../models/paperGSM.model");
const Papa = require("papaparse");

// Create a new Packaging Option
exports.createPaperGSM = async (req, res) => {
  try {
    const { name, length, width, height } = req.body;

    if (!length || !width || !height) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newOption = new PaperGSM({ name, length, width, height });
    await newOption.save();

    return res.status(201).json({
      message: "Paper GSM created successfully",
      data: newOption,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// Get all Packaging Options
exports.getAllPaperGSM = async (req, res) => {
  try {
    const options = await PaperGSM.find().sort({ createdAt: -1 });
    return res.status(200).json({ data: options });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// Edit (Update) a Packaging Option
exports.updatePaperGSM = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, length, width, height } = req.body;

    const updatedOption = await PaperGSM.findByIdAndUpdate(
      id,
      { name, length, width, height },
      { new: true, runValidators: true }
    );

    if (!updatedOption) {
      return res.status(404).json({ message: "Paper GSM not found" });
    }

    return res.status(200).json({
      message: "Paper GSM updated successfully",
      data: updatedOption,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// Delete a Packaging Option
exports.deletePaperGSM = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedOption = await PaperGSM.findByIdAndDelete(id);

    if (!deletedOption) {
      return res.status(404).json({ message: "Paper GSM not found" });
    }

    return res
      .status(200)
      .json({ message: "Paper GSM deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// Bulk Upload Packaging Options
exports.bulkUploadPaperGSM = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileContent = req.file.buffer.toString("utf8");

    if (!fileContent) {
      return res.status(400).json({ message: "Uploaded file is empty" });
    }

    const parsedData = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    const records = parsedData.data;

    const validRecords = [];
    for (const row of records) {
      const { name, length, width, height } = row;
      if (!length || !width || !height) {
        return res
          .status(400)
          .json({ message: "All fields (length, width, height) are required in every row" });
      }
      validRecords.push({ name, length, width, height });
    }

    const insertedOptions = await PaperGSM.insertMany(validRecords);

    return res.status(201).json({
      message: "Bulk upload successful",
      insertedCount: insertedOptions.length,
      data: insertedOptions,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};