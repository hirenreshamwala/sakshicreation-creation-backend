const express = require("express");
const StaffController = require("../controllers/staff.controller");
const { authenticateToken } = require("../middleware/auth");
const multer = require('multer');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});
router.post("/create",authenticateToken, StaffController.createStaff);

router.get("/getall",authenticateToken, StaffController.getStaff);
router.get('/filters', StaffController.getStaffFilters);
router.get("/getbyid/:id",authenticateToken, StaffController.getStaffById);

router.patch("/update/:id",authenticateToken, StaffController.updateStaff);

router.patch("/updatestatus/:id",authenticateToken, StaffController.updateStaffStatus);

router.delete("/delete/:id",authenticateToken, StaffController.deleteStaff);

router.post("/login", StaffController.loginStaff);

router.post("/getrol",authenticateToken, StaffController.getrol);

router.post(
  "/bulk",
  upload.fields([{ name: "file", maxCount: 1 }]),authenticateToken,
  StaffController.bulkCreateStaff
);
router.patch("/updatepassword/:id",authenticateToken, authenticateToken,StaffController.updateStaffPassword);
router.get("/permissions/:id",authenticateToken, StaffController.getStaffPermission);
router.post('/updateattachments/:id',authenticateToken,StaffController.updateStaffAttachments)
module.exports = router;