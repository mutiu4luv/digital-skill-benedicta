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
} from "../controller/cohort.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js"; // auth middleware

const router = express.Router();
router.post("/", protect, authorizeRoles("owner"), createCohort);
router.get("/", protect, authorizeRoles("owner", "coach"), getAllCohorts);
router.delete("/:cohortId", protect, authorizeRoles("owner"), deleteCohort);
router.get("/cohort/active", protect, getNotActiveCohort);

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

export default router;
