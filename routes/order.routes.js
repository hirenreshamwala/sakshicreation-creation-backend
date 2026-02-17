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
  getAllOrdersPagination,
  getNotificationSummary,
  markNotificationRead,
} = require("../controllers/order.controller");
const { authenticateToken } = require("../middleware/auth");
const ExcelDownloadController = require("../controllers/exccelDownload.controller");

router.post("/create", authenticateToken, createOrder);

router.post("/all", getAllOrders);
router.post("/all-pagination", getAllOrdersPagination);
router.post("/download-excel", authenticateToken, ExcelDownloadController.exportOrdersToExcel);

router.post("/getbystaffid/:id", getOrdersByStaffId);

router.get("/printer", authenticateToken, getPrinterById);

router.get("/binder", authenticateToken, getBinderById);

router.get("/bookletBinder", authenticateToken, getBookletBinderById);

router.put("/:orderId/status", authenticateToken, updateStaffStatus);

router.get("/notifications/summary", authenticateToken, getNotificationSummary);

router.put("/:orderId/notifications/read", authenticateToken, markNotificationRead);

router.get("/designe", authenticateToken, getDesignerById);

router.get("/:id", getOrderById);

router.post('/filter-options/:field', getFilterOptionsData);

router.put("/update/:id", authenticateToken, updateOrder);

router.delete("/delete/:id", deleteOrder);

router.get("/company/:companyId/party/:partyId", getOrdersByCompanyAndParty);

router.post("/export-pending-client-approval-orders", ExcelDownloadController.exportPendingClientApprovalOrdersToExcel);

module.exports = router;
