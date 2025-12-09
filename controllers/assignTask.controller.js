// const AssignTask = require("../models/assignTask.model");
const mongoose = require("mongoose");
const AccountMaster = require("../models/accountMaster.model");
const Staff = require("../models/staff.model");
const CompanyName = require("../models/companyName.model");
const Party = require("../models/Party.model");
const AssignTask = require("../models/assignTask.model");

exports.createAssignTask = async (req, res) => {
  try {
    const { companyName, partyName, date, time, reasonForVisit, assignTo } =
      req.body;

    if (!companyName || !partyName || !date || !reasonForVisit || !assignTo) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(companyName) ||
      !mongoose.Types.ObjectId.isValid(partyName) ||
      !mongoose.Types.ObjectId.isValid(assignTo)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const newAssignTask = new AssignTask({
      companyName,
      partyName,
      date: new Date(date),
      time: time,
      reasonForVisit,
      remarks: req.body.remarks || "",
      assignTo,
      status: req.body.status || "Pending",
      visitDate: req.body.visitDate ? new Date(req.body.visitDate) : null,
      visitTime: req.body.visitTime || "",
      feedback: req.body.feedback || "",
      isRescheduledTask: req.body.isRescheduledTask || false,
      originalTaskId: req.body.originalTaskId || null,
    });

    await newAssignTask.save();

    // Fetch AccountMaster using raw ObjectIds before population
    const accountMaster = await AccountMaster.findOne({
      companyName: newAssignTask.companyName, // Use raw ObjectId
      party: newAssignTask.partyName, // Use 'party' field, assuming schema uses 'party'
    })
      .populate("createdBy", "firstName lastName")
      .lean();

    // Populate the task for the response
    const populatedTask = await AssignTask.findById(newAssignTask._id)
      .populate("companyName", "companyName avatar")
      .populate("partyName", "partyName address ownerName personMobileNo")
      .populate({
        path: "assignTo",
        populate: {
          path: "role",
          select: "roleName" // yaha jitne fields chahiye wo add kar sakte ho
        }
      })

    const taskWithCreatedBy = {
      ...populatedTask.toObject(),
      createdBy: accountMaster ? accountMaster.createdBy : null,
    };

    res.status(201).json({
      success: true,
      message: "Task assigned successfully",
      data: taskWithCreatedBy,
    });
  } catch (error) {
    console.error("Error creating assign task:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create task",
      error: error.message,
    });
  }
};

