const express = require('express');
const router = express.Router();
const complainController = require('../controllers/complain.controller');

router.post('/getall', complainController.getAllComplains);
router.get('/getbyid/:id', complainController.getComplain);
router.post('/getbystaff/:staffId', complainController.getComplainsByStaff);
router.post('/create', complainController.createComplain);
router.put('/update/:id', complainController.updateComplain);
router.delete('/delete/:id', complainController.deleteComplain);
router.post('/filter-options/:field', complainController.getComplainFilterOptions);
module.exports = router;
