const express = require('express');
const LowStockController = require('../controllers/lowStock.controller');

const router = express.Router();

router.post('/create', LowStockController.createLowStock);
router.get('/getall', LowStockController.getAllLowStocks);
router.get('/getbyid/:id', LowStockController.getLowStockById);
router.patch('/update/:id', LowStockController.updateLowStock);
router.delete('/delete/:id', LowStockController.deleteLowStock);
router.get('/check-status', LowStockController.checkLowStockStatus);

module.exports = router;
