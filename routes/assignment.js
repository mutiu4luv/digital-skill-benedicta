import express from "express";
import {
  createCohortAssignment,
  getCoachAssignments,
  getStudentAssignments,
  submitAssignment,
  submitAssignmentGrade,
  updateAssignment,
} from "../controller/assignment.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";
import upload, { multerErrorHandler } from "../middleware/multer.js";

const router = express.Router();

// POST: /api/cohort/assignment
router.post(
  "/",
  protect,
  authorizeRoles("coach"),
  upload.single("file"),
  multerErrorHandler,
  createCohortAssignment
);

router.get("/student", protect, getStudentAssignments);
// submit assigment by student
router.post(
  "/:assignmentId/submit",
  protect,
  upload.fields([
    { name: "files", maxCount: 10 },
    { name: "file", maxCount: 1 },
  ]),
  multerErrorHandler,
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
router.patch(
  "/:assignmentId",
  protect,
  authorizeRoles("coach"),
  updateAssignment
);
export default router;
