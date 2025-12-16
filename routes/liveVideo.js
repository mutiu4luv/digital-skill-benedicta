import express from "express";
import { getLiveSession, startLiveSession } from "../controller/liveVideo.js";

const router = express.Router();
router.post("/:cohortId/:courseId", startLiveSession);
router.get("/:cohortId/:courseId", getLiveSession);

export default router;
