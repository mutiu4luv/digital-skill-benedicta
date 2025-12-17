import express from "express";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";
import {
  addContent,
  confirmPayment,
  createSelfLearningCourse,
  getCourseContent,
  getPaidStudents,
  registerSelfLearning,
} from "../controller/selfLearning.js";

const router = express.Router();
router.post(
  "/course",
  protect,
  authorizeRoles("owner"),
  createSelfLearningCourse
);
router.post(
  "/course/:courseId/content",
  protect,
  authorizeRoles("coach"),
  addContent
);
router.post(
  "/course/:courseId/register",
  protect,
  authorizeRoles("student"),
  registerSelfLearning
);
router.use(
  "/payment/confirm",
  protect,
  authorizeRoles("owner"),
  confirmPayment
);

router.get("/course/:courseId/content", protect, getCourseContent);
router.get("/course/:courseId/students", protect, getPaidStudents);

export default router;
