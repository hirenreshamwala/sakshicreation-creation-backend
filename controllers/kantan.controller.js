const Kantan = require("../models/kantan.model");
const Papa = require("papaparse");

// ✅ Create a new Kantan
exports.createKantan = async (req, res) => {
  try {
    const { kantanName } = req.body;

    if (!kantanName) {
      return res.status(400).json({ message: "Kantan Name is required" });
    }

    const newKantan = new Kantan({
      kantanName,
    });

    await newKantan.save();

    return res.status(200).json({
      message: "Kantan created successfully",
      data: newKantan,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ✅ Get all Kantans
exports.getAllKantans = async (req, res) => {
  try {
    const kantans = await Kantan.find().select("kantanName").sort({ createdAt: -1 });
    return res.status(200).json({ data: kantans });
  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ✅ Update a Kantan
exports.updateKantan = async (req, res) => {
  try {
    const { id } = req.params;
    const { kantanName } = req.body;

    const updatedKantan = await Kantan.findByIdAndUpdate(
      id,
      { kantanName },
      { new: true, runValidators: true }
    );

    if (!updatedKantan) {
      return res.status(404).json({ message: "Kantan not found" });
    }

    return res.status(200).json({
      message: "Kantan updated successfully",
      data: updatedKantan,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ✅ Delete a Kantan
exports.deleteKantan = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedKantan = await Kantan.findByIdAndDelete(id);

    if (!deletedKantan) {
      return res.status(404).json({ message: "Kantan not found" });
    }

    return res.status(200).json({ message: "Kantan deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ✅ Bulk Upload Kantans
exports.bulkUploadKantans = async (req, res) => {
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
      const { kantanName } = row;
      if (!kantanName) {
        return res
          .status(400)
          .json({ message: "Kantan Name is required in every row" });
      }
      validRecords.push({ kantanName });
    }

    const insertedKantans = await Kantan.insertMany(validRecords);

    return res.status(200).json({
      message: "Bulk upload successful",
      insertedCount: insertedKantans.length,
      data: insertedKantans,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};