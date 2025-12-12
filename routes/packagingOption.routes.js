const express = require("express");
const router = express.Router();
const multer = require('multer');

// Use memory storage to store file in buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

const PackagingOrderController = require('../controllers/packagingOption.controller');

router.post("/create", PackagingOrderController.createPackagingOption);

router.get("/getall", PackagingOrderController.getAllPackagingOptions);
router.get("/filters", PackagingOrderController.getPackagingFilters);

router.patch("/update/:id", PackagingOrderController.updatePackagingOption);

router.delete("/delete/:id", PackagingOrderController.deletePackagingOption);

// Bulk upload using memory buffer
router.post('/bulk', upload.single('file'), PackagingOrderController.bulkUploadPackagingOptions);

module.exports = router;
