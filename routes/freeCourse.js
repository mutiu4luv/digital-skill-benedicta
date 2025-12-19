import express from "express";
import { protect } from "../middleware/authMiddleware";
import {
  addFreeCourseContent,
  createFreeCourse,
  getFreeCourseContentForStudent,
  getFreeCourses,
  getMyFreeCourses,
  registerFreeCourse,
} from "../controller/freeCourse";

const router = express.Router();

router.post("/free-courses", protect, createFreeCourse);
router.get("/free-courses", protect, getFreeCourses);

router.post("/free-courses/:courseId/register", protect, registerFreeCourse);

router.get("/free-courses/my", protect, getMyFreeCourses);

router.post("/free-courses/:courseId/content", protect, addFreeCourseContent);

router.get(
  "/free-courses/:courseId/contents",
  prompt,
  getFreeCourseContentForStudent
);

export default router;
