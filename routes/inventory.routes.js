const express = require('express');
const InventoryController = require('../controllers/inventory.controller');

const router = express.Router();

router.get('/bycategory/:category', InventoryController.getInventoryByCategory);
router.get('/summary/:category', InventoryController.getInventorySummary);
router.get('/getall', InventoryController.getAllInventory);

module.exports = router;