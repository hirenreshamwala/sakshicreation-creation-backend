const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure storage
const storage = multer.diskStorage({
  destination:async (req, file, cb) => {
    const folderName = req.body.folder || "general";
    console.log("🚀 ~ req.body:=>", req.body)
    console.log("🚀 ~ folderName:", folderName)
    const uploadPath = path.join(__dirname, "../uploads", folderName);

    console.log(`Requested folder: ${folderName}`);
    console.log(`Upload path: ${uploadPath}`);

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log(`✅ Created folder: ${uploadPath}`);
    } else {
      console.log(`📁 Folder already exists: ${uploadPath}`);
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    const filename = file.fieldname + "-" + uniqueSuffix + extension;
    console.log(`Generated filename: ${filename}`);
    cb(null, filename);
  },
});

// File filter function
const fileFilter = (req, file, cb) => {
  console.log(`Processing file: ${file.originalname}, Type: ${file.mimetype}`);
  // Allow all file types for now, you can add restrictions here
  cb(null, true);
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    // fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 10, // Maximum 10 files at once
  },
});

module.exports = upload;
