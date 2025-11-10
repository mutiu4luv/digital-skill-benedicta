import express from "express";
import {
  getCoachPerformance,
  getEngagementAnalytics,
} from "../controller/analysis.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/engagement", protect, getEngagementAnalytics);
router.get("/coach", protect, getCoachPerformance);

export default router;
