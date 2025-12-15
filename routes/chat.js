import express from "express";
import { sendCohortMessage, getCohortMessages } from "../controller/chat.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Send a message
router.post("/:cohortId/:courseId/message", protect, sendCohortMessage);
router.get("/:cohortId/:courseId/message", protect, getCohortMessages);

export default router;
