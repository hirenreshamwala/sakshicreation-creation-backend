const express = require("express")
const router = express.Router()
const ReportController = require("../controllers/report.controller");

router.post("/get", ReportController.getStaffReport);
router.post("/getsc", ReportController.getSCReport);
router.post("/getqp", ReportController.getQPReport);

module.exports = router;