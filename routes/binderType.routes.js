const express = require("express");
const binderTypeController = require("../controllers/binderType.controller");
const multer = require("multer");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Create BinderType
router.post("/create", binderTypeController.createBinderType);

// Get all BinderTypes
router.get("/getall", binderTypeController.getAllBinderTypes);
router.get('/filters', binderTypeController.getBinderTypeFilters);
// Get BinderType by ID
router.get("/getbyid/:id", binderTypeController.getBinderTypeById);

// Update BinderType
router.put("/update/:id", binderTypeController.updateBinderType);

// Delete BinderType
router.delete("/delete/:id", binderTypeController.deleteBinderType);

// Bulk Upload BinderTypes
router.post("/bulk", upload.single("file"), binderTypeController.bulkCreateBinderTypes);

module.exports = router;
