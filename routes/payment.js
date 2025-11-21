import express from "express";

import {
  adminConfirmPayment,
  confirmPayment,
  getPaidStudents,
  getPendingConfirmationStudents,
} from "../controller/payment.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.get("/pending-confirmation", protect, getPendingConfirmationStudents);
router.post("/confirm", protect, confirmPayment);
router.get("/paid-students", protect, getPaidStudents);
router.put("/users/:id/confirm-payment", protect, adminConfirmPayment);

export default router;
