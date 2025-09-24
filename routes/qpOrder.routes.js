const express = require("express")
const router = express.Router()
const QpOrderController = require("../controllers/qpOrder.controller");
const { authenticateToken } = require("../middleware/auth");

router.post("/create",authenticateToken,QpOrderController.createQpOrder);
router.post("/getall", QpOrderController.getAllQpOrders);
router.get("/getbyid/:id", QpOrderController.getQpOrderById);
router.put("/update/:id", QpOrderController.updateQpOrder);
router.delete("/delete/:id", QpOrderController.deleteQpOrder);
router.get("/getbystaff/:id", QpOrderController.getOrdersByStaffId);
module.exports = router;