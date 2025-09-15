const express = require("express");
const router = express.Router();
const multer = require('multer');

// Use memory storage to store file in buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

const PaperGSMController = require('../controllers/paperGSM.controller');

router.post("/create", PaperGSMController.createPaperGSM);

router.get("/getall", PaperGSMController.getAllPaperGSM);
router.get("/getbydeckal", PaperGSMController.getByDeckal);

router.patch("/update/:id", PaperGSMController.updatePaperGSM);

router.delete("/delete/:id", PaperGSMController.deletePaperGSM);

// Bulk upload using memory buffer
router.post('/bulk', upload.single('file'), PaperGSMController.bulkUploadPaperGSM);

module.exports = router;
