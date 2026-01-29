const Gsm = require('../models/gsm.model');

// Get all plies
exports.getGsm = async (req, res) => {
    try {
        const plies = await Gsm.find().sort({ createdAt: -1 }).lean();
        res.status(200).json({
            success: true,
            count: plies.length,
            data: plies,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching plies: ' + error.message,
        });
    }
};

// Create a new ply
exports.createGsm = async (req, res) => {
    try {
        const { name } = req.body;

        // Validate required fields
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided',
            });
        }

        // Create new ply
        const newGsm = new Gsm({
            name
        });

        const savedGsm = await newGsm.save();

        res.status(201).json({
            success: true,
            data: savedGsm,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating gsm: ' + error.message,
        });
    }
};

// Update ply by ID
exports.updateGsm = async (req, res) => {
    try {
        const { name } = req.body;

        const updatedGsm = await Gsm.findByIdAndUpdate(
            req.params.id,
            {
                name
            },
            { new: true }
        );

        if (!updatedGsm) {
            return res.status(404).json({
                success: false,
                message: 'Gsm not found',
            });
        }

        res.status(200).json({
            success: true,
            data: updatedGsm,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating gsm: ' + error.message,
        });
    }
};

// Delete ply by ID
exports.deleteGsm = async (req, res) => {
    try {
        const deletedGsm = await Gsm.findByIdAndDelete(req.params.id);

        if (!deletedGsm) {
            return res.status(404).json({
                success: false,
                message: 'Gsm not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Gsm deleted successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting gsm: ' + error.message,
        });
    }
};