exports.bulkCreateTasks = async (req, res) => {
  try {
    const tasksData = req.body;
    console.log("Received tasksData:", tasksData);

    if (!Array.isArray(tasksData) || tasksData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Expected an array of task data",
      });
    }

    const createdTasks = [];
    const errors = [];

    for (const taskData of tasksData) {
      try {
        const {
          companyName,
          partyName,
          date,
          time,
          reasonForVisit,
          remarks,
          assignTo,
          status = "Pending",
        } = taskData;

        console.log(`Processing task for partyName: ${partyName}`);

        // Validate required fields
        if (!companyName || !partyName || !date || !reasonForVisit || !assignTo) {
          errors.push({
            partyName,
            message: "Missing required fields",
            missingFields: { companyName, partyName, date, reasonForVisit, assignTo },
          });
          console.log(`Validation failed for partyName: ${partyName}`, {
            companyName,
            partyName,
            date,
            reasonForVisit,
            assignTo,
          });
          continue;
        }

        // Validate ObjectId fields
        if (
          !mongoose.Types.ObjectId.isValid(companyName) ||
          !mongoose.Types.ObjectId.isValid(partyName) ||
          !mongoose.Types.ObjectId.isValid(assignTo)
        ) {
          errors.push({
            partyName,
            message: "Invalid ID format",
            invalidFields: { companyName, partyName, assignTo },
          });
          console.log(`Invalid ID format for partyName: ${partyName}`, {
            companyName,
            partyName,
            assignTo,
          });
          continue;
        }

        // Validate existence of referenced documents
        const [company, party, staff] = await Promise.all([
          CompanyName.findById(companyName),
          Party.findById(partyName),
          Staff.findById(assignTo),
        ]);

        if (!company) {
          errors.push({
            partyName,
            message: `Company not found for ID: ${companyName}`,
          });
          console.log(`Company not found for ID: ${companyName}`);
          continue;
        }

        if (!party) {
          errors.push({
            partyName,
            message: `Party not found for ID: ${partyName}`,
          });
          console.log(`Party not found for ID: ${partyName}`);
          continue;
        }

        if (!staff) {
          errors.push({
            partyName,
            message: `Staff not found for ID: ${assignTo}`,
          });
          console.log(`Staff not found for ID: ${assignTo}`);
          continue;
        }

        // Validate date format
        let normalizedDate = null;
        if (date) {
          const dateRegex = /^(\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})$/;
          if (!dateRegex.test(date)) {
            errors.push({
              partyName,
              message: "Invalid date format. Use DD-MM-YYYY or YYYY-MM-DD.",
            });
            console.log(`Invalid date format for partyName: ${partyName}`, { date });
            continue;
          }

          let [year, month, day] = date.split("-");
          if (date.match(/^\d{2}-\d{2}-\d{4}$/)) {
            [day, month, year] = date.split("-");
          }
          normalizedDate = new Date(`${year}-${month}-${day}`);

          if (isNaN(normalizedDate.getTime())) {
            errors.push({ partyName, message: "Invalid date provided" });
            console.log(`Invalid date provided for partyName: ${partyName}`, { date });
            continue;
          }
        }

        // Validate time format if provided
        if (time) {
          const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
          if (!timeRegex.test(time)) {
            errors.push({
              partyName,
              message: "Invalid time format. Use HH:MM in 24-hour format.",
            });
            console.log(`Invalid time format for partyName: ${partyName}`, { time });
            continue;
          }
        }

        // Create task
        const task = new AssignTask({
          companyName,
          partyName,
          date: normalizedDate,
          time: time || "",
          reasonForVisit,
          remarks: remarks || "",
          assignTo,
          status,
          visitDate: null,
          visitTime: "",
          feedback: "",
          isRescheduledTask: false,
          originalTaskId: null,
        });

        const savedTask = await task.save();
        createdTasks.push(savedTask);
        console.log(`Successfully created task for partyName: ${partyName}`);
      } catch (error) {
        console.error(`Error processing task:`, error);
        errors.push({
          partyName: taskData.partyName,
          message: error.message || "Error processing task",
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: "Bulk task creation completed",
      data: createdTasks,
      errors: errors.length > 0 ? errors : undefined,
      count: createdTasks.length,
    });
  } catch (error) {
    console.error("Error in bulk task creation:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating tasks",
      error: error.message,
    });
  }
};

