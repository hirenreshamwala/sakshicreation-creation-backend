// const AssignTask = require("../models/assignTask.model");
const mongoose = require("mongoose");
const AccountMaster = require("../models/accountMaster.model");
const Staff = require("../models/staff.model");
const CompanyName = require("../models/companyName.model");
const Party = require("../models/Party.model");
const AssignTask = require("../models/assignTask.model");
const moment = require("moment");
const Market = require("../models/marketData.model");
const PaymentFolder = require("../models/paymentFolder.model");

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

    // COMMENTED OUT: Allow multiple tasks for same party on same date
    // const existingTask = await AssignTask.findOne({
    //   partyName: partyName,
    //   date: {
    //     $gte: new Date(new Date(date).setHours(0, 0, 0, 0)), // Start of day
    //     $lt: new Date(new Date(date).setHours(23, 59, 59, 999)) // End of day
    //   }
    // });

    // if (existingTask) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Task already exists for this party on the same date",
    //   });
    // }

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
      });

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

        // Validate required fields
        if (!companyName || !partyName || !date || !reasonForVisit || !assignTo) {
          errors.push({
            partyName,
            message: "Missing required fields",
            missingFields: { companyName, partyName, date, reasonForVisit, assignTo },
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
          continue;
        }

        if (!party) {
          errors.push({
            partyName,
            message: `Party not found for ID: ${partyName}`,
          });
          continue;
        }

        if (!staff) {
          errors.push({
            partyName,
            message: `Staff not found for ID: ${assignTo}`,
          });
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
            continue;
          }

          let [year, month, day] = date.split("-");
          if (date.match(/^\d{2}-\d{2}-\d{4}$/)) {
            [day, month, year] = date.split("-");
          }
          normalizedDate = new Date(`${year}-${month}-${day}`);

          if (isNaN(normalizedDate.getTime())) {
            errors.push({ partyName, message: "Invalid date provided" });
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
            continue;
          }
        }

        // COMMENTED OUT: Allow multiple tasks for same party on same date
        // const existingTask = await AssignTask.findOne({
        //   partyName: partyName,
        //   date: {
        //     $gte: new Date(new Date(normalizedDate).setHours(0, 0, 0, 0)), // Start of day
        //     $lt: new Date(new Date(normalizedDate).setHours(23, 59, 59, 999)) // End of day
        //   }
        // });

        // if (existingTask) {
        //   errors.push({
        //     partyName,
        //     message: `Task already exists for this party on date: ${date}`,
        //     partyDetails: {
        //       partyId: partyName,
        //       partyName: party.partyName || "N/A",
        //       existingTaskId: existingTask._id
        //     }
        //   });
        //   continue; // Skip this party, continue with next
        // }

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
      } catch (error) {
        console.error(`Error processing task:`, error);
        errors.push({
          partyName: taskData.partyName,
          message: error.message || "Error processing task",
        });
      }
    }

    // Prepare response message based on results
    let message = "";
    if (createdTasks.length === tasksData.length) {
      message = `All ${createdTasks.length} tasks created successfully`;
    } else if (createdTasks.length > 0 && errors.length > 0) {
      message = `${createdTasks.length} tasks created successfully, ${errors.length} failed`;
    } else if (createdTasks.length === 0) {
      message = "No tasks were created";
    }

    return res.status(201).json({
      success: createdTasks.length > 0,
      message: message,
      data: createdTasks,
      errors: errors.length > 0 ? errors : undefined,
      count: {
        total: tasksData.length,
        created: createdTasks.length,
        failed: errors.length
      },
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

exports.getAssignTaskById = async (req, res) => {
  try {
    const assignTask = await AssignTask.findById(req.params.id).populate({
      path: "partyName",
      populate: [
        {
          path: "address.marketName",
          select: "marketName" // choose the fields you want
        },
        {
          path: "address.landMark",
          select: "landmark" // choose the fields you want
        },
        {
          path: "address.area",
          select: "area" // choose the fields you want
        },
        {
          path: "address.pincode",
          select: "pincode" // if pincode is a reference
        }
      ]
    })
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

    const paymentFolder = await PaymentFolder.findOne({ assignTask: id });

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
    let normalizedDate = null;
    if (updateData.date) {
      const date = new Date(updateData.date);
      if (isNaN(date.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }
      normalizedDate = date;
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

    // NEW: Check for duplicate task (only if partyName or date is being updated)
    if (updateData.partyName || updateData.date) {
      // Determine which party and date to check
      const checkPartyId = updateData.partyName || existingTask.partyName;
      const checkDate = normalizedDate || existingTask.date;

      // Create date range for the day
      const startOfDay = new Date(checkDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(checkDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Check for existing task for same party on same date (excluding current task)
      const duplicateTask = await AssignTask.findOne({
        _id: { $ne: id }, // Exclude current task
        partyName: checkPartyId,
        date: {
          $gte: startOfDay,
          $lt: endOfDay
        }
      });

      // if (duplicateTask) {
      //   return res.status(400).json({
      //     success: false,
      //     message: `Task already exists for this party on date: ${checkDate.toISOString().split('T')[0]}`,
      //     details: {
      //       existingTaskId: duplicateTask._id,
      //       partyId: checkPartyId,
      //       date: checkDate
      //     }
      //   });
      // }
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

        // NEW: Check if rescheduled task would create a duplicate
        const rescheduleStartOfDay = new Date(rescheduleDate);
        rescheduleStartOfDay.setHours(0, 0, 0, 0);

        const rescheduleEndOfDay = new Date(rescheduleDate);
        rescheduleEndOfDay.setHours(23, 59, 59, 999);

        const existingRescheduledTask = await AssignTask.findOne({
          partyName: existingTask.partyName,
          date: {
            $gte: rescheduleStartOfDay,
            $lt: rescheduleEndOfDay
          },
          isRescheduledTask: false // Check only non-rescheduled tasks
        });

        if (existingRescheduledTask) {
          return res.status(400).json({
            success: false,
            message: `Cannot reschedule: Task already exists for this party on rescheduled date: ${rescheduleDate.toISOString().split('T')[0]}`,
            details: {
              existingTaskId: existingRescheduledTask._id,
              partyId: existingTask.partyName,
              rescheduleDate: rescheduleDate
            }
          });
        }

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

        // Create a new task with the rescheduled date - INCLUDING orderId
        const newTaskData = {
          companyName: existingTask.companyName,
          partyName: existingTask.partyName,
          date: rescheduleDate,
          time: existingTask.time,
          reasonForVisit: existingTask.reasonForVisit,
          remarks: existingTask.remarks,
          assignTo: existingTask.assignTo,
          status: "Pending",
          orderId: existingTask.orderId || null, // ✅ Include orderId from original task
          isRescheduledTask: true,
          originalTaskId: existingTask._id,
          rescheduleDate: null,
          createdAt: originalCreatedAt, // Explicitly set the original createdAt
        };

        const newTask = new AssignTask(newTaskData);
        await newTask.save();

        // Sync with PaymentFolder if exists
        if (paymentFolder) {
          paymentFolder.assignTask = newTask._id;
          paymentFolder.assignedDate = newTask.date;
          await paymentFolder.save();
        }

        // Populate the new task for the response
        populatedNewTask = await AssignTask.findById(newTask._id)
          .populate("companyName", "companyName avatar")
          .populate("partyName", "partyName address ownerName personMobileNo")
          .populate({
            path: "assignTo",
            populate: {
              path: "role",
              select: "roleName"
            }
          });
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
          select: "roleName"
        }
      });

    // Sync status change with PaymentFolder if exists and not rescheduled
    if (paymentFolder && updateData.status && updateData.status !== "Rescheduled") {
      // No specific action needed for other status changes in PaymentFolder for now,
      // but we ensure the relationship is tracked.
    }

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

exports.getAllAssignTasks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      companyName,
      assignTo,
      assignedTo,
      priority,
      getDatesOnly = false,
      startDate,
      endDate,
      date,
      unitNo,
      marketName,
      mobile,
      reason,
      // createdBy,
      assignToFilter,
      party,
      area,
      search,
    } = req.body;
    const createdBy = req.body.assignBy;
    const skip = (page - 1) * limit;

    // Filters that can be applied BEFORE lookups (direct fields on AssignTask)
    const preMatchConditions = {};

    // Filters that need to be applied AFTER lookups (nested/populated fields)
    const postMatchConditions = {};

    /* ================================
       DATE RANGE FILTER - APPLIED BEFORE LOOKUPS
    ================================ */
    if (date) {

      if (typeof date === 'string' && date.includes(',')) {
        // Multiple dates
        const dates = date.split(',').map(d => d.trim()).filter(d => d);
        const dateConditions = [];

        dates.forEach(dateStr => {
          const parsedDate = parseDateString(dateStr);
          const startOfDay = new Date(parsedDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(parsedDate);
          endOfDay.setHours(23, 59, 59, 999);

          dateConditions.push({
            date: { $gte: startOfDay, $lte: endOfDay }
          });
        });

        if (dateConditions.length > 0) {
          preMatchConditions.$or = preMatchConditions.$or || [];
          preMatchConditions.$or.push(...dateConditions);
        }
      } else {
        // Single date
        const parsedDate = parseDateString(date);
        const startOfDay = new Date(parsedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(parsedDate);
        endOfDay.setHours(23, 59, 59, 999);

        preMatchConditions.date = {
          $gte: startOfDay,
          $lte: endOfDay,
        };
      }
    }

    // Apply startDate and endDate if date is not provided OR if you want range alongside specific date
    if (startDate && endDate && !date) {
      preMatchConditions.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    /* ================================
       COMPANY FILTER - APPLIED BEFORE LOOKUPS
    ================================ */
    if (companyName) {

      if (mongoose.Types.ObjectId.isValid(companyName)) {
        preMatchConditions.companyName = new mongoose.Types.ObjectId(companyName);
      } else {
        // Name-based filter will be applied after lookup
        postMatchConditions["companyData.companyName"] = {
          $regex: companyName,
          $options: "i",
        };
      }
    }

    /* ================================
       STATUS FILTER - APPLIED BEFORE LOOKUPS
    ================================ */
    if (status && status.length > 0) {
      const statusArray = Array.isArray(status) ? status : status.split(",");
      preMatchConditions.status = {
        $in: statusArray.map((s) => new RegExp(`^${s}$`, "i")),
      };
    }

    /* ================================
       PRIORITY FILTER - APPLIED BEFORE LOOKUPS
    ================================ */
    if (priority) {
      preMatchConditions.priority = new RegExp(`^${priority}$`, "i");
    }

    /* ================================
       REASON FOR VISIT FILTER - APPLIED BEFORE LOOKUPS
    ================================ */
    if (reason) {

      const predefinedReasons = ['delivery', 'get payment', 'visit', 'order', 'complain', 'sample approval'];
      const reasons = reason.split(',').map(r => r.trim().toLowerCase()).filter(r => r);

      if (reasons.length > 0) {
        const otherIncluded = reasons.includes('other');
        const specificReasons = reasons.filter(r => r !== 'other');

        if (otherIncluded && specificReasons.length === 0) {
          // Only "other" selected
          preMatchConditions.reasonForVisit = {
            $nin: predefinedReasons.map(r => new RegExp(`^${r}$`, "i"))
          };
        } else if (otherIncluded && specificReasons.length > 0) {
          // "other" + specific reasons
          preMatchConditions.$or = preMatchConditions.$or || [];
          preMatchConditions.$or.push(
            {
              reasonForVisit: {
                $in: specificReasons.map(r => new RegExp(`^${r}$`, "i"))
              }
            },
            {
              reasonForVisit: {
                $nin: predefinedReasons.map(r => new RegExp(`^${r}$`, "i"))
              }
            }
          );
        } else {
          // Only specific reasons
          preMatchConditions.reasonForVisit = {
            $in: specificReasons.map(r => new RegExp(`^${r}$`, "i"))
          };
        }
      }
    }

    /* ================================
       BASE PIPELINE WITH ALL LOOKUPS
    ================================ */
    const basePipeline = [
      // Apply pre-match conditions FIRST (before lookups for better performance)
      ...(Object.keys(preMatchConditions).length > 0 ? [{ $match: preMatchConditions }] : []),

      // 1. TASK → COMPANY
      {
        $lookup: {
          from: "companynames",
          localField: "companyName",
          foreignField: "_id",
          as: "companyData"
        }
      },
      { $unwind: { path: "$companyData", preserveNullAndEmptyArrays: true } },

      // 2. TASK → PARTY
      {
        $lookup: {
          from: "parties",
          localField: "partyName",
          foreignField: "_id",
          as: "partyData"
        }
      },
      { $unwind: { path: "$partyData", preserveNullAndEmptyArrays: true } },

      // 3. TASK → ASSIGN TO (STAFF)
      {
        $lookup: {
          from: "staffs",
          localField: "assignTo",
          foreignField: "_id",
          as: "assignToData"
        }
      },
      { $unwind: { path: "$assignToData", preserveNullAndEmptyArrays: true } },

      // 4. STAFF → ROLE
      // {
      //   $lookup: {
      //     from: "roles",
      //     localField: "assignToData.role",
      //     foreignField: "_id",
      //     as: "assignToData.roleData"
      //   }
      // },
      { $unwind: { path: "$assignToData.roleData", preserveNullAndEmptyArrays: true } },

      // 5. STAFF → DEPARTMENT
      {
        $lookup: {
          from: "departments",
          localField: "assignToData.department",
          foreignField: "_id",
          as: "assignToData.departmentData"
        }
      },
      { $unwind: { path: "$assignToData.departmentData", preserveNullAndEmptyArrays: true } },

      // 6. PARTY ADDRESS → MARKET NAME
      {
        $lookup: {
          from: "markets",
          localField: "partyData.address.marketName",
          foreignField: "_id",
          as: "marketNameData"
        }
      },

      // 7. PARTY ADDRESS → AREA
      {
        $lookup: {
          from: "markets",
          localField: "partyData.address.area",
          foreignField: "_id",
          as: "areaData"
        }
      },

      // 8. PARTY ADDRESS → LANDMARK
      {
        $lookup: {
          from: "markets",
          localField: "partyData.address.landMark",
          foreignField: "_id",
          as: "landMarkData"
        }
      },

      // 9. PARTY ADDRESS → PINCODE
      {
        $lookup: {
          from: "markets",
          localField: "partyData.address.pincode",
          foreignField: "_id",
          as: "pincodeData"
        }
      },

      // 10. COMPANY → OWNER
      {
        $lookup: {
          from: "users",
          localField: "companyData.owner",
          foreignField: "_id",
          as: "companyData.ownerData"
        }
      },
      { $unwind: { path: "$companyData.ownerData", preserveNullAndEmptyArrays: true } },

      // 11. ACCOUNT MASTER FOR CREATED BY
      {
        $lookup: {
          from: "accountmasters",
          let: { partyId: "$partyName", companyId: "$companyName" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$party", "$$partyId"] },
                    { $eq: ["$companyName", "$$companyId"] }
                  ]
                }
              }
            },
            {
              $lookup: {
                from: "staffs",
                localField: "createdBy",
                foreignField: "_id",
                as: "createdByData"
              }
            },
            { $unwind: "$createdByData" }
          ],
          as: "accountData"
        }
      },
      { $unwind: { path: "$accountData", preserveNullAndEmptyArrays: true } },

      // 12. ORIGINAL TASK (IF RESCHEDULED)
      {
        $lookup: {
          from: "assigntasks",
          localField: "originalTaskId",
          foreignField: "_id",
          as: "originalTaskData"
        }
      },
      { $unwind: { path: "$originalTaskData", preserveNullAndEmptyArrays: true } },
    ];

    /* ================================
       POST-LOOKUP FILTERS (Applied after all lookups)
    ================================ */

    // UNIT NO FILTER
    if (unitNo) {
      const unitNos = unitNo.split(',').map(u => u.trim()).filter(u => u);
      if (unitNos.length > 0) {
        postMatchConditions["partyData.address.unitNo"] = {
          $in: unitNos.map(unit => new RegExp(`^${unit}$`, "i"))
        };
      }
    }

    // MARKET NAME FILTER
    if (marketName) {
      const marketNames = marketName.split(',').map(m => m.trim()).filter(m => m);
      if (marketNames.length > 0) {
        postMatchConditions["marketNameData.marketName"] = {
          $in: marketNames.map(name => new RegExp(name, "i"))
        };
      }
    }

    // MOBILE NUMBER FILTER
    if (mobile) {
      postMatchConditions.$or = postMatchConditions.$or || [];
      postMatchConditions.$or.push(
        { "partyData.ownerMobileNo": { $regex: mobile, $options: "i" } },
        { "partyData.personMobileNo": { $regex: mobile, $options: "i" } },
        { "partyData.contactMobileNo": { $regex: mobile, $options: "i" } },
        { "partyData.ownerWhatsAppNo": { $regex: mobile, $options: "i" } },
        { "partyData.personWhatsAppNo": { $regex: mobile, $options: "i" } },
        { "partyData.contactWhatsAppNo": { $regex: mobile, $options: "i" } }
      );
    }

    // CREATED BY FILTER
    if (createdBy) {
      const createdByNames = createdBy
        .split(',')
        .map(name => name.trim())
        .filter(Boolean);

      const createdByConditions = [];

      createdByNames.forEach(name => {
        const parts = name.split(' ').filter(Boolean);

        // FULL NAME (First + Last)
        if (parts.length >= 2) {
          const firstName = parts[0];
          const lastName = parts.slice(1).join(" ");

          createdByConditions.push({
            $and: [
              { "accountData.createdByData.firstName": { $regex: `^${firstName}$`, $options: "i" } },
              { "accountData.createdByData.lastName": { $regex: `^${lastName}$`, $options: "i" } }
            ]
          });
        }
        // ONLY FIRST NAME
        else {
          createdByConditions.push({
            "accountData.createdByData.firstName": {
              $regex: `^${parts[0]}$`,
              $options: "i"
            }
          });
        }
      });

      if (createdByConditions.length > 0) {
        postMatchConditions.$or = createdByConditions;
      }
    }


    // ASSIGN TO FILTER
    const assignToValue = assignedTo || assignTo;
    let finalAssignToIds = [];

    if (assignToValue && assignToValue.trim() !== '') {

      if (mongoose.Types.ObjectId.isValid(assignToValue)) {
        finalAssignToIds.push(new mongoose.Types.ObjectId(assignToValue));
      } else {
        const staffs = await mongoose.model("Staff").find({
          $or: [
            { firstName: { $regex: assignToValue, $options: "i" } },
            { lastName: { $regex: assignToValue, $options: "i" } },
            {
              $expr: {
                $regexMatch: {
                  input: { $concat: ["$firstName", " ", "$lastName"] },
                  regex: assignToValue,
                  options: "i"
                }
              }
            }
          ]
        }).select("_id firstName lastName");

        if (staffs.length > 0) {
          finalAssignToIds = staffs.map(staff => staff._id);
        } else {
          return res.status(200).json({
            success: true,
            data: [],
            count: 0,
            pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
          });
        }
      }
    }

    // ASSIGN TO FILTER (comma-separated)
    if (assignToFilter && assignToFilter.trim() !== '') {
      const assignToNames = assignToFilter
        .split(',')
        .map(name => {
          // 🔥 FIX 1: Trailing " -" ya "-" hatao jo tab aata hai jab staff ka lastName empty ho
          // Example: "SUSHIL -" → "SUSHIL"  |  "ANIL  -" → "ANIL"
          return name.trim().replace(/\s*-\s*$/, '').trim();
        })
        .filter(name => name !== '');  // Empty names skip karo

      let filterStaffIds = [];

      for (const name of assignToNames) {
        if (mongoose.Types.ObjectId.isValid(name)) {
          filterStaffIds.push(new mongoose.Types.ObjectId(name));
        } else {
          // 🔥 FIX 2: "-" jaise invalid parts filter karo
          const parts = name.split(' ').filter(p => p && p !== '-');

          if (parts.length === 0) continue; // Kuch valid nahi mila toh skip

          let staffQuery = { $or: [] };

          if (parts.length >= 2) {
            // Full name - firstName + lastName dono match karo
            staffQuery.$or.push({
              $and: [
                { firstName: { $regex: `^${parts[0]}$`, $options: 'i' } },
                { lastName: { $regex: `^${parts[1]}$`, $options: 'i' } }
              ]
            });
            // Fallback: sirf firstName se bhi match karo (agar lastName DB mein different ho)
            staffQuery.$or.push({
              firstName: { $regex: `^${parts[0]}$`, $options: 'i' }
            });
          } else {
            // Sirf firstName
            staffQuery.$or.push({ firstName: { $regex: `^${parts[0]}$`, $options: 'i' } });
          }

          const staffs = await mongoose.model("Staff").find(staffQuery).select("_id firstName lastName");
          filterStaffIds.push(...staffs.map(s => s._id));
        }
      }

      // Merge comma-separated results into finalAssignToIds and de-duplicate
      if (filterStaffIds.length > 0) {
        const merged = [...finalAssignToIds, ...filterStaffIds].map(id => id.toString());
        const unique = Array.from(new Set(merged)).map(id => new mongoose.Types.ObjectId(id));
        finalAssignToIds = unique;
      }
    }


    if (finalAssignToIds.length > 0) {
      postMatchConditions["assignToData._id"] = { $in: finalAssignToIds };
    }

    // PARTY FILTER
    if (party) {
      const partyNames = party.split(',').map(p => p.trim()).filter(p => p);
      if (partyNames.length > 0) {
        postMatchConditions["partyData.partyName"] = {
          $in: partyNames.map(name => new RegExp(name, "i"))
        };
      }
    }

    // AREA FILTER
    if (area) {
      const areaNames = area.split(',').map(a => a.trim()).filter(a => a);
      if (areaNames.length > 0) {
        postMatchConditions["areaData.area"] = {
          $in: areaNames.map(name => new RegExp(name, "i"))
        };
      }
    }

    // Apply post-match conditions
    if (Object.keys(postMatchConditions).length > 0) {
      basePipeline.push({ $match: postMatchConditions });
    }

    /* ================================
       SEARCH FUNCTIONALITY
    ================================ */
    if (search && search.trim() !== '') {
      const searchRegex = { $regex: search, $options: 'i' };

      const searchCondition = {
        $or: [
          { "companyData.companyName": searchRegex },
          { "partyData.partyName": searchRegex },
          { "assignToData.firstName": searchRegex },
          { "assignToData.lastName": searchRegex },
          { "partyData.ownerMobileNo": searchRegex },
          { "partyData.personMobileNo": searchRegex },
          { "partyData.contactMobileNo": searchRegex },
          { "partyData.ownerWhatsAppNo": searchRegex },
          { "partyData.personWhatsAppNo": searchRegex },
          { "partyData.contactWhatsAppNo": searchRegex },
          { "partyData.address.unitNo": searchRegex },
          { "marketNameData.marketName": searchRegex },
          { "areaData.area": searchRegex },
          { reasonForVisit: searchRegex },
          { status: searchRegex },
          { remarks: searchRegex },
          { feedback: searchRegex },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ["$assignToData.firstName", " ", "$assignToData.lastName"] },
                regex: search,
                options: "i"
              }
            }
          },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ["$accountData.createdByData.firstName", " ", "$accountData.createdByData.lastName"] },
                regex: search,
                options: "i"
              }
            }
          }
        ]
      };

      basePipeline.push({ $match: searchCondition });
    }

    // Add sorting
    basePipeline.push({ $sort: { createdAt: -1 } });

    /* ================================
       ONLY DATES
    ================================ */
    if (getDatesOnly) {
      const dates = await AssignTask.aggregate([
        ...basePipeline,
        {
          $project: {
            _id: 0,
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          },
        },
        { $group: { _id: "$date", count: { $sum: 1 } } },
        { $project: { _id: 0, date: "$_id", count: 1 } },
        { $sort: { date: 1 } }
      ]);

      return res.status(200).json({
        success: true,
        total: dates.length,
        data: dates,
      });
    }

    /* ================================
       FINAL DATA WITH PAGINATION
    ================================ */
    const paginatedPipeline = [
      ...basePipeline,
      { $skip: parseInt(skip) },
      { $limit: parseInt(limit) },
      {
        $project: {
          _id: 1,
          date: 1,
          time: 1,
          reasonForVisit: 1,
          remarks: 1,
          status: 1,
          visitDate: 1,
          visitTime: 1,
          feedback: 1,
          rescheduleDate: 1,
          isRescheduledTask: 1,
          createdAt: 1,
          updatedAt: 1,

          companyName: {
            _id: "$companyData._id",
            companyName: "$companyData.companyName",
            avatar: "$companyData.avatar",
          },

          partyName: {
            _id: "$partyData._id",
            partyName: "$partyData.partyName",
            ownerName: "$partyData.ownerName",
            ownerMobileNo: "$partyData.ownerMobileNo",
            ownerWhatsAppNo: "$partyData.ownerWhatsAppNo",
            contactPerson: "$partyData.contactPerson",
            personMobileNo: "$partyData.personMobileNo",
            personWhatsAppNo: "$partyData.personWhatsAppNo",
            contactForPayment: "$partyData.contactForPayment",
            contactMobileNo: "$partyData.contactMobileNo",
            contactWhatsAppNo: "$partyData.contactWhatsAppNo",
            GSTNo: "$partyData.GSTNo",
            partyTag: "$partyData.partyTag",
            createdAt: "$partyData.createdAt",
            updatedAt: "$partyData.updatedAt",

            address: {
              unitNo: "$partyData.address.unitNo",
              marketName: {
                _id: { $arrayElemAt: ["$marketNameData._id", 0] },
                marketName: { $arrayElemAt: ["$marketNameData.marketName", 0] }
              },
              // landMark: {
              //   _id: { $arrayElemAt: ["$landMarkData._id", 0] },
              //   landmark: { $arrayElemAt: ["$landMarkData.landmark", 0] }
              // },
              area: {
                _id: { $arrayElemAt: ["$areaData._id", 0] },
                area: { $arrayElemAt: ["$areaData.area", 0] }
              },
              // pincode: {
              //   _id: { $arrayElemAt: ["$pincodeData._id", 0] },
              //   pincode: { $arrayElemAt: ["$pincodeData.pincode", 0] }
              // }
            },

            createdBy: {
              _id: "$accountData.createdByData._id",
              firstName: "$accountData.createdByData.firstName",
              lastName: "$accountData.createdByData.lastName",
              email: "$accountData.createdByData.email"
            }
          },

          assignTo: {
            _id: "$assignToData._id",
            firstName: "$assignToData.firstName",
            lastName: "$assignToData.lastName",
            // email: "$assignToData.email",
            // phone: "$assignToData.phone",
            // designation: "$assignToData.designation",
            // employeeId: "$assignToData.employeeId",
            // profileImage: "$assignToData.profileImage",
            // isActive: "$assignToData.isActive",
            // createdAt: "$assignToData.createdAt",
            // updatedAt: "$assignToData.updatedAt",

            // role: {
            //   _id: "$assignToData.roleData._id",
            //   roleName: "$assignToData.roleData.roleName",
            //   description: "$assignToData.roleData.description",
            //   permissions: "$assignToData.roleData.permissions"
            // },

            // department: {
            //   _id: "$assignToData.departmentData._id",
            //   name: "$assignToData.departmentData.name",
            //   description: "$assignToData.departmentData.description"
            // }
          },

          originalTaskId: {
            _id: "$originalTaskData._id",
            date: "$originalTaskData.date",
            time: "$originalTaskData.time",
            reasonForVisit: "$originalTaskData.reasonForVisit",
            status: "$originalTaskData.status",
            createdAt: "$originalTaskData.createdAt"
          }
        }
      }
    ];

    const tasks = await AssignTask.aggregate(paginatedPipeline);

    // Count total documents
    const countPipeline = [...basePipeline];
    countPipeline.push({ $count: "total" });

    const countResult = await AssignTask.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    return res.status(200).json({
      success: true,
      data: tasks,
      count: total,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("❌ getAllAssignTasks Error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};

// Helper function to parse date strings in various formats
function parseDateString(dateStr) {
  if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    // Check if it's DD-MM-YYYY format
    if (parts.length === 3 && parts[0].length <= 2) {
      const [day, month, year] = parts;
      return new Date(year, month - 1, day);
    }
  }
  return new Date(dateStr);
}

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

    // 1. Sync with PaymentFolder if exists
    const paymentFolder = await PaymentFolder.findOne({ assignTask: req.params.id });

    const updateData = { status };
    let populatedNewTask = null;

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

      // Create new task for rescheduling (matching logic in updateAssignTask)
      const existingTask = await AssignTask.findById(req.params.id);
      if (existingTask) {
        const newTaskData = {
          companyName: existingTask.companyName,
          partyName: existingTask.partyName,
          date: rescheduleDateObj,
          time: existingTask.time,
          reasonForVisit: existingTask.reasonForVisit,
          remarks: existingTask.remarks,
          assignTo: existingTask.assignTo,
          status: "Pending",
          orderId: existingTask.orderId || null,
          isRescheduledTask: true,
          originalTaskId: existingTask._id,
          rescheduleDate: null,
          createdAt: existingTask.createdAt,
        };

        const newTask = new AssignTask(newTaskData);
        await newTask.save();

        // Sync PaymentFolder to the new task
        if (paymentFolder) {
          paymentFolder.assignTask = newTask._id;
          paymentFolder.assignedDate = newTask.date;
          await paymentFolder.save();
        }

        populatedNewTask = await AssignTask.findById(newTask._id)
          .populate("assignTo", "firstName lastName");
      }
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
    const { id } = req.params;

    // Sync with PaymentFolder if exists
    await PaymentFolder.updateMany({ assignTask: id }, {
      $unset: { assignTask: 1, assignedTo: 1, assignedDate: 1 }
    });

    const assignTask = await AssignTask.findByIdAndDelete(id);
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

    // Sync with PaymentFolder if exists
    await PaymentFolder.updateMany({ assignTask: { $in: ids } }, {
      $unset: { assignTask: 1, assignedTo: 1, assignedDate: 1 }
    });

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
    const staff = await Staff.findById(id);
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
        select: "companyName",
      })
      .populate({
        path: "partyName",
        select: "partyName address ownerName personMobileNo",
      })
      .populate({
        path: "assignTo",
        populate: {
          path: "role",
          select: "roleName" // yaha jitne fields chahiye wo add kar sakte ho
        }
      })
      .populate({
        path: "originalTaskId",
        select: "date status",
      })
      .populate({
        path: "partyName",
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
      .sort({ createdAt: -1 });

    // 4. If no tasks found, return an empty array with a message
    if (!tasks || tasks.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No tasks found for this staff member",
        count: 0,
        data: [],
      });
    }

    // 5. Fetch AccountMaster for each task to get createdBy
    const tasksWithCreatedBy = await Promise.all(
      tasks.map(async (task) => {
        const accountMaster = await AccountMaster.findOne({
          companyName: task.companyName,
          party: task.partyName,
        })
          .populate("createdBy", "firstName lastName")
          .lean();

        return {
          ...task.toObject(),
          createdBy: accountMaster ? accountMaster.createdBy : null,
        };
      })
    );

    // 6. Return the tasks
    res.status(200).json({
      success: true,
      message: "Tasks retrieved successfully",
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

exports.getAssignTaskFilterOptionsData = async (req, res) => {
  try {
    const { field } = req.params;
    const { search } = req.body || {};

    let uniqueValues = [];

    switch (field) {
      /* ✅ COMPANY NAME */
      case "companyName": {
        const companyIds = await AssignTask.distinct("companyName");
        const companies = await CompanyName.find(
          { _id: { $in: companyIds } },
          "companyName"
        );
        uniqueValues = companies.map(c => c.companyName).filter(Boolean);
        break;
      }

      /* ✅ DATE (CREATED DATE) */
      case "date":
      case "createdAt": {
        const dates = await AssignTask.distinct("date");
        uniqueValues = dates
          .sort((a, b) => new Date(b) - new Date(a))
          .map(d => moment(d).format("DD-MM-YYYY"))
          .filter(Boolean);
        break;
      }

      /* ✅ PARTY NAME */
      case "partyName": {
        const partyIds = await AssignTask.distinct("partyName");
        const parties = await Party.find(
          { _id: { $in: partyIds } },
          "partyName"
        );
        uniqueValues = parties.map(p => p.partyName).filter(Boolean);
        break;
      }

      /* ✅ UNIT NO */
      case "unitNo": {
        const partyIds = await AssignTask.distinct("partyName");
        const parties = await Party.find(
          { _id: { $in: partyIds } },
          "address.unitNo"
        );
        uniqueValues = parties
          .map(p => p.address?.unitNo)
          .filter(Boolean);
        break;
      }

      /* ✅ MARKET NAME */
      case "marketName": {
        const partyIds = await AssignTask.distinct("partyName");
        const parties = await Party.find(
          { _id: { $in: partyIds } },
          "address.marketName"
        );
        const marketIds = parties
          .map(p => p.address?.marketName)
          .filter(Boolean);

        const markets = await Market.find(
          { _id: { $in: marketIds } },
          "marketName"
        );
        uniqueValues = markets.map(m => m.marketName).filter(Boolean);
        break;
      }

      /* ✅ AREA */
      case "area": {
        const partyIds = await AssignTask.distinct("partyName");
        const parties = await Party.find(
          { _id: { $in: partyIds } },
          "address.area"
        );
        const areaIds = parties
          .map(p => p.address?.area)
          .filter(Boolean);

        const areas = await Market.find(
          { _id: { $in: areaIds } },
          "area"
        );
        uniqueValues = areas.map(a => a.area).filter(Boolean);
        break;
      }

      /* ✅ MOBILE NO. */
      case "mobile": {
        const partyIds = await AssignTask.distinct("partyName");
        const parties = await Party.find(
          { _id: { $in: partyIds } },
          "ownerWhatsAppNo contactMobileNo ownerMobileNo"
        );

        // Collect all mobile numbers from different fields
        const mobileNumbers = [];
        parties.forEach(party => {
          if (party.ownerWhatsAppNo) mobileNumbers.push(party.ownerWhatsAppNo);
          if (party.contactMobileNo) mobileNumbers.push(party.contactMobileNo);
          if (party.ownerMobileNo) mobileNumbers.push(party.ownerMobileNo);
        });

        uniqueValues = [...new Set(mobileNumbers)].filter(Boolean);
        break;
      }

      /* ✅ REASON TO VISIT */
      case "reason":
      case "reasonForVisit": {
        uniqueValues = ['delivery', 'get payment', 'visit', 'order', 'complain', 'sample approval', 'other']
        break;
      }

      /* ✅ ASSIGNED TO (STAFF) */
      case "assignedTo":
      case "assignTo": {
        const staffIds = await AssignTask.distinct("assignTo");
        const staff = await Staff.find(
          { _id: { $in: staffIds } },
          "firstName lastName"
        );
        uniqueValues = staff.map(s => `${s.firstName} ${s.lastName}`).filter(Boolean);
        break;
      }

      /* ✅ CREATED BY (FROM ACCOUNTMASTER) - UPDATED FLOW */
      case "createdBy": {
        // Step 1: Get all distinct party IDs from tasks
        const partyIds = await AssignTask.distinct("partyName");

        // Step 2: Get all distinct company IDs from tasks
        const companyIds = await AssignTask.distinct("companyName");

        // Step 3: Find AccountMaster records for these party-company combinations
        const accountData = await AccountMaster.find({
          party: { $in: partyIds },
          companyName: { $in: companyIds }
        }, "createdBy").lean();

        // Step 4: Extract unique createdBy IDs
        const createdByIds = [...new Set(
          accountData
            .map(a => a.createdBy)
            .filter(Boolean)
        )];

        // Step 5: Get staff details for these createdBy IDs
        const staff = await Staff.find(
          { _id: { $in: createdByIds } },
          "firstName lastName"
        );

        // Step 6: Format as full names
        uniqueValues = [...new Set(
          staff.map(s => `${s.firstName} ${s.lastName}`)
        )].filter(Boolean);
        break;
      }

      /* ✅ STATUS */
      case "status": {
        uniqueValues = await AssignTask.distinct("status");
        uniqueValues = uniqueValues.filter(Boolean);
        break;
      }

      /* ✅ PRIORITY */
      case "priority": {
        uniqueValues = await AssignTask.distinct("priority");
        uniqueValues = uniqueValues.filter(Boolean);
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid field parameter",
        });
    }

    /* ================================
       SEARCH SUPPORT
    ================================ */
    if (search) {
      const text = search.toLowerCase();
      uniqueValues = uniqueValues.filter(val =>
        val?.toString().toLowerCase().includes(text)
      );
    }

    /* ================================
       CLEAN + SORT + LIMIT
    ================================ */
    uniqueValues = [...new Set(uniqueValues)].filter(Boolean).sort();
    // uniqueValues = uniqueValues.slice(0, 100);

    return res.status(200).json({
      success: true,
      data: uniqueValues,
      count: uniqueValues.length
    });

  } catch (error) {
    console.error("AssignTask Filter Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
}


exports.getTaskForParty = async (req, res) => {
  try {
    const { partyId, companyNameId, assignedTo, title, description, dueDate, priority, relatedTo, status } = req.body;

    // Validate required fields
    if (!partyId) {
      return res.status(400).json({
        success: false,
        message: "partyId is required"
      });
    }

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: "assignedTo is required"
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Task title is required"
      });
    }

    const partyObjectId = new mongoose.Types.ObjectId(partyId);
    const assignedToObjectId = new mongoose.Types.ObjectId(assignedTo);

    // First verify party exists
    const partyExists = await AccountMaster.findOne({
      party: partyObjectId,
      ...(companyNameId && { companyName: new mongoose.Types.ObjectId(companyNameId) })
    });

    if (!partyExists) {
      return res.status(404).json({
        success: false,
        message: "Party not found"
      });
    }

    // Create task object
    const taskData = {
      party: partyObjectId,
      assignedTo: assignedToObjectId,
      title,
      description: description || "",
      createdBy: req.user._id, // Assuming user is authenticated and user data is in req.user
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority || "Medium",
      status: status || "Pending",
      ...(companyNameId && { companyName: new mongoose.Types.ObjectId(companyNameId) }),
      ...(relatedTo && { relatedTo: new mongoose.Types.ObjectId(relatedTo) })
    };

    // Create the task
    const newTask = await AssignTask.create(taskData);

    // Populate the created task for response
    const populatedTask = await AssignTask.findById(newTask._id)
      .populate("party")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("companyName")
      .populate("relatedTo");

    return res.status(201).json({
      success: true,
      message: "Task assigned successfully",
      data: populatedTask
    });

  } catch (error) {
    console.error("Error assigning task:", error);

    // Handle duplicate or validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while assigning task",
      error: error.message
    });
  }
};

exports.getPartyTask = async (req, res) => {
  try {
    const { partyId } = req.body;

    // Validation
    if (!partyId) {
      return res.status(400).json({
        success: false,
        message: "partyId is required",
      });
    }

    // Fetch all tasks assigned to the party
    const tasks = await AssignTask.find({ partyName: partyId })
      .populate("partyName", "name mobile email address")  // Party details
      .populate("companyName", "companyName address")       // Company details
      .populate("assignTo", "name email phone role")        // Staff assigned
      .populate("originalTaskId")                           // If rescheduled task
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Tasks fetched successfully",
      data: tasks,
    });

  } catch (error) {
    console.error("Error fetching party tasks:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching tasks",
      error: error.message,
    });
  }
};