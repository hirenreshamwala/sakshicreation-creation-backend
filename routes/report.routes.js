const express = require("express")
const router = express.Router()
const ReportController = require("../controllers/report.controller");

router.post("/get", ReportController.getStaffReport);
router.post("/getsc", ReportController.getSCReport);
router.post("/getqp", ReportController.getQPReport);
router.get("/getqpinactive-parties", ReportController.getqpInactiveParties);
router.get("/getscinactive-parties", ReportController.getscOrderInactiveParties);

module.exports = router;