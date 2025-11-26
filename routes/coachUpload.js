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

const upload = multer();

router.post("/upload-video", protect, upload.single("file"), uploadVideo);

router.post("/upload-document", protect, upload.single("file"), uploadDocument);

router.get(
  "/materials/:courseId",
  protect,
  authorizeRoles("student", "coach", "owner"),
  getAllMaterials
);

router.get("/coaches", protect, getAssignedCoaches);

export default router;
