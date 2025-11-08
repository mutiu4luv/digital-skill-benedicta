import express from "express";
import {
  getCoachPerformance,
  getEngagementAnalytics,
} from "../controller/analysis.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/engagement", protect, getEngagementAnalytics);
router.get("/coach-performance", protect, getCoachPerformance);

export default router;
