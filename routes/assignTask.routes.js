const express = require("express");
const AssignTaskController = require("../controllers/assignTask.controller");
const ExcelDownloadController = require("../controllers/exccelDownload.controller");

const router = express.Router();

// Create a new assign task
router.post("/create", AssignTaskController.createAssignTask);
router.post("/create/bulk", AssignTaskController.bulkCreateTasks);

// Get all assign tasks
router.post("/getall", AssignTaskController.getAllAssignTasks);

// Get a single assign task by ID
router.get("/getbyid/:id", AssignTaskController.getAssignTaskById);
router.get("/getbystaffid/:id", AssignTaskController.getTasksByStaffId);

// Update an assign task by ID
router.patch("/update/:id", AssignTaskController.updateAssignTask);

// Update assign task status
router.patch("/updatestatus/:id", AssignTaskController.updateAssignTaskStatus);

// Delete an assign task by ID
router.delete("/delete/:id", AssignTaskController.deleteAssignTask);
router.post("/bulkdelete", AssignTaskController.bulkDeleteAssignTasks);

// Get party names by company name for dropdown
router.get("/party-names", AssignTaskController.getPartyNamesByCompany);

router.post("/get-filter/:field",AssignTaskController.getAssignTaskFilterOptionsData)
router.post("/get-task-by-party-and-accountmaster", AssignTaskController.getTaskForParty);
router.post("/get-party-task", AssignTaskController.getPartyTask);

router.post("/download-excel", ExcelDownloadController.exportAssignTasksToExcel);

module.exports = router;