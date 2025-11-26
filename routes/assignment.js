import express from "express";
import {
  createCohortAssignment,
  getStudentAssignments,
} from "../controller/assignment.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST: /api/cohort/assignment
router.post("/", protect, createCohortAssignment);

router.get("/student/:cohortId", protect, getStudentAssignments);

export default router;
