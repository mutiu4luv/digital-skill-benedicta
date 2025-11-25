import express from "express";
import multer from "multer";
import {
  uploadVideo,
  uploadDocument,
  getAllMaterials,
  getAssignedCoaches,
} from "../controller/coachUpload.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ in-memory storage
const upload = multer();

router.post(
  "/upload-video",
  protect,
  upload.single("file"),
  (req, res, next) => {
    console.log("🧩 Incoming /upload-video request");
    console.log("Headers:", req.headers["content-type"]);
    console.log("Body:", req.body);
    console.log("File field name:", req.file?.fieldname);
    console.log("File original name:", req.file?.originalname);
    console.log("File mimetype:", req.file?.mimetype);
    next();
  },
  uploadVideo
);

router.post(
  "/upload-document",
  protect,
  upload.single("file"),
  (req, res, next) => {
    console.log("🧩 Incoming /upload-document request");
    console.log("Headers:", req.headers["content-type"]);
    console.log("Body:", req.body);
    console.log("File field name:", req.file?.fieldname);
    console.log("File original name:", req.file?.originalname);
    console.log("File mimetype:", req.file?.mimetype);
    next();
  },
  uploadDocument
);

router.get(
  "/materials/:courseId",
  protect,
  authorizeRoles("student", "coach", "owner"),
  getAllMaterials
);
router.get("/coaches", protect, getAssignedCoaches);

export default router;
