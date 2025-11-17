import express from "express";
import {
  createCohort,
  endCohortByCourse,
  getAllCohorts,
  startCohortByCourse,
} from "../controller/cohort.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js"; // auth middleware

const router = express.Router();
router.post("/", protect, authorizeRoles("owner"), createCohort);
router.get("/", protect, authorizeRoles("owner", "coach"), getAllCohorts);

router.put(
  "/start/course/:courseId",
  protect,
  authorizeRoles("owner", "coach"),
  startCohortByCourse
);

router.put(
  "/end/course/:courseId",
  protect,
  authorizeRoles("owner", "coach"),
  endCohortByCourse
);

export default router;
