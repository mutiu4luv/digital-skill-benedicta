import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure the uploads directory exists
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMime = [
      "video/mp4",
      "video/mkv",
      "video/x-matroska",
      "video/avi",
      "video/x-msvideo",
      "video/quicktime",
      "video/mov",
    ];

    console.log("🎥 Uploaded MIME type:", file.mimetype);

    if (
      allowedMime.some((type) => file.mimetype.includes(type.split("/")[1]))
    ) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only video files are allowed."), false);
    }
  },
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
});

export default upload;
