import express from "express";
import { startCohort, endCohort, createCohort } from "../controller/cohort.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js"; // auth middleware

const router = express.Router();
router.post("/", protect, authorizeRoles("owner"), createCohort);

// Start cohort
router.put(
  "/start/:cohortId",
  protect,
  authorizeRoles("owner", "coach"),
  startCohort
);

// End cohort
router.put(
  "/end/:cohortId",
  protect,
  authorizeRoles("owner", "coach"),
  endCohort
);

export default router;
