const express = require("express")
const router = express.Router()
const ReportController = require("../controllers/report.controller");
const ExcelDownloadController = require("../controllers/exccelDownload.controller");

router.post("/get", ReportController.getStaffReport);
router.post("/getsc", ReportController.getSCReport);
router.post("/getqp", ReportController.getQPReport);
router.post("/getqpinactive-parties", ReportController.getqpInactiveParties);
router.post("/getscinactive-parties", ReportController.getscOrderInactiveParties);
router.post("/getscdesigners", ReportController.getscDesigner);
router.post("/getscprinters", ReportController.getscPrinter);
router.post("/getscbinder", ReportController.getscBinder);
router.post("/getscbookletbinder", ReportController.getscBookletBinder);
router.post("/getscproductitem", ReportController.getscProductItem);
router.post("/getscsalescredit", ReportController.getscsalescredit);
router.post("/getqpsalescredit", ReportController.getQpsalescredit);

// Order Reports APIs
router.post("/get-pending-orders", ReportController.getPendingOrdersReport);
router.post("/get-completed-orders", ReportController.getCompletedOrdersReport);

//exelAPI
router.post("/export-designer-excel", ExcelDownloadController.exportDesignerPerformanceToExcel);
router.post("/export-printer-excel", ExcelDownloadController.exportPrinterPerformanceToExcel);
router.post("/export-binder-excel", ExcelDownloadController.exportBinderPerformanceToExcel);
router.post("/export-bookletbinder-excel", ExcelDownloadController.exportBookletBinderPerformanceToExcel);

// Order Reports Excel Export
router.post("/export-pending-orders-excel", ExcelDownloadController.exportPendingOrdersToExcel);
router.post("/export-completed-orders-excel", ExcelDownloadController.exportCompletedOrdersToExcel);

module.exports = router;