const express = require("express");
const router = express.Router();
const multer = require('multer');

// Use memory storage to store file in buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

const KantanController = require('../controllers/kantan.controller');

router.post("/create", KantanController.createKantan);

router.get("/getall", KantanController.getAllKantans);

router.patch("/update/:id", KantanController.updateKantan);

router.delete("/delete/:id", KantanController.deleteKantan);

// Bulk upload using memory buffer
router.post('/bulk', upload.single('file'), KantanController.bulkUploadKantans);

module.exports = router;