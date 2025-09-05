const Market = require("../models/marketData.model");
const Papa = require("papaparse");

// ✅ Create a new Market
exports.createMarket = async (req, res) => {
  try {
    const { marketName, area, streetAddress, landmark, pincode } = req.body;

    if (!marketName || !area || !pincode) {
      return res
        .status(400)
        .json({ message: "Market Name, Area, and Pincode are required" });
    }

    const newMarket = new Market({
      marketName,
      area,
      streetAddress,
      landmark,
      pincode,
    });

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
    const markets = await Market.find().select("marketName area streetAddress landmark pincode").sort({ createdAt: -1 });
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
    const { marketName, area, streetAddress, landmark, pincode } = req.body;

    const updatedMarket = await Market.findByIdAndUpdate(
      id,
      { marketName, area, streetAddress, landmark, pincode },
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

    console.log(deletedMarket,'deletedMarket')
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
    console.log(fileContent,'fileContent')
    
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
      const { marketName, area, streetAddress, landmark, pincode } = row;
      if (!marketName || !area || !pincode) {
        return res
          .status(400)
          .json({ message: "Market Name, Area, and Pincode are required in every row" });
      }
      validRecords.push({ marketName, area, streetAddress, landmark, pincode });
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
