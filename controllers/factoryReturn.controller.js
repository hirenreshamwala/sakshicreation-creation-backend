const mongoose = require("mongoose");
const QpData = require("../models/qpOrder.model");
const Staff = require("../models/staff.model");
const FactoryReturn = require("../models/factoryReturn.model");

exports.backToFactory = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { driverId, factoryPhotos } = req.body;
        const currentTime = new Date();

        const staff = await Staff.findById(driverId).session(session);
        if (!staff) throw new Error("Driver not found");

        if (!staff.orders || staff.orders.length === 0) {
            throw new Error("No active orders found for this driver");
        }

        // 1. Store Back to Factory record
        const factoryReturn = await FactoryReturn.create([{
            driver: driverId,
            orders: staff.orders,
            factoryPhotos,
            factoryArrivalTime: currentTime,
        }], { session });

        // 2. Mark driver isDisptach = false
        await Staff.findByIdAndUpdate(driverId, { isDisptach: false, orders: [] }, { session });
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            message: "Driver back to factory recorded successfully",
            data: factoryReturn[0],
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error(err);
        res.status(500).json({ success: false, message: err.message || "Failed to record factory return" });
    }
};
