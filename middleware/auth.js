

const jwt = require("jsonwebtoken");
const Staff = require("../models/staff.model"); // adjust path

exports.authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  try {
    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret_key");

    // Check staff existence and token match
    const staff = await Staff.findById(decoded.id);
    if (!staff) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access: staff not found",
      });
    }

    // Check if deviceToken matches stored one
    if (decoded.requestType === "app" && staff.app_token !== decoded.deviceToken) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access: invalid app session",
      });
    }

    if (decoded.requestType === "web" && staff.web_token !== decoded.deviceToken) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access: invalid web session",
      });
    }

    // Attach user to request
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

exports.authorizeRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Access denied: insufficient permissions",
    });
  }
  next();
};
