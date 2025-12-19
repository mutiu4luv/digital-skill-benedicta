import express from "express";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";
import {
  addFreeCourseContent,
  createFreeCourse,
  deleteFreeCourse,
  getFreeCourseContentForStudent,
  getFreeCourses,
  getMyFreeCourses,
  registerFreeCourse,
} from "../controller/freeCourse.js";

const router = express.Router();

router.post(
  "/free-courses",
  protect,
  authorizeRoles("owner"),
  createFreeCourse
);
router.get("/free-courses", protect, getFreeCourses);

router.post("/free-courses/:courseId/register", protect, registerFreeCourse);

router.get("/free-courses/my", protect, getMyFreeCourses);

router.post("/free-courses/:courseId/content", protect, addFreeCourseContent);

router.get(
  "/free-courses/:courseId/contents",
  protect,
  getFreeCourseContentForStudent
);
router.delete("/free-courses/:courseId", protect, deleteFreeCourse);

export default router;
