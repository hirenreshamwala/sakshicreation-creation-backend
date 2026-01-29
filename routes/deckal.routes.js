const express = require('express');
const DeckalController = require('../controllers/deckal.controller');

const router = express.Router();

router.post("/create", DeckalController.createDeckal);

router.get("/getall", DeckalController.getDeckals);

router.patch("/update/:id", DeckalController.updateDeckal);

router.delete("/delete/:id", DeckalController.deleteDeckal);

module.exports = router;