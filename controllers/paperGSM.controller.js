const PaperGSM = require("../models/paperGSM.model");
const Papa = require("papaparse");

// Create a new Packaging Option
exports.createPaperGSM = async (req, res) => {
  try {
    const { name, deckal, gsm } = req.body;

    if (!deckal || !gsm ) {
      return res.status(400).json({ message: "Deckal and GSM are required" });
    }

    const newOption = new PaperGSM({ name, deckal, gsm });
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
    const { name, deckal, gsm} = req.body;

    const updatedOption = await PaperGSM.findByIdAndUpdate(
      id,
      { name, deckal, gsm },
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
      const { name, deckal, gsm } = row;
      if (!deckal || !gsm ) {
        return res
          .status(400)
          .json({ message: "All fields (deckal, gsm) are required in every row" });
      }
      validRecords.push({ name, deckal, gsm });
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


exports.getByDeckal = async (req, res) => {
  try {
    const { deckal } = req.query;
    if (!deckal) return res.status(400).json({ message: "Deckal required" });

    const deckalNum = Number(deckal);

    // Find all docs where deckal matches numerically
    const results = await PaperGSM.find({
      $expr: { $eq: [{ $toDouble: "$deckal" }, deckalNum] }
    });

    // unique GSM list with id
    const uniqueGSMs = results.map((r) => ({
      id: r._id,
      value: r.gsm,
      label: r.gsm,
    }));

    res.json({ gsmOptions: uniqueGSMs });
  } catch (err) {
    console.error("Error fetching by deckal:", err);
    res.status(500).json({ message: "Server Error" });
  }
};