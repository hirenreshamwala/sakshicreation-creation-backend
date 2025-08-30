const path = require("path");
const fs = require("fs");

// Download file
// exports.downloadFile = async (req, res) => {
//   try {
//     const { filePath } = req.query;
//     let filePathData = process.env.BACK_URL + filePath;
//     console.log("🚀 ~ filePathData:", filePathData);

//     const { view } = req.query;

//     // 2. Validate input
//     if (!filePath) {
//       console.error("❌ No file path provided");
//       return res.status(400).json({
//         success: false,
//         message: "File path is required",
//       });
//     }

//     // 3. Decode and sanitize file path
//     const decodedFilePath = decodeURIComponent(filePath);
//     console.log("Decoded file path:", decodedFilePath);

//     // Remove any leading/trailing slashes and normalize path
//     const cleanPath = decodedFilePath.replace(/^\/+|\/+$/g, "");
//     const fullFilePath = path.join(__dirname, cleanPath);
//     console.log("Full file path:", fullFilePath);

//     // 5. Check if file exists
//     if (!fs.existsSync("../uploads/general/file-1754027087126-901847221.jpg")) {
//       console.error("❌ File not found:", fullFilePath);
//       return res.status(404).json({
//         success: false,
//         message: "File not found",
//       });
//     }

//     // 6. Get file stats
//     const stats = fs.statSync(fullFilePath);
//     if (!stats.isFile()) {
//       console.error("❌ Path is not a file:", fullFilePath);
//       return res.status(400).json({
//         success: false,
//         message: "Path is not a file",
//       });
//     }

//     const fileName = path.basename(fullFilePath);
//     const fileExtension = path.extname(fileName).toLowerCase();
//     console.log("File details:", {
//       name: fileName,
//       size: stats.size,
//       extension: fileExtension,
//     });

//     // 7. Set content type
//     const contentTypeMap = {
//       ".pdf": "application/pdf",
//       ".jpg": "image/jpeg",
//       ".jpeg": "image/jpeg",
//       ".png": "image/png",
//       ".gif": "image/gif",
//       ".doc": "application/msword",
//       ".docx":
//         "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//       ".xls": "application/vnd.ms-excel",
//       ".xlsx":
//         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//       ".txt": "text/plain",
//     };

//     const contentType =
//       contentTypeMap[fileExtension] || "application/octet-stream";
//     console.log("Content-Type:", contentType);

//     // 8. Set response headers
//     res.setHeader("Content-Type", contentType);
//     res.setHeader("Content-Length", stats.size);
//     res.setHeader(
//       "Content-Disposition",
//       `${view === "true" ? "inline" : "attachment"}; filename="${fileName}"`
//     );

//     console.log(`Serving file for ${view === "true" ? "viewing" : "download"}`);

//     // 9. Stream the file
//     const fileStream = fs.createReadStream(fullFilePath);

//     fileStream.on("error", (error) => {
//       console.error("❌ File stream error:", error);
//       if (!res.headersSent) {
//         res.status(500).json({
//           success: false,
//           message: "Error reading file",
//           error: error.message,
//         });
//       }
//     });

//     fileStream.on("end", () => {
//       console.log("✅ File served successfully:", fileName);
//     });

//     // 10. Pipe the file to response
//     fileStream.pipe(res);
//   } catch (error) {
//     console.error("❌ Download error:", error);
//     if (!res.headersSent) {
//       res.status(500).json({
//         success: false,
//         message: "File download failed",
//         error: error.message,
//       });
//     }
//   }
// };

// const fs = require("fs");
// const path = require("path");

exports.downloadFile = async (req, res) => {
  try {
    const { filePath, view } = req.query;

    // 1. Validate input
    if (!filePath) {
      console.error("❌ No file path provided");
      return res.status(400).json({
        success: false,
        message: "File path is required",
      });
    }

    // 2. Decode and sanitize file path
    const decodedFilePath = decodeURIComponent(filePath);
    console.log("Decoded file path:", decodedFilePath);

    // 3. Construct absolute file path (Assuming your upload folder is in project root)
    const fullFilePath = path.join(__dirname, "../", decodedFilePath);
    console.log("✅ Full file path:", fullFilePath);

    // 4. Check if file exists
    if (!fs.existsSync(fullFilePath)) {
      console.error("❌ File not found:", fullFilePath);
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // 5. Get file stats
    const stats = fs.statSync(fullFilePath);
    if (!stats.isFile()) {
      console.error("❌ Path is not a file:", fullFilePath);
      return res.status(400).json({
        success: false,
        message: "Path is not a file",
      });
    }

    const fileName = path.basename(fullFilePath);
    const fileExtension = path.extname(fileName).toLowerCase();
    console.log("📄 File details:", { fileName, size: stats.size });

    // 6. Determine content type
    const contentTypeMap = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".txt": "text/plain",
    };

    const contentType =
      contentTypeMap[fileExtension] || "application/octet-stream";

    // 7. Set headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stats.size);
    res.setHeader(
      "Content-Disposition",
      `${view === "true" ? "inline" : "attachment"}; filename="${fileName}"`
    );

    // 8. Stream the file
    const fileStream = fs.createReadStream(fullFilePath);
    fileStream.pipe(res);

    fileStream.on("error", (error) => {
      console.error("❌ File stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error reading file",
          error: error.message,
        });
      }
    });

    fileStream.on("end", () => {
      console.log("✅ File served successfully:", fileName);
    });
  } catch (error) {
    console.error("❌ Download error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "File download failed",
        error: error.message,
      });
    }
  }
};

// Get file info
exports.getFileInfo = async (req, res) => {
  try {
    const { filePath } = req.params;
    const decodedFilePath = decodeURIComponent(filePath);
    const fullFilePath = path.join(__dirname, "../uploads", decodedFilePath);

    if (!fs.existsSync(fullFilePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    const stats = fs.statSync(fullFilePath);
    const fileName = path.basename(fullFilePath);
    const fileExtension = path.extname(fileName).toLowerCase();

    res.status(200).json({
      success: true,
      data: {
        fileName: fileName,
        filePath: decodedFilePath,
        size: stats.size,
        extension: fileExtension,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
      },
    });
  } catch (error) {
    console.error("❌ Get file info error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get file info",
      error: error.message,
    });
  }
};

// List files in directory
exports.listFiles = async (req, res) => {
  try {
    const { directory } = req.params || { directory: "" };
    const targetDir = path.join(__dirname, "../uploads", directory);

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({
        success: false,
        message: "Directory not found",
      });
    }

    const files = fs.readdirSync(targetDir, { withFileTypes: true });
    const fileList = files.map((file) => {
      const filePath = path.join(targetDir, file.name);
      const stats = fs.statSync(filePath);

      return {
        name: file.name,
        path: path.join(directory, file.name),
        isFile: file.isFile(),
        isDirectory: file.isDirectory(),
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        directory: directory,
        files: fileList,
        totalFiles: fileList.filter((f) => f.isFile).length,
        totalDirectories: fileList.filter((f) => f.isDirectory).length,
      },
    });
  } catch (error) {
    console.error("❌ List files error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list files",
      error: error.message,
    });
  }
};
