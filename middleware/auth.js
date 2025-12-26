// const jwt = require("jsonwebtoken");
// const Staff = require("../models/staff.model"); // adjust path

// exports.authenticateToken = async (req, res, next) => {
//   // ✅ Skip token validation if running in production
//   if (process.env.NODE_ENV === "production") {
//     return next();
//   }

//   const authHeader = req.headers["authorization"];
//   const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

//   if (!token) {
//     return res.status(401).json({
//       success: false,
//       message: "Access token required",
//     });
//   }

//   try {
//     // Verify JWT
//     const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret_key");

//     // Check staff existence
//     const staff = await Staff.findById(decoded.id);
//     if (!staff) {
//       return res.status(403).json({
//         success: false,
//         message: "Unauthorized access: staff not found",
//       });
//     }

//     // ✅ Only enforce single login check if not in local mode
//     if (process.env.NODE_ENV !== "local") {
//       if (decoded.requestType === "app" && staff.app_token !== decoded.deviceToken) {
//         return res.status(403).json({
//           success: false,
//           message: "Unauthorized access: invalid app session",
//         });
//       }

//       if (decoded.requestType === "web" && staff.web_token !== decoded.deviceToken) {
//         return res.status(403).json({
//           success: false,
//           message: "Unauthorized access: invalid web session",
//         });
//       }
//     }

//     // Attach user to request
//     req.user = decoded;
//     next();
//   } catch (error) {
//     return res.status(403).json({
//       success: false,
//       message: "Invalid or expired token",
//     });
//   }
// };
const jwt = require("jsonwebtoken");
const Staff = require("../models/staff.model"); // adjust path

exports.authenticateToken = async (req, res, next) => {
  // ✅ Skip token validation if running in production
  // if (process.env.NODE_ENV === "production") {
  //   return next();
  // }

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
  console.log("token----", token);
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  try {
    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret_key");
    console.log("decoded----", decoded);
    
    // Check staff existence
    const staff = await Staff.findById(decoded.id);
    console.log("staff----", staff);
    
    if (!staff) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access: staff not found",
      });
    }

    // ❌ Removed app/web token single-login check

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
