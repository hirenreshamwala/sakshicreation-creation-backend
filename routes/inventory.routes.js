const express = require("express");
const InventoryController = require("../controllers/inventory.controller");

const router = express.Router();

router.post("/bycategory/:category", InventoryController.getInventoryByCategory);
router.get("/summary/:category", InventoryController.getInventorySummary);
router.get("/getall", InventoryController.getAllInventory);
router.post("/getallForQuality", InventoryController.getAllInventoryForQuality);
router.put("/update/:id", InventoryController.updateInventory);
router.post("/getbox",InventoryController.getAvailableBoxes);
router.post("/filter-options/:field", InventoryController.getInventoryFilterOptions);
module.exports = router;
