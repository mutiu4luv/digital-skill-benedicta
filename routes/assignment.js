import express from "express";
import {
  createCohortAssignment,
  getStudentAssignments,
} from "../controller/assignment.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST: /api/cohort/assignment
router.post("/", protect, authorizeRoles("coach"), createCohortAssignment);

router.get("/student", protect, getStudentAssignments);

export default router;
