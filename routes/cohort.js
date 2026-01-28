import express from "express";
import {
  createCohort,
  deleteCohort,
  endCohortByCourse,
  getNotActiveCohort,
  getAllCohorts,
  startCohortByCourse,
  registerStudentToCohort,
  getActiveCohorts,
  getAvailableCohorts,
  getCoachesAssignedToStudents,
  getCohortCourses,
  getCoachAssignedCohorts,
  getStudentsUnderCoach,
  getUpcomingClass,
  undoStartCohortCourse,
  undoEndCohortCourse,
  getStudentsTaughtByCoach,
} from "../controller/cohort.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js"; // auth middleware
import upload from "../middleware/multer.js";
const router = express.Router();
router.post("/", protect, authorizeRoles("owner"), createCohort);
router.get("/", protect, authorizeRoles("owner", "coach"), getAllCohorts);
router.delete("/:cohortId", protect, authorizeRoles("owner"), deleteCohort);
router.get("/active", getNotActiveCohort);

router.put(
  "/start/course/:cohortCourseId",
  protect,
  authorizeRoles("owner", "coach"),
  startCohortByCourse
);

router.put(
  "/end/course/:cohortCourseId",
  protect,
  authorizeRoles("owner", "coach"),
  endCohortByCourse
);
// router.post(
//   "/student/register-cohort/:cohortId",
//   protect,
//   registerStudentToCohort
// );
router.post(
  "/student/register-cohort/:cohortId",
  protect,
  upload.single("proof"),
  registerStudentToCohort
);
router.get("/active-cohorts", protect, getActiveCohorts);
router.get("/available", protect, getAvailableCohorts);
router.get(
  "/coach/assigned",
  protect,
  authorizeRoles("coach", "owner"),
  getCoachAssignedCohorts
);
router.get("/student/upcoming-class", protect, getUpcomingClass);
router.get("/assigned", protect, getCoachesAssignedToStudents);
router.get("/:id/courses", protect, getCohortCourses);
router.get(
  "/students/coach",
  protect,
  authorizeRoles("owner", "coach"),
  getStudentsUnderCoach
);

// 🔹 UNDO start
router.patch(
  "/course/:cohortCourseId/undo-start",
  protect,
  authorizeRoles("owner"),
  undoStartCohortCourse
);

// 🔹 UNDO end
router.patch(
  "/course/:cohortCourseId/undo-end",
  protect,
  authorizeRoles("owner"),
  undoEndCohortCourse
);
router.get("/students/coach", protect, getStudentsTaughtByCoach);

export default router;
