const BinderType = require("../models/binderType"); // Import model
const mongoose = require("mongoose");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

// 🔹 Create a new binder type
exports.createBinderType = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Binder type name is required" });
    }

    // Check duplicate (case-insensitive)
    const existing = await BinderType.findOne({ name: { $regex: `^${name}$`, $options: "i" } });
    if (existing) {
      return res.status(409).json({ success: false, message: "Binder type already exists" });
    }

    const newBinderType = new BinderType({ name });
    await newBinderType.save();

    res.status(201).json({
      success: true,
      message: "Binder type created successfully",
      data: newBinderType,
    });
  } catch (error) {
    console.error("Error creating binder type:", error);
    res.status(500).json({ success: false, message: "Failed to create binder type", error: error.message });
  }
};

// 🔹 Get all binder types
exports.getAllBinderTypes = async (req, res) => {
  try {
    const binderTypes = await BinderType.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: binderTypes });
  } catch (error) {
    console.error("Error fetching binder types:", error);
    res.status(500).json({ success: false, message: "Failed to fetch binder types", error: error.message });
  }
};

// 🔹 Get binder type by ID
exports.getBinderTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid binder type ID" });
    }

    const binderType = await BinderType.findById(id);
    if (!binderType) {
      return res.status(404).json({ success: false, message: "Binder type not found" });
    }

    res.status(200).json({ success: true, data: binderType });
  } catch (error) {
    console.error("Error fetching binder type:", error);
    res.status(500).json({ success: false, message: "Failed to fetch binder type", error: error.message });
  }
};

// 🔹 Update binder type
exports.updateBinderType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid binder type ID" });
    }

    if (!name) {
      return res.status(400).json({ success: false, message: "Binder type name is required" });
    }

    const updatedBinderType = await BinderType.findByIdAndUpdate(
      id,
      { name },
      { new: true, runValidators: true }
    );

    if (!updatedBinderType) {
      return res.status(404).json({ success: false, message: "Binder type not found" });
    }

    res.status(200).json({
      success: true,
      message: "Binder type updated successfully",
      data: updatedBinderType,
    });
  } catch (error) {
    console.error("Error updating binder type:", error);
    res.status(500).json({ success: false, message: "Failed to update binder type", error: error.message });
  }
};

// 🔹 Delete binder type
exports.deleteBinderType = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid binder type ID" });
    }

    const deletedBinderType = await BinderType.findByIdAndDelete(id);
    if (!deletedBinderType) {
      return res.status(404).json({ success: false, message: "Binder type not found" });
    }

    res.status(200).json({
      success: true,
      message: "Binder type deleted successfully",
      data: deletedBinderType,
    });
  } catch (error) {
    console.error("Error deleting binder type:", error);
    res.status(500).json({ success: false, message: "Failed to delete binder type", error: error.message });
  }
};

// 🔹 Bulk Upload Binder Types via CSV
exports.bulkCreateBinderTypes = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const results = [];
    const filePath = path.join(__dirname, "../Uploads", file.filename);

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          const binderTypes = [];

          for (const row of results) {
            const { name } = row;

            if (!name) {
              return res.status(400).json({
                success: false,
                message: `Missing name in row: ${JSON.stringify(row)}`,
              });
            }

            const existing = await BinderType.findOne({ name: { $regex: `^${name}$`, $options: "i" } });
            if (existing) {
              return res.status(400).json({
                success: false,
                message: `Binder type "${name}" already exists in row: ${JSON.stringify(row)}`,
              });
            }

            binderTypes.push({ name });
          }

          const savedBinderTypes = await BinderType.insertMany(binderTypes);
          fs.unlinkSync(filePath);

          res.status(200).json({
            success: true,
            message: "Bulk binder type upload completed successfully",
            count: savedBinderTypes.length,
            data: savedBinderTypes,
          });
        } catch (error) {
          console.error("Error processing bulk upload:", error);
          fs.unlinkSync(filePath);
          res.status(500).json({
            success: false,
            message: `Failed to process bulk upload: ${error.message}`,
          });
        }
      });
  } catch (error) {
    console.error("Error in bulk upload:", error);
    res.status(500).json({
      success: false,
      message: `Server error during bulk upload: ${error.message}`,
    });
  }
};
