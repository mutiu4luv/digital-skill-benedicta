import express from "express";
import {
  createCohortAssignment,
  getCoachAssignments,
  getStudentAssignments,
  submitAssignment,
  submitAssignmentGrade,
} from "../controller/assignment.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/multer.js";

const router = express.Router();

// POST: /api/cohort/assignment
router.post(
  "/",
  protect,
  authorizeRoles("coach"),
  upload.single("file"),
  createCohortAssignment
);

router.get("/student", protect, getStudentAssignments);
// submit assigment by student
router.post(
  "/:assignmentId/submit",
  protect,
  upload.single("file"),
  submitAssignment
);
router.get(
  "/coach-assignments",
  protect,
  // authorizeRoles("coach"),
  getCoachAssignments
);

router.put(
  "/grade/:assignmentId/:studentId",
  protect,
  authorizeRoles("coach"),
  submitAssignmentGrade
);

export default router;
