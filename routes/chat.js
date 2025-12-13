import express from "express";
import { sendCohortMessage, getCohortMessages } from "../controller/chat.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Send a message
router.post("/:cohortId/message", protect, sendCohortMessage);

// Get all messages
router.get("/:cohortId/messages", protect, getCohortMessages);

export default router;
