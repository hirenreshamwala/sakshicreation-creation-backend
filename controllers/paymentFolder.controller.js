const mongoose = require("mongoose");
const PaymentFolder = require("../models/paymentFolder.model");
const AssignTask = require("../models/assignTask.model")

exports.createPaymentFolder = async (req, res) => {
  try {
    const {
      company,
      party,
      assignedTo,
      assignedDate,
      remarks,
      paymentType,
      month,
      paymentAmount,
      area,
      receivedAmount = 0
    } = req.body;

    const pendingAmount = paymentAmount - receivedAmount;

    // First create the assign task
    const newAssignTask = new AssignTask({
      companyName: company,
      partyName: party,
      date: new Date(assignedDate),
      time: assignedDate,
      reasonForVisit: "Get Payment",
      remarks: remarks || "",
      assignTo: assignedTo,
      status: "Pending",
      visitDate: req.body.visitDate ? new Date(req.body.visitDate) : null,
      visitTime: req.body.visitTime || "",
      feedback: req.body.feedback || "",
      isRescheduledTask: req.body.isRescheduledTask || false,
      originalTaskId: req.body.originalTaskId || null,
    });

    const savedAssignTask = await newAssignTask.save();

    // Now create payment folder with assignTask ID
    const data = await PaymentFolder.create({
      company,
      party,
      assignedTo,
      assignedDate,
      remarks,
      paymentType,
      month,
      paymentAmount,
      area,
      receivedAmount,
      pendingAmount,
      assignTask: savedAssignTask._id, // Store the assign task ID
    });

    const newData = await PaymentFolder.findById(data._id)
      .populate("company")
      .populate({
        path: "party",
        select: "-__v",
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
      .populate("assignedTo", "firstName lastName email")
      .populate("assignTask") // Populate assign task as well
      .populate({
        path: "payments.receivedBy",
        select: "firstName lastName",
      })
      .sort({ createdAt: -1 });

    res.status(201).json({
      message: "Payment Folder Created Successfully",
      newData
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.getPaymentFolders = async (req, res) => {
  try {
    const data = await PaymentFolder.find()
      .populate("company")
      .populate({
        path: "party",
        select: "-__v",
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
      .populate("assignedTo", "firstName lastName email")
      .populate("assignTask") // Populate assign task
      .populate({
        path: "payments.receivedBy",
        select: "firstName lastName",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPaymentFolderById = async (req, res) => {
  try {
    const data = await PaymentFolder.findById(req.params.id)
      .populate("company")
      .populate({
        path: "party",
        select: "-__v",
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
      .populate("assignedTo", "firstName lastName email")
      .populate("assignTask") // Populate assign task
      .populate({
        path: "payments.receivedBy",
        select: "firstName lastName",
      })

    if (!data)
      return res.status(404).json({ message: "Payment folder not found" });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updatePaymentFolder = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Fetch existing document
    const existing = await PaymentFolder.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Payment folder not found" });
    }

    // If assignedDate is being updated, also update the assign task
    if (updateData.assignedDate && existing.assignTask) {
      await AssignTask.findByIdAndUpdate(existing.assignTask, {
        date: new Date(updateData.assignedDate),
        time: updateData.assignedDate,
      });
    }

    // If assignedTo is being updated, also update the assign task
    if (updateData.assignedTo && existing.assignTask) {
      await AssignTask.findByIdAndUpdate(existing.assignTask, {
        assignTo: updateData.assignedTo,
      });
    }

    // If remarks is being updated, also update the assign task
    if (updateData.remarks && existing.assignTask) {
      await AssignTask.findByIdAndUpdate(existing.assignTask, {
        remarks: updateData.remarks,
      });
    }

    // If only receivedAmount comes, recalculate pending
    if (updateData.receivedAmount !== undefined) {
      const newReceived = updateData.receivedAmount;
      const paymentAmount = existing.paymentAmount;
      updateData.pendingAmount = paymentAmount - newReceived;
    }

    // If paymentAmount updated (rare case)
    if (
      updateData.paymentAmount !== undefined &&
      updateData.receivedAmount === undefined
    ) {
      updateData.pendingAmount =
        updateData.paymentAmount - existing.receivedAmount;
    }

    const updated = await PaymentFolder.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
      }
    )
      .populate("company")
      .populate({
        path: "party",
        select: "-__v",
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
      .populate("assignedTo", "firstName lastName email")
      .populate("assignTask") // Populate assign task
      .populate({
        path: "payments.receivedBy",
        select: "firstName lastName",
      })
      .sort({ createdAt: -1 });

    res.json({
      message: "Payment folder updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deletePaymentFolder = async (req, res) => {
  try {
    // First find the payment folder to get assignTask ID
    const paymentFolder = await PaymentFolder.findById(req.params.id);

    if (!paymentFolder) {
      return res.status(404).json({ message: "Payment folder not found" });
    }

    // Delete the associated assign task
    if (paymentFolder.assignTask) {
      await AssignTask.findByIdAndDelete(paymentFolder.assignTask);
    }

    // Delete the payment folder
    await PaymentFolder.findByIdAndDelete(req.params.id);

    res.json({ message: "Payment folder and associated task deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMultiplePaymentFolder = async (req, res) => {
  try {
    const { ids } = req.body;

    if (ids && Array.isArray(ids)) {
      if (ids.length === 0) {
        return res.status(400).json({ error: "No IDs provided for deletion" });
      }

      // First find all payment folders to get their assignTask IDs
      const paymentFolders = await PaymentFolder.find({
        _id: { $in: ids }
      });

      // Extract all assignTask IDs
      const assignTaskIds = paymentFolders
        .map(folder => folder.assignTask)
        .filter(taskId => taskId);

      // Delete all associated assign tasks
      if (assignTaskIds.length > 0) {
        await AssignTask.deleteMany({
          _id: { $in: assignTaskIds }
        });
      }

      // Delete all payment folders
      const result = await PaymentFolder.deleteMany({
        _id: { $in: ids }
      });

      res.json({
        message: `${result.deletedCount} payment folder(s) and associated tasks deleted successfully`,
        deletedCount: result.deletedCount
      });
    } else {
      res.status(400).json({ error: "No ID provided for deletion" });
    }
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.addPaymentToFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, note, paymentMethod, receivedBy } = req.body;

    // Validate required fields
    if (!amount || !receivedBy) {
      return res.status(400).json({
        message: "Amount and receivedBy are required fields",
      });
    }

    // Fetch existing payment folder
    const existingFolder = await PaymentFolder.findById(id);
    if (!existingFolder) {
      return res.status(404).json({ message: "Payment folder not found" });
    }

    // Validate amount doesn't exceed pending amount
    const currentPending = existingFolder.pendingAmount;
    if (amount > currentPending) {
      return res.status(400).json({
        message: `Payment amount (₹${amount}) cannot exceed pending amount (₹${currentPending})`,
      });
    }

    // Create new payment object
    const newPayment = {
      date: date || new Date(),
      amount: amount,
      note: note || "",
      paymentMethod: paymentMethod || "Cash",
      receivedBy: receivedBy,
    };

    // Add payment to payments array
    existingFolder.payments.push(newPayment);

    // Calculate new received amount from all payments
    const totalReceived = existingFolder.payments.reduce(
      (total, payment) => total + payment.amount,
      0
    );

    // Update received and pending amounts
    existingFolder.receivedAmount = totalReceived;
    existingFolder.pendingAmount = existingFolder.paymentAmount - totalReceived;

    // Save the updated document
    const updatedFolder = await existingFolder.save();

    // Populate and return the updated document
    const populatedFolder = await PaymentFolder.findById(updatedFolder._id)
      .populate("company")
      .populate({
        path: "party",
        select: "-__v",
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
      .populate("assignedTo", "firstName lastName email")
      .populate("assignTask") // Populate assign task
      .populate({
        path: "payments.receivedBy",
        select: "firstName lastName",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Payment added successfully",
      data: populatedFolder,
    });
  } catch (error) {
    console.error("Error adding payment:", error);
    res.status(500).json({
      message: "Server error while adding payment",
      error: error.message,
    });
  }
};