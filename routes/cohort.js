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
} from "../controller/cohort.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js"; // auth middleware

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
router.post(
  "/student/register-cohort/:cohortId",
  protect,
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

router.get("/assigned", protect, getCoachesAssignedToStudents);
router.get("/:id/courses", protect, getCohortCourses);
router.get(
  "/students/coach",
  protect,
  authorizeRoles("owner", "coach"),
  getStudentsUnderCoach
);

export default router;
