import express from "express";
import {
  getChatUsers,
  getDirectMessages,
  sendDirectMessage,
} from "../controller/directChat.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/users", protect, getChatUsers);
router.get("/:otherUserId/messages", protect, getDirectMessages);
router.post("/:otherUserId/messages", protect, sendDirectMessage);

export default router;
