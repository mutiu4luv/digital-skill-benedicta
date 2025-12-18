import express from "express";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";
import {
  addContent,
  createSelfLearningCourse,
  deleteSelfLearningContent,
  deleteSelfLearningCourse,
  getCoachCourseContent,
  getCourseContentForStudent,
  getSelfLearningCourses,
  registerSelfLearning,
} from "../controller/selfLearning.js";
import {
  confirmPayment,
  getPaidStudents,
  getPendingPayments,
  uploadPaymentProof,
} from "../controller/selfLearningPayment.js";
import multer from "multer";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post(
  "/course",
  protect,
  authorizeRoles("owner"),
  createSelfLearningCourse
);

router.get("/courses", protect, getSelfLearningCourses);
router.post(
  "/course/:courseId/content",
  protect,
  authorizeRoles("coach"),
  upload.single("file"),
  addContent
);
router.post(
  "/course/:courseId/register",
  protect,
  authorizeRoles("student"),
  registerSelfLearning
);
router.post(
  "/payment/confirm",
  protect,
  authorizeRoles("owner"),
  confirmPayment
);

router.post(
  "/payment/proof",
  protect,
  authorizeRoles("student"),
  upload.single("proof"),
  uploadPaymentProof
);
router.delete(
  "/course/:courseId",
  protect,
  authorizeRoles("owner"),
  deleteSelfLearningCourse
);
router.get("/payments", protect, authorizeRoles("owner"), getPendingPayments);

router.get(
  "/course/:courseId/content",
  protect,
  authorizeRoles("student"),
  getCourseContentForStudent
);

router.get(
  "/course/:courseId/content",
  protect,
  authorizeRoles("coach"),
  getCoachCourseContent
);
router.get("/course/:courseId/students", protect, getPaidStudents);
router.delete(
  "/content/:contentId",
  protect,
  authorizeRoles("coach"),
  deleteSelfLearningContent
);
export default router;
