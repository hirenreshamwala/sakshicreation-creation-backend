const express = require("express");
const router = express.Router();
const factoryController = require("../controllers/factoryReturn.controller");


router.post("/create", factoryController.backToFactory);

module.exports = router;
