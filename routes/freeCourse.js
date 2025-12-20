import express from "express";
import multer from "multer";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  createFreeCourse,
  getFreeCourses,
  registerFreeCourse,
  getMyFreeCourses,
  addFreeCourseContent,
  getFreeCourseContentForStudent,
  getFreeCourseContentForCoach,
  deleteFreeCourse,
  getMyFreeCoursesForCoach,
} from "../controller/freeCourse.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/free-courses", protect, createFreeCourse);
router.get("/free-courses", protect, getFreeCourses);

// upload content (coach only)
router.post(
  "/free-courses/:courseId/content",
  protect,
  authorizeRoles("coach"),
  upload.single("file"),
  addFreeCourseContent
);

// 👇 STUDENT (requires enrollment)
router.get(
  "/free-courses/:courseId/contents",
  protect,
  authorizeRoles("student"),
  getFreeCourseContentForStudent
);

// 👇 COACH
router.get(
  "/free-courses/:courseId/contents/coach",
  protect,
  authorizeRoles("coach"),
  getFreeCourseContentForCoach
);
// get My FreeCourses For each Coach
router.get(
  "/free-courses/coach/my",
  protect,
  authorizeRoles("coach"),
  getMyFreeCoursesForCoach
);

router.post(
  "/free-courses/:courseId/register",
  protect,
  authorizeRoles("student"),
  registerFreeCourse
);

router.get("/free-courses/my", protect, getMyFreeCourses);

router.delete(
  "/free-courses/:courseId",
  protect,
  authorizeRoles("coach", "owner"),
  deleteFreeCourse
);

export default router;