exports.getAllAssignTasks = async (req, res) => {
  try {
    const { staffId, startDate, endDate, status, companyName, partyName, reason } = req.body;

    let filter = {};

    // Staff filter
    if (staffId) {
      filter.assignTo = staffId;
    }

    // Company filter
    if (companyName) {
      filter.companyName = companyName;
    }

    // Party filter
    if (partyName) {
      filter.partyName = partyName;
    }

    // Reason filter
    if (reason) {
      const cleanedReason = reason.trim().replace(/\s+/g, "\\s*");
      filter.reasonForVisit = new RegExp(cleanedReason, "i");
    }

    // Status filter (multiple status allowed, case-insensitive)
    if (status && Array.isArray(status) && status.length > 0) {
      filter.status = {
        $in: status.map((s) => new RegExp(`^${s}$`, "i"))
      };
    }

    // Date filter
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      filter.date = { $gte: start, $lte: end };
    }

    // Fetch all tasks with necessary populations
    const tasks = await AssignTask.find(filter)
      .populate("companyName", "companyName avatar _id")
      .populate({
        path: "assignTo",
        select: "firstName lastName email role",
        populate: {
          path: "role",
          select: "roleName"
        }
      })
      .populate("originalTaskId", "_id reasonToVisit")
      .populate({
        path: "partyName",
        select: "-__v",
        populate: [
          { path: "address.marketName", model: "Market", select: "marketName" },
          { path: "address.landMark", model: "Market", select: "landmark" },
          { path: "address.area", model: "Market", select: "area" },
          { path: "address.pincode", model: "Market", select: "pincode" },
        ],
      })
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for better performance

    // If no tasks found, return early
    if (tasks.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // Collect all unique company-party combinations for batch query
    const companyPartyCombinations = [];
    const combinationsMap = new Map(); // For quick lookup

    tasks.forEach(task => {
      if (task.companyName && task.partyName) {
        const key = `${task.companyName._id}_${task.partyName._id}`;
        if (!combinationsMap.has(key)) {
          combinationsMap.set(key, true);
          companyPartyCombinations.push({
            companyName: task.companyName._id,
            party: task.partyName._id
          });
        }
      }
    });

    // Single batch query to fetch all AccountMasters
    let accountMastersMap = new Map();
    
    if (companyPartyCombinations.length > 0) {
      const accountMasters = await AccountMaster.find({
        $or: companyPartyCombinations
      })
      .populate("createdBy", "firstName lastName email")
      .lean();

      // Create map for quick lookup
      accountMasters.forEach(account => {
        const key = `${account.companyName}_${account.party}`;
        accountMastersMap.set(key, account);
      });
    }

    // Process tasks sequentially without Promise.all
    const tasksWithCreatedBy = [];
    
    for (const task of tasks) {
      let createdBy = null;
      
      // Lookup createdBy from the map
      if (task.companyName && task.partyName) {
        const key = `${task.companyName._id}_${task.partyName._id}`;
        const accountMaster = accountMastersMap.get(key);
        if (accountMaster && accountMaster.createdBy) {
          createdBy = accountMaster.createdBy;
        }
      }

      // Transform task object
      const transformedTask = {
        ...task,
        companyName: task.companyName ? {
          _id: task.companyName._id,
          companyName: task.companyName.companyName,
          avatar: task.companyName.avatar
        } : null,
        assignTo: task.assignTo ? {
          _id: task.assignTo._id,
          firstName: task.assignTo.firstName,
          lastName: task.assignTo.lastName,
          email: task.assignTo.email,
          role: task.assignTo.role
        } : null,
        partyName: task.partyName ? {
          _id: task.partyName._id,
          partyName: task.partyName.partyName,
          ownerName: task.partyName.ownerName,
          ownerMobileNo: task.partyName.ownerMobileNo,
          ownerWhatsAppNo: task.partyName.ownerWhatsAppNo,
          ownerEmail: task.partyName.ownerEmail || "N/A",
          contactPerson: task.partyName.contactPerson,
          personMobileNo: task.partyName.personMobileNo,
          personWhatsAppNo: task.partyName.personWhatsAppNo,
          contactPersonEmail: task.partyName.contactPersonEmail || "N/A",
          contactForPayment: task.partyName.contactForPayment,
          contactMobileNo: task.partyName.contactMobileNo,
          contactWhatsAppNo: task.partyName.contactWhatsAppNo,
          contactForPaymentEmail: task.partyName.contactForPaymentEmail || "N/A",
          GSTNo: task.partyName.GSTNo,
          address: task.partyName.address,
          partyTag: task.partyName.partyTag,
          statusApproval: task.partyName.statusApproval,
          createdAt: task.partyName.createdAt,
          updatedAt: task.partyName.updatedAt
        } : null,
        originalTaskId: task.originalTaskId || null,
        createdBy: createdBy
      };

      tasksWithCreatedBy.push(transformedTask);
    }

    res.status(200).json({
      success: true,
      count: tasksWithCreatedBy.length,
      data: tasksWithCreatedBy,
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks",
      error: error.message,
    });
  }
};

// exports.updateAssignTask = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updateData = req.body;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid task ID"
//       });
//     }

//     const existingTask = await AssignTask.findById(id);
//     if (!existingTask) {
//       return res.status(404).json({
//         success: false,
//         message: "Task not found"
//       });
//     }

//     if (updateData.status === "Rescheduled") {
//       if (!updateData.rescheduleDate || isNaN(new Date(updateData.rescheduleDate).getTime())) {
//         return res.status(400).json({
//           success: false,
//           message: "Valid reschedule date required"
//         });
//       }

//       const rescheduleDate = new Date(updateData.rescheduleDate);
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);

//       if (rescheduleDate < today) {
//         return res.status(400).json({
//           success: false,
//           message: "Reschedule date must be in future"
//         });
//       }

