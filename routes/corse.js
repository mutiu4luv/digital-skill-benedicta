import express from "express";
import {
  assignCoach,
  createCourse,
  getAllCourses,
  setClassSchedule,
  getMyCourses,
  deleteCourse,
  getCoachCourses,
  getMyCoursesForCoach,
} from "../controller/corse.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/multer.js";
import { verifyPayment } from "../middleware/verifyPayment.js";

const router = express.Router();

// Coach controlling his class
router.put(
  "/:courseId/set-schedule",
  protect,
  authorizeRoles("coach"),
  setClassSchedule
);

// Owner creates a course
// router.post(
//   "/",
//   protect,
//   upload.single("image"), // field name in frontend form
//   authorizeRoles("owner"),
//   createCourse
// );
router.post(
  "/",
  protect,
  authorizeRoles("owner"),
  upload.single("image"),
  createCourse
);

// Everyone can see all courses
router.get("/", getAllCourses);

// Student sees only courses he registered
router.get(
  "/my-courses",
  protect,
  authorizeRoles("student", "coach", "owner"),
  verifyPayment, // Ensure payment is done

  getMyCourses
);
// get my courses for coach and student
router.get(
  "/my-courses-for-coach",
  protect,
  authorizeRoles("student", "coach", "owner"),
  getMyCoursesForCoach
);

router.delete("/:courseId", protect, authorizeRoles("owner"), deleteCourse);
router.get("/coach-courses", protect, getCoachCourses);

// Owner assigns coach
router.put("/assign-coach", protect, authorizeRoles("owner"), assignCoach);

export default router;
