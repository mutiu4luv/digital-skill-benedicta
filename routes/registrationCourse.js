import express from "express";
import {
  getAllRegistrations,
  getCoursesWithStudents,
  getStudentsUnderCoach,
  registerCourse,
} from "../controller/registerCourse.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register-course", registerCourse);
router.get("/registered-courses", getAllRegistrations);

router.get(
  "/coach/students",
  protect,
  authorizeRoles("coach"),
  getStudentsUnderCoach
);
router.get(
  "/with-students",
  protect,
  authorizeRoles("owner"),
  getCoursesWithStudents
);

export default router;
