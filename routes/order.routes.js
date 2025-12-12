const express = require("express");
const router = express.Router();
const {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getOrdersByCompanyAndParty,
  getDesignerById,
  getPrinterById,
  getBinderById,
  getBookletBinderById,
  getOrdersByStaffId,
  getFilterOptionsData,
  updateStaffStatus,
  getAllOrdersPagination
} = require("../controllers/order.controller");
const { authenticateToken } = require("../middleware/auth");

router.post("/create", authenticateToken, createOrder);

router.post("/all", getAllOrders);
router.post("/all-pagination", getAllOrdersPagination);

router.post("/getbystaffid/:id", getOrdersByStaffId);

router.get("/printer", authenticateToken, getPrinterById);

router.get("/binder", authenticateToken, getBinderById);

router.get("/bookletBinder", authenticateToken, getBookletBinderById);

router.put("/:orderId/status",authenticateToken, updateStaffStatus);

router.get("/designe", authenticateToken, getDesignerById);

router.get("/:id", getOrderById);

router.post('/filter-options/:field',getFilterOptionsData);

router.put("/update/:id",authenticateToken, updateOrder);

router.delete("/delete/:id", deleteOrder);

router.get("/company/:companyId/party/:partyId", getOrdersByCompanyAndParty);

module.exports = router;
