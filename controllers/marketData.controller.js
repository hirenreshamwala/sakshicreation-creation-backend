const Market = require("../models/marketData.model");
const Papa = require("papaparse");

// ✅ Create a new Market
exports.createMarket = async (req, res) => {
  try {
    const { marketName, area,
      //  streetAddress,
       landmark, pincode } = req.body;

    if (!marketName || !area || !pincode) {
      return res
        .status(400)
        .json({ message: "Market Name, Area, and Pincode are required" });
    }

    // ✅ Normalize input (trim + lowercase for consistency)
    const normalizedData = {
      marketName: marketName.trim(),
      area: area.trim(),
      // streetAddress: streetAddress?.trim() || "",
      landmark: landmark?.trim() || "",
      pincode: pincode.trim(),
    };

    // ✅ Check for exact duplicate
    const existingMarket = await Market.findOne({
      marketName: normalizedData.marketName,
      area: normalizedData.area,
      // streetAddress: normalizedData.streetAddress,
      landmark: normalizedData.landmark,
      pincode: normalizedData.pincode,
    });

    if (existingMarket) {
      return res.status(400).json({
        message: "Market with the same details already exists",
      });
    }

    const newMarket = new Market(normalizedData);
    await newMarket.save();

    return res.status(201).json({
      message: "Market created successfully",
      data: newMarket,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};


// ✅ Get all Markets
exports.getAllMarkets = async (req, res) => {
  try {
    const markets = await Market.find().select("marketName area landmark pincode").sort({ createdAt: -1 });
    return res.status(200).json({ data: markets });
  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ✅ Update a Market
exports.updateMarket = async (req, res) => {
  try {
    const { id } = req.params;
    const { marketName, area, 
      // streetAddress,
       landmark, pincode } = req.body;

    const updatedMarket = await Market.findByIdAndUpdate(
      id,
      { marketName, area,
        //  streetAddress,
          landmark, pincode },
      { new: true, runValidators: true }
    );

    if (!updatedMarket) {
      return res.status(404).json({ message: "Market not found" });
    }

    return res.status(200).json({
      message: "Market updated successfully",
      data: updatedMarket,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ✅ Delete a Market
exports.deleteMarket = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedMarket = await Market.findByIdAndDelete(id);

    if (!deletedMarket) {
      return res.status(404).json({ message: "Market not found" });
    }

    return res.status(200).json({ message: "Market deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// ✅ Bulk Upload Markets
exports.bulkUploadMarkets = async (req, res) => {
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
      const { marketName, area,
        //  streetAddress,
          landmark, pincode } = row;

      if (!marketName || !area || !pincode) {
        return res.status(400).json({
          message: "Market Name, Area, and Pincode are required in every row",
        });
      }

      // ✅ Normalize values (trim + lowercase for consistent comparison)
      const normalizedData = {
        marketName: marketName.trim(),
        area: area.trim(),
        // streetAddress: streetAddress?.trim() || "",
        landmark: landmark?.trim() || "",
        pincode: pincode.trim(),
      };

      // ✅ Check if same record already exists
      const existing = await Market.findOne({
        marketName: normalizedData.marketName,
        area: normalizedData.area,
        // streetAddress: normalizedData.streetAddress,
        landmark: normalizedData.landmark,
        pincode: normalizedData.pincode,
      });

      if (!existing) {
        validRecords.push(normalizedData); // Only push if not duplicate
      }
    }

    if (validRecords.length === 0) {
      return res.status(200).json({
        message: "No new unique records to insert",
        insertedCount: 0,
        data: [],
      });
    }

    const insertedMarkets = await Market.insertMany(validRecords);

    return res.status(201).json({
      message: "Bulk upload successful",
      insertedCount: insertedMarkets.length,
      data: insertedMarkets,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};
