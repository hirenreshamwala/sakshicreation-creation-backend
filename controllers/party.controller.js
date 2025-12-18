const Party = require("../models/Party.model");
const mongoose = require("mongoose");

// Get Party by ID
exports.getPartyById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Party ID format",
            });
        }

        const party = await Party.findById(id)
            .populate("address.marketName")
            // .populate("address.streetAddress")
            .populate("address.landMark")
            .populate("address.area")
            .populate("address.pincode")
            .populate("companyName")
            .lean();

        if (!party) {
            return res.status(404).json({
                success: false,
                message: "Party not found",
            });
        }

        res.status(200).json({
            success: true,
            data: party,
        });
    } catch (error) {
        console.error("Error fetching party by ID:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch party details",
            error: error.message,
        });
    }
};
