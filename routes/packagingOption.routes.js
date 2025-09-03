const express = require("express");
const router = express.Router();
const PackagingOrderController = require('../controllers/packagingOption.controller');

router.post("/create", PackagingOrderController.createPackagingOption);

router.get("/getall", PackagingOrderController.getAllPackagingOptions);

router.patch("/update/:id", PackagingOrderController.updatePackagingOption);

router.delete("/delete/:id", PackagingOrderController.deletePackagingOption);

module.exports = router;