//       // Create new task with rescheduled date
//       const newTask = new AssignTask({
//         companyName: existingTask.companyName,
//         partyName: existingTask.partyName,
//         date: rescheduleDate,
//         time: existingTask.time,
//         reasonForVisit: existingTask.reasonForVisit,
//         remarks: existingTask.remarks,
//         assignTo: existingTask.assignTo,
//         status: "Pending",
//         isRescheduledTask: true,
//         originalTaskId: existingTask._id
//       });

//       await newTask.save();
//     }

//     const updatedTask = await AssignTask.findByIdAndUpdate(id, updateData, {
//       new: true,
//       runValidators: true
//     })
//     .populate("companyName")
//     .populate("partyName")
//     .populate("assignTo")
//     .populate("originalTaskId");

//     res.status(200).json({
//       success: true,
//       message: "Task updated successfully",
//       data: updatedTask
//     });

//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Failed to update task",
//       error: error.message
//     });
//   }
// };

exports.getAssignTaskById = async (req, res) => {
  try {
    const assignTask = await AssignTask.findById(req.params.id)
      .populate({
        path: "assignTo",
        populate: {
          path: "role",
          select: "roleName" // yaha jitne fields chahiye wo add kar sakte ho
        }
      })
      .populate({
        path: "originalTaskId",
        select: "date status createdAt", // Add createdAt here
      });
    if (!assignTask) {
      return res.status(404).json({
        success: false,
        message: "Assign task not found",
      });
    }

    const accountMaster = await AccountMaster.findOne({
      companyName: assignTask.companyName,
      party: assignTask.partyName, // Use 'party' to match schema
    })
      .populate("createdBy")
      .populate("party")
      .populate({
        path: "party",
        select: "-__v",
        populate: [
          {
            path: "address.marketName",
            model: "Market",
            select: "marketName", // only marketName
          },
          // {
          //   path: "address.streetAddress",
          //   model: "Market",
          //   select: "streetAddress", // only streetAddress
          // },
          {
            path: "address.landMark",
            model: "Market",
            select: "landmark", // only landMark
          },
          {
            path: "address.area",
            model: "Market",
            select: "area", // only area
          },
          {
            path: "address.pincode",
            model: "Market",
            select: "pincode", // only pincode
          },
        ],
      })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        ...assignTask.toObject(),
        accountDetails: accountMaster,
        rescheduleDate: assignTask.rescheduleDate,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateAssignTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 1. Validate task ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID format",
      });
    }

    // 2. Check if task exists
    const existingTask = await AssignTask.findById(id);
    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // 3. Validate reference fields if they're being updated
    const validateReference = async (field, model, required = false) => {
      if (updateData[field]) {
        if (!mongoose.Types.ObjectId.isValid(updateData[field])) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${field} ID format`,
          });
        }
        const doc = await model.findById(updateData[field]);
        if (!doc) {
          return res.status(404).json({
            success: false,
            message: `${field} not found`,
          });
        }
        return true;
      }
      return !required;
    };

    if (updateData.companyName) {
      const isValid = await validateReference("companyName", CompanyName, true);
      if (!isValid) return;
    }

    if (updateData.partyName) {
      const isValid = await validateReference("partyName", Party, true);
      if (!isValid) return;
    }

    if (updateData.assignTo) {
      const isValid = await validateReference("assignTo", Staff, true);
      if (!isValid) return;
    }

    // 4. Date validation and formatting
    if (updateData.date) {
      const date = new Date(updateData.date);
      if (isNaN(date.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }
      updateData.date = date;
    }

    if (updateData.visitDate) {
      const visitDate = new Date(updateData.visitDate);
      if (isNaN(visitDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid visit date format",
        });
      }
      updateData.visitDate = visitDate;
    }

    // 5. Time format validation
    if (
      updateData.time &&
      !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updateData.time)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid time format. Use HH:MM (24-hour format)",
      });
    }

    if (
      updateData.visitTime &&
      !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updateData.visitTime)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid visit time format. Use HH:MM (24-hour format)",
      });
    }

    // 6. Status and rescheduleDate validation
    let originalCreatedAt = existingTask.createdAt; // Default to current task's createdAt
    let populatedNewTask = null; // Initialize populatedNewTask as null
    if (updateData.status) {
      if (
        !["Pending", "Rescheduled", "Completed", "Cancelled"].includes(
          updateData.status
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value",
        });
      }

      if (updateData.status === "Rescheduled") {
        if (
          !updateData.rescheduleDate ||
          isNaN(new Date(updateData.rescheduleDate).getTime())
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Reschedule date is required and must be a valid date when status is Rescheduled",
          });
        }

        const rescheduleDate = new Date(updateData.rescheduleDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (rescheduleDate < today) {
          return res.status(400).json({
            success: false,
            message: "Reschedule date must be a future date",
          });
        }
        updateData.rescheduleDate = rescheduleDate;

        // Find the original task's createdAt by tracing back through originalTaskId
        let rootTask = existingTask;
        while (rootTask.isRescheduledTask && rootTask.originalTaskId) {
          rootTask = await AssignTask.findById(rootTask.originalTaskId);
          if (!rootTask) {
            return res.status(404).json({
              success: false,
              message: "Original task not found",
            });
          }
        }
        originalCreatedAt = rootTask.createdAt; // Get the root task's createdAt

        // Create a new task with the rescheduled date
        const newTaskData = {
          companyName: existingTask.companyName,
          partyName: existingTask.partyName,
          date: rescheduleDate,
          time: existingTask.time,
          reasonForVisit: existingTask.reasonForVisit,
          remarks: existingTask.remarks,
          assignTo: existingTask.assignTo,
          status: "Pending",
          isRescheduledTask: true,
          originalTaskId: existingTask._id,
          rescheduleDate: null,
          createdAt: originalCreatedAt, // Explicitly set the original createdAt
        };

        const newTask = new AssignTask(newTaskData);
        await newTask.save();

        // Populate the new task for the response
        populatedNewTask = await AssignTask.findById(newTask._id)
          .populate("companyName", "companyName avatar")
          .populate("partyName", "partyName address ownerName personMobileNo")
          .populate({
            path: "assignTo",
            populate: {
              path: "role",
              select: "roleName" // yaha jitne fields chahiye wo add kar sakte ho
            }
          })
      } else {
        updateData.rescheduleDate = null;
      }
    }

    // Update the original task
    const updatedAssignTask = await AssignTask.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("companyName", "companyName avatar")
      .populate("partyName", "partyName address ownerName personMobileNo")
      .populate({
        path: "assignTo",
        populate: {
          path: "role",
          select: "roleName" // yaha jitne fields chahiye wo add kar sakte ho
        }
      })

    if (!updatedAssignTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found after update",
      });
    }

    // Fetch AccountMaster for createdBy
    const accountMaster = await AccountMaster.findOne({
      companyName: updatedAssignTask.companyName,
      party: updatedAssignTask.partyName,
    })
      .populate("createdBy", "firstName lastName")
      .lean();

    // Format the response
    const responseData = {
      originalTask: {
        ...updatedAssignTask.toObject(),
        createdBy: accountMaster ? accountMaster.createdBy : null,
      },
    };

    // Only include newTask in the response if it was created (i.e., status is Rescheduled)
    if (updateData.status === "Rescheduled" && populatedNewTask) {
      responseData.newTask = {
        message: "New task created with rescheduled date",
        rescheduledDate: updateData.rescheduleDate,
        data: populatedNewTask.toObject(), // Convert to plain object for the response
      };
    }

    res.status(200).json({
      success: true,
      message:
        updateData.status === "Rescheduled"
          ? "Task rescheduled successfully and new task created"
          : "Task updated successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error updating assign task:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update task. Please try again.",
      error: error.message || "An unexpected error occurred",
    });
  }
};

exports.updateAssignTaskStatus = async (req, res) => {
  try {
    const { status, rescheduleDate } = req.body;

    if (
      !["Pending", "Rescheduled", "Completed", "Cancelled"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const updateData = { status };
    if (status === "Rescheduled") {
      if (!rescheduleDate || isNaN(new Date(rescheduleDate).getTime())) {
        return res.status(400).json({
          success: false,
          message:
            "rescheduleDate is required and must be a valid date when status is Rescheduled",
        });
      }
      const rescheduleDateObj = new Date(rescheduleDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (rescheduleDateObj < today) {
        return res.status(400).json({
          success: false,
          message: "rescheduleDate must be a future date",
        });
      }
      updateData.rescheduleDate = rescheduleDateObj;
    } else {
      updateData.rescheduleDate = null;
    }

    const updatedAssignTask = await AssignTask.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate({
        path: "assignTo",
        populate: {
          path: "role",
          select: "roleName" // yaha jitne fields chahiye wo add kar sakte ho
        }
      })
      .lean();

    if (!updatedAssignTask) {
      return res.status(404).json({
        success: false,
        message: "Assign task not found",
      });
    }

    const accountMaster = await AccountMaster.findOne({
      companyName: updatedAssignTask.companyName,
      partyName: updatedAssignTask.partyName,
    })
      .populate("createdBy")
      .lean();

    res.status(200).json({
      success: true,
      message: "Assign task status updated successfully",
      data: { ...updatedAssignTask, accountDetails: accountMaster },
    });
  } catch (error) {
    console.error("Error updating assign task status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update assign task status",
      error: error.message,
    });
  }
};

exports.deleteAssignTask = async (req, res) => {
  try {
    const assignTask = await AssignTask.findByIdAndDelete(req.params.id);
    if (assignTask) {
      res.status(200).json({
        success: true,
        message: "Assign task deleted successfully",
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Assign task not found",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.bulkDeleteAssignTasks = async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No task IDs provided for deletion",
      });
    }

    const result = await AssignTask.deleteMany({ _id: { $in: ids } });
    
    if (result.deletedCount > 0) {
      res.status(200).json({
        success: true,
        message: `${result.deletedCount} tasks deleted successfully`,
        deletedCount: result.deletedCount,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "No tasks found to delete",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getPartyNamesByCompany = async (req, res) => {
  try {
    const { companyName } = req.query;
    if (
      !companyName ||
      !["Sakshi Creation", "Quality Packaging"].includes(companyName)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or missing companyName. Must be 'Sakshi Creation' or 'Quality Packaging'.",
      });
    }

    const accountMasters = await AccountMaster.find({ companyName }).select(
      "partyName"
    );
    const partyNames = accountMasters.map((am) => am.partyName);

    res.status(200).json({
      success: true,
      data: partyNames,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getTasksByStaffId = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Validate staffId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID format",
      });
    }

    // 2. Check if staff exists
    const staff = await Staff.findById(id).select("_id firstName lastName");
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    // 3. Fetch tasks assigned to the staff member
    const tasks = await AssignTask.find({ assignTo: id })
      .populate({
        path: "companyName",
        select: "companyName avatar _id",
      })
      .populate({
        path: "assignTo",
        select: "firstName lastName email role",
        populate: {
          path: "role",
          select: "roleName"
        }
      })
      .populate({
        path: "originalTaskId",
        select: "date status reasonToVisit",
      })
      .populate({
        path: "partyName",
        select: "partyName ownerName ownerMobileNo ownerWhatsAppNo ownerEmail contactPerson personMobileNo personWhatsAppNo contactPersonEmail contactForPayment contactMobileNo contactWhatsAppNo contactForPaymentEmail GSTNo address partyTag statusApproval createdAt updatedAt",
        populate: [
          {
            path: "address.marketName",
            model: "Market",
            select: "marketName",
          },
          {
            path: "address.landMark",
            model: "Market",
            select: "landmark",
          },
          {
            path: "address.area",
            model: "Market",
            select: "area",
          },
          {
            path: "address.pincode",
            model: "Market",
            select: "pincode",
          },
        ],
      })
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for better performance

    // 4. If no tasks found, return an empty array with a message
    if (!tasks || tasks.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No tasks found for this staff member",
        count: 0,
        data: [],
      });
    }

    // 5. Collect all unique company-party combinations for batch query
    const companyPartyCombinations = [];
    const combinationsMap = new Map();

    tasks.forEach(task => {
      if (task.companyName && task.partyName) {
        const key = `${task.companyName._id}_${task.partyName._id}`;
        if (!combinationsMap.has(key)) {
          combinationsMap.set(key, true);
          companyPartyCombinations.push({
            companyName: task.companyName._id,
            party: task.partyName._id
          });
        }
      }
    });

    // 6. Single batch query to fetch all AccountMasters
    let accountMastersMap = new Map();
    
    if (companyPartyCombinations.length > 0) {
      const accountMasters = await AccountMaster.find({
        $or: companyPartyCombinations
      })
      .populate("createdBy", "firstName lastName email")
      .lean();

      // Create map for quick lookup
      accountMasters.forEach(account => {
        const key = `${account.companyName}_${account.party}`;
        accountMastersMap.set(key, {
          createdBy: account.createdBy || null
        });
      });
    }

    // 7. Process tasks sequentially without Promise.all
    const tasksWithCreatedBy = [];
    
    for (const task of tasks) {
      let createdBy = null;
      
      // Lookup createdBy from the map
      if (task.companyName && task.partyName) {
        const key = `${task.companyName._id}_${task.partyName._id}`;
        const accountMaster = accountMastersMap.get(key);
        if (accountMaster && accountMaster.createdBy) {
          createdBy = accountMaster.createdBy;
        }
      }

      // Transform task object with only necessary fields
      const transformedTask = {
        _id: task._id,
        assignTo: task.assignTo ? {
          _id: task.assignTo._id,
          firstName: task.assignTo.firstName,
          lastName: task.assignTo.lastName,
          email: task.assignTo.email,
          role: task.assignTo.role ? {
            _id: task.assignTo.role._id,
            roleName: task.assignTo.role.roleName
          } : null
        } : null,
        companyName: task.companyName ? {
          _id: task.companyName._id,
          companyName: task.companyName.companyName,
          avatar: task.companyName.avatar
        } : null,
        partyName: task.partyName ? {
          _id: task.partyName._id,
          partyName: task.partyName.partyName,
          ownerName: task.partyName.ownerName,
          ownerMobileNo: task.partyName.ownerMobileNo,
          ownerWhatsAppNo: task.partyName.ownerWhatsAppNo,
          ownerEmail: task.partyName.ownerEmail || "N/A",
          contactPerson: task.partyName.contactPerson,
          personMobileNo: task.partyName.personMobileNo,
          personWhatsAppNo: task.partyName.personWhatsAppNo,
          contactPersonEmail: task.partyName.contactPersonEmail || "N/A",
          contactForPayment: task.partyName.contactForPayment,
          contactMobileNo: task.partyName.contactMobileNo,
          contactWhatsAppNo: task.partyName.contactWhatsAppNo,
          contactForPaymentEmail: task.partyName.contactForPaymentEmail || "N/A",
          GSTNo: task.partyName.GSTNo,
          address: task.partyName.address ? {
            streetAddress: task.partyName.address.streetAddress,
            marketName: task.partyName.address.marketName ? {
              _id: task.partyName.address.marketName._id,
              marketName: task.partyName.address.marketName.marketName
            } : null,
            landMark: task.partyName.address.landMark ? {
              _id: task.partyName.address.landMark._id,
              landmark: task.partyName.address.landMark.landmark
            } : null,
            area: task.partyName.address.area ? {
              _id: task.partyName.address.area._id,
              area: task.partyName.address.area.area
            } : null,
            pincode: task.partyName.address.pincode ? {
              _id: task.partyName.address.pincode._id,
              pincode: task.partyName.address.pincode.pincode
            } : null,
            city: task.partyName.address.city,
            state: task.partyName.address.state,
            country: task.partyName.address.country
          } : null,
          partyTag: task.partyName.partyTag,
          statusApproval: task.partyName.statusApproval,
          createdAt: task.partyName.createdAt,
          updatedAt: task.partyName.updatedAt
        } : null,
        originalTaskId: task.originalTaskId ? {
          _id: task.originalTaskId._id,
          date: task.originalTaskId.date,
          status: task.originalTaskId.status,
          reasonToVisit: task.originalTaskId.reasonToVisit
        } : null,
        reasonForVisit: task.reasonForVisit,
        remarks: task.remarks || "NA",
        status: task.status,
        date: task.date,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        createdBy: createdBy
      };

      tasksWithCreatedBy.push(transformedTask);
    }

    // 8. Return the tasks
    res.status(200).json({
      success: true,
      message: "Tasks retrieved successfully",
      staffDetails: {
        _id: staff._id,
        firstName: staff.firstName,
        lastName: staff.lastName
      },
      count: tasksWithCreatedBy.length,
      data: tasksWithCreatedBy,
    });
  } catch (error) {
    console.error("Error fetching tasks by staff ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks",
      error: error.message,
    });
  }
};
