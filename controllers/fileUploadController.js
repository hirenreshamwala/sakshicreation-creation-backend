const path = require("path")
const fs = require("fs")

// Upload single file
exports.uploadSingleFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      })
    }

    const folderName = req.body.folder 
    const baseUrl = process.env.BACK_URL
    const fileUrl = `${baseUrl}/uploads/${folderName}/${req.file.filename}`



    if (fs.existsSync(req.file.path)) {
      console.log(`✅ File verified at: ${req.file.path}`)
    } else {
      console.log(`❌ File not found at: ${req.file.path}`)
    }

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        folder: folderName,
        url: fileUrl,
        path: `/uploads/${folderName}/${req.file.filename}`,
      },
    })
  } catch (error) {
    console.error("❌ File upload error:", error)
    res.status(500).json({
      success: false,
      message: "File upload failed",
      error: error.message,
    })
  }
}

// Upload multiple files
exports.uploadMultipleFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      })
    }

    console.log("req.body.folder",req.body.folder);
    console.log("req.body",req.body);

    const folderName = req.body.folder 
    const baseUrl = process.env.BACK_URL

    console.log(`📁 Folder specified: ${folderName}`)
    console.log(`📄 Files count: ${req.files.length}`)

    const uploadedFiles = req.files.map((file, index) => {
      const fileUrl = `${baseUrl}/uploads/${folderName}/${file.filename}`
      console.log(`📄 File ${index + 1}: ${file.filename}`)
      console.log(`🔗 File URL: ${fileUrl}`)

      // Verify each file exists
      if (fs.existsSync(file.path)) {
        console.log(`✅ File ${index + 1} verified at: ${file.path}`)
      } else {
        console.log(`❌ File ${index + 1} not found at: ${file.path}`)
      }

      return {
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        folder: folderName,
        url: fileUrl,
        path: `/uploads/${folderName}/${file.filename}`,
      }
    })

    // List all files in the folder for verification
    const folderPath = path.join(__dirname, "../uploads", folderName)
    if (fs.existsSync(folderPath)) {
      const filesInFolder = fs.readdirSync(folderPath)
      console.log(`📂 Files in ${folderName} folder:`, filesInFolder)
    }

    res.status(200).json({
      success: true,
      message: `${req.files.length} files uploaded successfully to ${folderName} folder`,
      data: uploadedFiles,
    })
  } catch (error) {
    console.error("❌ Multiple file upload error:", error)
    res.status(500).json({
      success: false,
      message: "File upload failed",
      error: error.message,
    })
  }
}

// Delete file
exports.deleteFile = async (req, res) => {
  try {
    const { folder, filename } = req.params
    const filePath = path.join(__dirname, "../uploads", folder, filename)

    console.log(`🗑️ Attempting to delete file: ${filePath}`)

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      })
    }

    // Delete the file
    fs.unlinkSync(filePath)
    console.log(`✅ File deleted successfully: ${filePath}`)

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    })
  } catch (error) {
    console.error("❌ File delete error:", error)
    res.status(500).json({
      success: false,
      message: "File deletion failed",
      error: error.message,
    })
  }
}

// Get file info
exports.getFileInfo = async (req, res) => {
  try {
    const { folder, filename } = req.params
    const filePath = path.join(__dirname, "../uploads", folder, filename)

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      })
    }

    const stats = fs.statSync(filePath)
    const baseUrl = process.env.BACK_URL

    res.status(200).json({
      success: true,
      data: {
        filename: filename,
        folder: folder,
        size: stats.size,
        url: `${baseUrl}/uploads/${folder}/${filename}`,
        path: `/uploads/${folder}/${filename}`,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      },
    })
  } catch (error) {
    console.error("❌ Get file info error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get file info",
      error: error.message,
    })
  }
}

// Add a new function to list all folders and files
exports.listUploads = async (req, res) => {
  try {
    const uploadsPath = path.join(__dirname, "../uploads")

    if (!fs.existsSync(uploadsPath)) {
      return res.status(404).json({
        success: false,
        message: "Uploads directory not found",
      })
    }

    const folders = fs
      .readdirSync(uploadsPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => {
        const folderPath = path.join(uploadsPath, dirent.name)
        const files = fs.readdirSync(folderPath)
        return {
          folder: dirent.name,
          fileCount: files.length,
          files: files,
        }
      })

    res.status(200).json({
      success: true,
      data: {
        totalFolders: folders.length,
        folders: folders,
      },
    })
  } catch (error) {
    console.error("❌ List uploads error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to list uploads",
      error: error.message,
    })
  }
}
