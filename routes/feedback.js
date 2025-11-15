import express from "express";
import {
  getCoachesRatings,
  getCoachMonthlyRatings,
  submitFeedback,
} from "../controller/feedback.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/", submitFeedback);
router.get("/coaches-ratings", getCoachesRatings);
router.get("/my-ratings", authorizeRoles("coach"), getCoachMonthlyRatings);

export default router;
