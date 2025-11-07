import express from "express";
import { getAnalytics } from "../controller/barChartAnalysis.js";

const router = express.Router();

// Analytics endpoint
router.get("/", getAnalytics);

export default router;
