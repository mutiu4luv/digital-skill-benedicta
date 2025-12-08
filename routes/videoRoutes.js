import express from "express";
import upload from "../middleware/multer.js";
import {
  uploadVideo,
  getVideos,
  deleteVideo,
} from "../controller/videoController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public
router.get("/", getVideos);

// Admin-only routes
router.post(
  "/upload",
  protect,
  authorizeRoles("owner"),
  upload.single("video"),
  uploadVideo
);
router.delete("/:id", protect, authorizeRoles("owner"), deleteVideo);

export default router;
