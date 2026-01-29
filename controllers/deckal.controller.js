const Deckal = require('../models/deckal.model');

// Get all deckals
exports.getDeckals = async (req, res) => {
    try {
        const deckals = await Deckal.find().sort({ createdAt: -1 }).lean();
        res.status(200).json({
            success: true,
            count: deckals.length,
            data: deckals,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching deckals: ' + error.message,
        });
    }
};

// Create a new deckal
exports.createDeckal = async (req, res) => {
    try {
        const { name } = req.body;

        // Validate required fields
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided',
            });
        }

        // Create new deckal
        const newDeckal = new Deckal({
            name
        });

        const savedDeckal = await newDeckal.save();

        res.status(201).json({
            success: true,
            data: savedDeckal,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating deckal: ' + error.message,
        });
    }
};

// Update deckal by ID
exports.updateDeckal = async (req, res) => {
    try {
        const { name } = req.body;

        const updatedDeckal = await Deckal.findByIdAndUpdate(
            req.params.id,
            {
                name
            },
            { new: true }
        );

        if (!updatedDeckal) {
            return res.status(404).json({
                success: false,
                message: 'Deckal not found',
            });
        }

        res.status(200).json({
            success: true,
            data: updatedDeckal,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating deckal: ' + error.message,
        });
    }
};

// Delete deckal by ID
exports.deleteDeckal = async (req, res) => {
    try {
        const deletedDeckal = await Deckal.findByIdAndDelete(req.params.id);

        if (!deletedDeckal) {
            return res.status(404).json({
                success: false,
                message: 'Deckal not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Deckal deleted successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting deckal: ' + error.message,
        });
    }
};