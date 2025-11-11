import express from "express";
import { getCoachesRatings, submitFeedback } from "../controller/feedback.js";

const router = express.Router();
router.post("/", submitFeedback);
router.get("/coaches-ratings", getCoachesRatings);

export default router;
