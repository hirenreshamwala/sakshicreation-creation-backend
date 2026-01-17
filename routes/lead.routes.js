const express = require("express");
const LeadController = require("../controllers/lead.controller");
const ExcelDownloadController = require("../controllers/exccelDownload.controller");

const router = express.Router();

// Create a new lead
router.post("/create", LeadController.createLead);

// Get all leads
router.post("/getall", LeadController.getAllLeads);

// Get lead by ID
router.get("/getbyid/:id", LeadController.getLeadById);
router.get("/getbystaffid/:id", LeadController.getLeadsByStaffId);
router.post("/create/bulk", LeadController.bulkCreateLeads);
// Update lead
router.patch("/update/:id", LeadController.updateLeadById);
router.post("/get-data-by-party-and-accountmaster", LeadController.getDataByPartyAndAccountMaster);

// Update lead status
router.patch("/updatestatus/:id", LeadController.updateLeadStatus);
router.post("/get-filter/:field",LeadController.getPartyFilterOptionsData)
// Delete lead
router.delete("/delete/:id", LeadController.deleteLead);

// Get party names by company
router.get("/party-names", LeadController.getPartyNamesByCompany);

router.post("/add-callhistory/:id", LeadController.addLeadCallHistory);

router.post("/download-excel", ExcelDownloadController.exportLeadsToExcel);

router.post("/delete/bulk", LeadController.bulkDeleteLeads);

module.exports = router;
