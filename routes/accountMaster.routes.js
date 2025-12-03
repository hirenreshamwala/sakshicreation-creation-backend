const express = require("express");
const AccountMasterController = require("../controllers/accountMaster.controller");
const multer = require("multer");
const { authenticateToken } = require("../middleware/auth");
const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// Create a new account master
router.post("/create",authenticateToken, AccountMasterController.createAccountMaster);

// Get all account masters
router.post("/getall",authenticateToken, AccountMasterController.getAllAccountMasters);
router.get("/getqp",authenticateToken, AccountMasterController.getQualityPackingParties);

router.put("/party/:id/approve",authenticateToken, AccountMasterController.approveParty);

// Get a single account master by ID
router.get("/getbyid/:id",authenticateToken, AccountMasterController.getAccountMasterById);
router.post("/getbystaffid/:id",authenticateToken, AccountMasterController.getAccountMasterByStaffId);

// Update an account master by ID
router.patch("/update/:id",authenticateToken, AccountMasterController.updateAccountMaster);

// Update account master status
router.patch("/updatestatus/:id",authenticateToken, AccountMasterController.updateAccountMasterStatus);

// Delete an account master by ID
router.delete("/delete/:id",authenticateToken, AccountMasterController.deleteAccountMaster);

// Get all staff for createdBy dropdown
router.get("/staff",authenticateToken, AccountMasterController.getAllStaff);

router.post("/bulk-create", upload.single("file"),authenticateToken, AccountMasterController.bulkCreateAccountMasters);

router.post("/by-company-party",authenticateToken, AccountMasterController.getAccountMasterByCompanyAndParty);

router.get("/parties/search",authenticateToken, AccountMasterController.searchParties);

router.post("/filter-options/:field",authenticateToken, AccountMasterController.getFilterOptionsData);

module.exports = router;