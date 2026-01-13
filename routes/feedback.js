import express from "express";
import {
  getCoachesRatings,
  getCoachFeedbackComments,
  getCoachMonthlyRatings,
  submitFeedback,
} from "../controller/feedback.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/", submitFeedback);
router.get("/coaches-ratings", getCoachesRatings);
router.get(
  "/coach/:coachId/comments",
  protect,
  authorizeRoles("owner"),
  getCoachFeedbackComments
);
router.get(
  "/my-ratings",
  protect,
  authorizeRoles("coach"),
  getCoachMonthlyRatings
);

export default router;
