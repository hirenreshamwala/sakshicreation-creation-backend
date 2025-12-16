const express = require("express")
const router = express.Router()
const ReportController = require("../controllers/report.controller");

router.post("/get", ReportController.getStaffReport);
router.post("/getsc", ReportController.getSCReport);
router.post("/getqp", ReportController.getQPReport);
router.post("/getqpinactive-parties", ReportController.getqpInactiveParties);
router.post("/getscinactive-parties", ReportController.getscOrderInactiveParties);
router.post("/getscdesigners", ReportController.getscDesigner);
router.post("/getscprinters", ReportController.getscPrinter);
router.post("/getscbinder", ReportController.getscBinder);
router.post("/getscbookletbinder", ReportController.getscBookletBinder);
module.exports = router;