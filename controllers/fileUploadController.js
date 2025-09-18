const path = require("path");
const fs = require("fs");

// helper: uploads root and safe resolver
const uploadsRoot = path.join(__dirname, "../uploads");

function toPublicPaths(filePath, baseUrl) {
  const absolute = path.resolve(filePath);
  // relative path from uploads root, normalized to POSIX separators
  let rel = path.relative(uploadsRoot, absolute).split(path.sep).join("/");

  // If file somehow is outside uploads root, fallback to basename
  if (rel.startsWith("..")) {
    rel = path.basename(absolute);
  }

  return {
    storedPath: rel, // e.g. "folder/sub/file.jpg"
    path: `/uploads/${rel}`, // same format you used earlier (safe, normalized)
    url: `${baseUrl}/uploads/${rel}`,
  };
}

function resolveWithinUploads(...segments) {
  const resolved = path.resolve(uploadsRoot, ...segments);
  if (!resolved.startsWith(uploadsRoot)) {
    throw new Error("Invalid file path (outside uploads folder)");
  }
  return resolved;
}

// Upload single file
exports.uploadSingleFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const folderName = req.body.folder || ""; // may be empty or nested e.g. "invoices/2025"
    const baseUrl = process.env.BACK_URL || ""; // ensure you have BACK_URL set
    const uploadedAbsolutePath = req.file.path; // multer sets this when using diskStorage

    // verify saved file
    if (fs.existsSync(uploadedAbsolutePath)) {
      console.log(`✅ File verified at: ${uploadedAbsolutePath}`);
    } else {
      console.log(`❌ File not found at: ${uploadedAbsolutePath}`);
    }

    const publicPaths = toPublicPaths(uploadedAbsolutePath, baseUrl);

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        folder: folderName,
        // Real, dynamically resolved paths (relative to uploads + public URL)
        url: publicPaths.url,
        path: publicPaths.path,
        storedPath: publicPaths.storedPath,
      },
    });
  } catch (error) {
    console.error("❌ File upload error:", error);
    res.status(500).json({
      success: false,
      message: "File upload failed",
      error: error.message,
    });
  }
};

// Upload multiple files
exports.uploadMultipleFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    const folderName = req.body.folder || "";
    const baseUrl = process.env.BACK_URL || "";

    console.log(`📁 Folder specified: ${folderName}`);
    console.log(`📄 Files count: ${req.files.length}`);

    const uploadedFiles = req.files.map((file, index) => {
      const uploadedAbsolutePath = file.path;

      // Verify each file exists
      if (fs.existsSync(uploadedAbsolutePath)) {
        console.log(`✅ File ${index + 1} verified at: ${uploadedAbsolutePath}`);
      } else {
        console.log(`❌ File ${index + 1} not found at: ${uploadedAbsolutePath}`);
      }

      const publicPaths = toPublicPaths(uploadedAbsolutePath, baseUrl);

      return {
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        folder: folderName,
        url: publicPaths.url,
        path: publicPaths.path,
        storedPath: publicPaths.storedPath,
      };
    });

    // List all files in the folder for verification (optional)
    const folderPath = path.join(uploadsRoot, folderName);
    if (fs.existsSync(folderPath)) {
      const filesInFolder = fs.readdirSync(folderPath);
      console.log(`📂 Files in ${folderName} folder:`, filesInFolder);
    }

    res.status(200).json({
      success: true,
      message: `${req.files.length} files uploaded successfully to ${folderName} folder`,
      data: uploadedFiles,
    });
  } catch (error) {
    console.error("❌ Multiple file upload error:", error);
    res.status(500).json({
      success: false,
      message: "File upload failed",
      error: error.message,
    });
  }
};

// Delete file
exports.deleteFile = async (req, res) => {
  try {
    const { folder, filename } = req.params;

    // allow both nested folder paths and simple folder names
    const filePathResolved = resolveWithinUploads(...(folder ? [folder, filename] : [filename]));

    console.log(`🗑️ Attempting to delete file: ${filePathResolved}`);

    if (!fs.existsSync(filePathResolved)) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    fs.unlinkSync(filePathResolved);
    console.log(`✅ File deleted successfully: ${filePathResolved}`);

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("❌ File delete error:", error);
    res.status(500).json({
      success: false,
      message: "File deletion failed",
      error: error.message,
    });
  }
};

// Get file info
exports.getFileInfo = async (req, res) => {
  try {
    const { folder, filename } = req.params;
    const filePathResolved = resolveWithinUploads(...(folder ? [folder, filename] : [filename]));

    if (!fs.existsSync(filePathResolved)) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    const stats = fs.statSync(filePathResolved);
    const baseUrl = process.env.BACK_URL || "";

    const publicPaths = toPublicPaths(filePathResolved, baseUrl);

    res.status(200).json({
      success: true,
      data: {
        filename: path.basename(filePathResolved),
        folder: path.dirname(publicPaths.storedPath),
        size: stats.size,
        url: publicPaths.url,
        path: publicPaths.path,
        storedPath: publicPaths.storedPath,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
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

// List uploads (folders and files)
exports.listUploads = async (req, res) => {
  try {
    if (!fs.existsSync(uploadsRoot)) {
      return res.status(404).json({
        success: false,
        message: "Uploads directory not found",
      });
    }

    const baseUrl = process.env.BACK_URL || "";

    const folders = fs
      .readdirSync(uploadsRoot, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => {
        const folderPath = path.join(uploadsRoot, dirent.name);
        const files = fs.readdirSync(folderPath).map((f) => {
          const abs = path.join(folderPath, f);
          const publicPaths = toPublicPaths(abs, baseUrl);
          return {
            filename: f,
            path: publicPaths.path,
            url: publicPaths.url,
          };
        });
        return {
          folder: dirent.name,
          fileCount: files.length,
          files,
        };
      });

    res.status(200).json({
      success: true,
      data: {
        totalFolders: folders.length,
        folders: folders,
      },
    });
  } catch (error) {
    console.error("❌ List uploads error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list uploads",
      error: error.message,
    });
  }
};
