import express from "express";
import {
  createCohort,
  deleteCohort,
  endCohortByCourse,
  getAllCohorts,
  startCohortByCourse,
} from "../controller/cohort.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js"; // auth middleware

const router = express.Router();
router.post("/", protect, authorizeRoles("owner"), createCohort);
router.get("/", protect, authorizeRoles("owner", "coach"), getAllCohorts);
router.delete("/:cohortId", protect, authorizeRoles("owner"), deleteCohort);

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

export default router;
