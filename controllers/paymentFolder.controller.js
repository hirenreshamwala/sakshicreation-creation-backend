const mongoose = require("mongoose");
const PaymentFolder = require("../models/paymentFolder.model");

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
      .populate("assignedTo", "firstName lastName email")
      .sort({ createdAt: -1 });

    const newAssignTask = new AssignTask({
      companyName:company,
      partyName:party,
      date: new Date(assignedDate),
      time: assignedDate,
      reasonForVisit:"payment",
      remarks: req.body.remarks || "",
      assignTo:assignedTo,
      status:  "Pending",
      visitDate: req.body.visitDate ? new Date(req.body.visitDate) : null,
      visitTime: req.body.visitTime || "",
      feedback: req.body.feedback || "",
      isRescheduledTask: req.body.isRescheduledTask || false,
      originalTaskId: req.body.originalTaskId || null,
    });

    await newAssignTask.save();

    // Fetch AccountMaster using raw ObjectIds before population

    res
      .status(201)
      .json({ message: "Payment Folder Created Successfully", newData });
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
      .populate("assignedTo", "firstName lastName email")
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
      .populate("assignedTo", "firstName lastName email");

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
      .populate("assignedTo", "firstName lastName email")
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
    console.log("delete data");
    const data = await PaymentFolder.findByIdAndDelete(req.params.id);
    res.json({ message: "Payment folder deleted successfully" });
  } catch (error) {
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
      .populate("payments.receivedBy", "firstName lastName")
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
