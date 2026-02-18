const express = require("express");
const router = express.Router();
const paymentFolderController = require("../controllers/paymentFolder.controller");
const ExcelDownloadController = require("../controllers/exccelDownload.controller");

router.post("/create", paymentFolderController.createPaymentFolder);
// router.get("/getall", paymentFolderController.getPaymentFolders);
router.post("/getall", paymentFolderController.getPaymentFolders);
router.get("/getbyid/:id", paymentFolderController.getPaymentFolderById);
router.post("/update/:id", paymentFolderController.updatePaymentFolder);
router.delete("/delete/:id", paymentFolderController.deletePaymentFolder);
router.post("/multi-delete", paymentFolderController.deleteMultiplePaymentFolder);
router.post("/payments/:id", paymentFolderController.addPaymentToFolder);
router.post("/assign-task/:id", paymentFolderController.assignTaskToFolder);
router.post("/filter-options/:field", paymentFolderController.getPaymentFolderFilterOptions);

router.post("/export-payment-folder-excel", ExcelDownloadController.exportPaymentFolderToExcel);
router.post("/export-difference-payment-folder-excel", ExcelDownloadController.exportPaymentFolderDifferenceToExcel);
module.exports = router;