import mongoose from "mongoose";
import DirectMessage from "../module/directMessage.js";
import User from "../module/userModule.js";

const canMessageRole = (currentRole, targetRole) => {
  if (currentRole === "student") return targetRole === "student";
  if (currentRole === "coach")
    return targetRole === "coach" || targetRole === "student";
  if (currentRole === "owner" || currentRole === "admin")
    return targetRole === "coach" || targetRole === "student";
  return false;
};

const buildAudienceRoleFilter = (currentRole, audience) => {
  if (currentRole === "student") return { role: "student" };

  if (currentRole === "coach") {
    if (audience === "coaches") return { role: "coach" };
    return { role: "student" };
  }

  if (currentRole === "owner" || currentRole === "admin") {
    if (audience === "coaches") return { role: "coach" };
    return { role: "student" };
  }

  return { role: "student" };
};

export const getChatUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const currentRole = req.user.role;
    const audience = (req.query.audience || "students").toString().toLowerCase();

    const roleFilter = buildAudienceRoleFilter(currentRole, audience);

    const users = await User.find({
      _id: { $ne: currentUserId },
      ...roleFilter,
    }).select("fullName email role profilePhoto");

    return res.status(200).json({ users });
  } catch (error) {
    console.error("❌ getChatUsers error:", error);
    return res.status(500).json({ message: "Failed to load chat users" });
  }
};

export const getDirectMessages = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const currentRole = req.user.role;
    const { otherUserId } = req.params;

    if (!mongoose.isValidObjectId(otherUserId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const otherUser = await User.findById(otherUserId).select("role");
    if (!otherUser) return res.status(404).json({ message: "User not found" });

    if (!canMessageRole(currentRole, otherUser.role)) {
      return res.status(403).json({ message: "You cannot chat with this user" });
    }

    const messages = await DirectMessage.find({
      $or: [
        { senderId: currentUserId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: currentUserId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("senderId", "fullName role profilePhoto")
      .populate("recipientId", "fullName role profilePhoto");

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("❌ getDirectMessages error:", error);
    return res.status(500).json({ message: "Failed to load messages" });
  }
};

export const sendDirectMessage = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const currentRole = req.user.role;
    const { otherUserId } = req.params;
    const { text } = req.body;

    if (!mongoose.isValidObjectId(otherUserId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const otherUser = await User.findById(otherUserId).select("role");
    if (!otherUser) return res.status(404).json({ message: "User not found" });

    if (!canMessageRole(currentRole, otherUser.role)) {
      return res.status(403).json({ message: "You cannot chat with this user" });
    }

    const message = await DirectMessage.create({
      senderId: currentUserId,
      recipientId: otherUserId,
      text: text.trim(),
    });

    const populated = await DirectMessage.findById(message._id)
      .populate("senderId", "fullName role profilePhoto")
      .populate("recipientId", "fullName role profilePhoto");

    return res.status(201).json({ message: populated });
  } catch (error) {
    console.error("❌ sendDirectMessage error:", error);
    return res.status(500).json({ message: "Failed to send message" });
  }
};
