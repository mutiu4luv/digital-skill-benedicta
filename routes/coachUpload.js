import express from "express";
import multer from "multer";
import {
  uploadVideo,
  uploadDocument,
  getAllMaterials,
  getAssignedCoaches,
  getMyVideos,
  deleteVideo,
  getStudentCourseMaterials,
  getStudentDocuments,
  getCoachDocuments,
  deleteDocument,
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
// Coach fetches own videos
router.get(
  "/my-videos",
  protect,
  authorizeRoles("coach", "owner"),
  getMyVideos
);

router.get(
  "/my-documents",
  protect,
  authorizeRoles("coach"),
  getCoachDocuments
);

router.get("/coaches", protect, getAssignedCoaches);
router.delete("/delete-video/:id", protect, deleteVideo);
router.delete("/document/:documentId", protect, deleteDocument);

router.get("/video", protect, getStudentCourseMaterials);
router.get("/doc", protect, getStudentDocuments);

export default router;
