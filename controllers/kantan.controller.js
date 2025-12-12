const Kantan = require("../models/kantan.model");
const Papa = require("papaparse");

// ✅ Create a new Kantan
exports.createKantan = async (req, res) => {
  try {
    const { kantanName } = req.body; // 👈 deckal add karein

    if (!kantanName) {
      return res.status(400).json({ message: "Kantan Name are required" });
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

// GET /api/kantans ?page=1&limit=10&search=abc&kantanNames=Name1&kantanNames=Name2
exports.getAllKantans = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    let { kantanNames = [] } = req.query;
    const skip = (page - 1) * limit;

    // convert single value to array
    if (typeof kantanNames === "string") {
      // supports ?kantanNames=A,B or ?kantanNames=A&kantanNames=B
      kantanNames = kantanNames.split(",");
    }

    let filter = {};

    // SEARCH FILTER (regex)
    if (search) {
      filter.kantanName = { $regex: search, $options: "i" };
    }

    // DROPDOWN FILTER (list match)
    if (kantanNames.length) {
      filter.kantanName = { 
        ...(filter.kantanName || {}), 
        $in: kantanNames 
      };
    }

    const total = await Kantan.countDocuments(filter);

    const kantans = await Kantan.find(filter)
      .skip(Number(skip))
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .select("kantanName");

    res.json({
      data: kantans,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
};



// GET /api/kantans/filters
exports.getKantanFilters = async (req, res) => {
  try {
    const kantanNames = await Kantan.distinct("kantanName");
    res.json({ kantanNames: kantanNames.sort() });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
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
      const { kantanName } = row; // 👈 deckal add karein
      if (!kantanName) {
        return res
          .status(400)
          .json({ message: "Kantan Name are required in every row" });
      }
      validRecords.push({ kantanName }); // 👈 deckal save karein
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