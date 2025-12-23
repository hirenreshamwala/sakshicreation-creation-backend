const express = require("express");
const router = express.Router();
const QpOrderController = require("../controllers/qpOrder.controller");
const ExcelDownloadController = require("../controllers/exccelDownload.controller");
const { authenticateToken } = require("../middleware/auth");

router.post("/create", authenticateToken, QpOrderController.createQpOrder);
router.post("/getall", QpOrderController.getAllQpOrders);
router.get("/getbyid/:id", QpOrderController.getQpOrderById);
router.put("/update/:id", QpOrderController.updateQpOrder);
router.delete("/delete/:id", QpOrderController.deleteQpOrder);
router.get("/getbystaff/:id", QpOrderController.getOrdersByStaffId);
router.post("/remove-loading", QpOrderController.removeLoadingOrder);
router.post("/updatestatus", QpOrderController.updateQPOrderStatus);
router.post("/bulkupdatestatus", QpOrderController.bulkUpdateQPOrderStatus);
router.post('/sendboxfromgodownorfactory/:id',QpOrderController.sendBoxFromGodownOrFactory)
router.post('/driverselection/:id',QpOrderController.driverSelectionAndInventoryManage)
router.post('/mark-urgent/:id',QpOrderController.updateMarkUrgent)
router.post('/filter-options/:field',QpOrderController.getQpFilterOptionsData);
router.post('/getalldriver',QpOrderController.getAllQpOrdersForDriver);
router.post('/driver-download-excel',ExcelDownloadController.exportDriverReportToExcel);

module.exports = router;
