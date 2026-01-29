const express = require('express');
const GsmController = require('../controllers/gsm.controller');

const router = express.Router();

router.post("/create", GsmController.createGsm);

router.get("/getall", GsmController.getGsm);

router.patch("/update/:id", GsmController.updateGsm);

router.delete("/delete/:id", GsmController.deleteGsm);

module.exports = router;