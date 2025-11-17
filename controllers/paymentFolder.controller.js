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
            pendingAmount
        }).populate("company")
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

        res.status(201).json({ message: "Payment Folder Created Successfully", data });

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
}

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
}

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

        if (!data) return res.status(404).json({ message: "Payment folder not found" });

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
        if (updateData.paymentAmount !== undefined && updateData.receivedAmount === undefined) {
            updateData.pendingAmount = updateData.paymentAmount - existing.receivedAmount;
        }

        const updated = await PaymentFolder.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
        }).populate("company")
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
            .sort({ createdAt: -1 });;

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
