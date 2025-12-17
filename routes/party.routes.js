const express = require("express");
const router = express.Router();
const partyController = require("../controllers/party.controller");

router.get("/get-party-by-id/:id", partyController.getPartyById);

module.exports = router;
