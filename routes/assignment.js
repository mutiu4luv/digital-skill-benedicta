import express from "express";
import {
  createCohortAssignment,
  getStudentAssignments,
  submitAssignment,
} from "../controller/assignment.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/multer.js";

const router = express.Router();

// POST: /api/cohort/assignment
router.post("/", protect, authorizeRoles("coach"), createCohortAssignment);

router.get("/student", protect, getStudentAssignments);
// submit assigment by student
router.post(
  "/:assignmentId/submit",
  protect,
  upload.single("file"),
  submitAssignment
);

export default router;
