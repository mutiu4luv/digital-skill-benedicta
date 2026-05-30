import express from "express";
import {
  getChatChannels,
  getGroupMessages,
  reactToGroupMessage,
  sendGroupMessage,
} from "../controller/groupChat.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/channels", protect, getChatChannels);
router.get("/:channel/messages", protect, getGroupMessages);
router.post("/:channel/messages", protect, sendGroupMessage);
router.patch("/:channel/messages/:messageId/reaction", protect, reactToGroupMessage);

export default router;
