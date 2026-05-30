import express from "express";
import {
  endLiveSession,
  getLiveSession,
  startLiveSession,
} from "../controller/liveVideo.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/:cohortId/:courseId", protect, startLiveSession);
router.get("/:cohortId/:courseId", protect, getLiveSession);
router.patch("/:cohortId/:courseId/end", protect, endLiveSession);

export default router;
