const express = require("express");
const router = express.Router();
const multer = require('multer');

// Use memory storage to store file in buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

const MarketDataController = require('../controllers/marketData.controller');

router.post("/create", MarketDataController.createMarket);

router.get("/getall", MarketDataController.getAllMarkets);
router.get("/filters", MarketDataController.getMarketFilters);
router.patch("/update/:id", MarketDataController.updateMarket);

router.delete("/delete/:id", MarketDataController.deleteMarket);

// Bulk upload using memory buffer
router.post('/bulk', upload.single('file'), MarketDataController.bulkUploadMarkets);

module.exports = router;
