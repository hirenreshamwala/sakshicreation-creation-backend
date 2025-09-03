const PackagingOption = require("../models/packagingOption.model");

// ✅ Create a new Packaging Option
exports.createPackagingOption = async (req, res) => {
  try {
    const { ply, size, gsm, deckal } = req.body;

    if (!ply || !size || !gsm || !deckal) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newOption = new PackagingOption({ ply, size, gsm, deckal });
    await newOption.save();

    return res.status(201).json({
      message: "Packaging option created successfully",
      data: newOption,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ✅ Get all Packaging Options
exports.getAllPackagingOptions = async (req, res) => {
  try {
    const options = await PackagingOption.find().sort({ createdAt: -1 });
    return res.status(200).json({ data: options });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ✅ Edit (Update) a Packaging Option
exports.updatePackagingOption = async (req, res) => {
  try {
    const { id } = req.params;
    const { ply, size, gsm, deckal } = req.body;

    const updatedOption = await PackagingOption.findByIdAndUpdate(
      id,
      { ply, size, gsm, deckal },
      { new: true, runValidators: true }
    );

    if (!updatedOption) {
      return res.status(404).json({ message: "Packaging option not found" });
    }

    return res.status(200).json({
      message: "Packaging option updated successfully",
      data: updatedOption,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ✅ Delete a Packaging Option
exports.deletePackagingOption = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedOption = await PackagingOption.findByIdAndDelete(id);

    if (!deletedOption) {
      return res.status(404).json({ message: "Packaging option not found" });
    }

    return res.status(200).json({ message: "Packaging option deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};
