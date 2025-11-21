import express from "express";

import { confirmPayment, getPaidStudents } from "../controller/payment.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/confirm", protect, confirmPayment);
router.get("/paid-students", protect, getPaidStudents);

export default router;
