import express from "express";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";
import {
  addContent,
  createSelfLearningCourse,
  deleteSelfLearningContent,
  deleteSelfLearningCourse,
  getCourseContent,
  getCourseContentForStudent,
  getSelfLearningCourses,
  registerSelfLearning,
} from "../controller/selfLearning.js";
import {
  confirmPayment,
  getMyPaidSelfLearningCourses,
  getPaidStudents,
  getPendingPayments,
  uploadPaymentProof,
} from "../controller/selfLearningPayment.js";
import multer from "multer";
import { getFreeCourseContentForCoach } from "../controller/freeCourse.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
// create self learning course by owner
router.post(
  "/course",
  protect,
  upload.single("image"),
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
router.get(
  "/free-courses/:courseId/contents/coach",
  protect,
  getFreeCourseContentForCoach
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
  "/course/:courseId/contents",
  protect,
  authorizeRoles("student"),
  getCourseContentForStudent
);

router.get("/my-courses", protect, getMyPaidSelfLearningCourses);

// get course content uploadesd by coach
router.get("/course/:courseId/content", protect, getCourseContent);
router.get("/course/:courseId/students", protect, getPaidStudents);
router.delete(
  "/content/:contentId",
  protect,
  authorizeRoles("owner", "coach"),
  deleteSelfLearningContent
);

export default router;
