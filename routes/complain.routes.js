const express = require('express');
const router = express.Router();
const complainController = require('../controllers/complain.controller');

router.get('/getall', complainController.getAllComplains);
router.get('/getbyid/:id', complainController.getComplain);
router.get('/getbystaff/:staffId', complainController.getComplainsByStaff);
router.post('/create', complainController.createComplain);
router.put('/update/:id', complainController.updateComplain);
router.delete('/delete/:id', complainController.deleteComplain);

module.exports = router;
