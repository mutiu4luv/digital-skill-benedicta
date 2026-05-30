import express from "express";
import {
  deleteGroupMessage,
  editGroupMessage,
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
router.patch("/:channel/messages/:messageId", protect, editGroupMessage);
router.delete("/:channel/messages/:messageId", protect, deleteGroupMessage);

export default router;
