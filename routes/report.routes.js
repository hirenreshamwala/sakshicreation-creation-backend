const express = require("express")
const router = express.Router()
const ReportController = require("../controllers/report.controller");

router.post("/get", ReportController.getStaffReport);

module.exports = router;