import express from "express";

import {
  adminConfirmPayment,
  adminRejectPayment,
  checkAccess,
  confirmCoursePayment,
  getPaidStudents,
  getPendingConfirmationStudents,
} from "../controller/payment.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.get("/pending-confirmation", protect, getPendingConfirmationStudents);
// router.post("/confirm", protect, confirmPayment);
router.get("/paid-students", protect, getPaidStudents);
router.put("/users/:id/confirm-payment", protect, adminConfirmPayment);
router.put(
  "/users/:id/reject-payment",
  protect,
  authorizeRoles("owner"),
  adminRejectPayment
);
// ----------------------
// CONFIRM PAYMENT
// ----------------------
router.post("/confirm", protect, confirmCoursePayment);

// ----------------------
// CHECK ACCESS
// ----------------------
router.get("/access/:cohortId/:courseId/:studentId", protect, checkAccess);
export default router;
