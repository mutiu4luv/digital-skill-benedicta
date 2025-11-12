import express from "express";
import multer from "multer";
import {
  uploadVideo,
  uploadDocument,
  getAllMaterials,
} from "../controller/coachUpload.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Multer setup (temporarily store before Cloudinary upload)
const storage = multer.diskStorage({});
const upload = multer({ storage });

// ✅ Routes
router.post(
  "/upload-video",
  protect,
  authorizeRoles("coach", "owner"),
  upload.single("file"),
  uploadVideo
);

router.post(
  "/upload-document",
  protect,
  authorizeRoles("coach", "owner"),
  upload.single("file"),
  uploadDocument
);

// ✅ Students view all materials
router.get("/materials", getAllMaterials);

export default router;
