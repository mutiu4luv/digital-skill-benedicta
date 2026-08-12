import GroupChat from "../module/groupChat.js";
import GroupChatReadState from "../module/groupChatReadState.js";
import User from "../module/userModule.js";

const normalizeChannel = (channel) => {
  const value = String(channel || "").toLowerCase();
  if (value === "users" || value === "user") return "students";
  return value;
};

const canAccessChannel = (role, channel) => {
  const normalized = normalizeChannel(channel);
  if (normalized === "students")
    return ["student", "coach", "owner", "admin"].includes(role);
  if (normalized === "coaches")
    return ["coach", "owner", "admin"].includes(role);
  return false;
};

const getAllowedChannels = (role) => {
  if (role === "student") return ["students"];
  if (role === "coach") return ["coaches", "students"];
  if (role === "owner" || role === "admin") return ["coaches", "students"];
  return [];
};

const getLatestMessageTimestamp = (chat) => {
  const messages = Array.isArray(chat?.messages) ? chat.messages : [];
  const latest = messages[messages.length - 1];
  if (!latest) return new Date();

  const latestDate = new Date(latest.createdAt || latest.updatedAt || Date.now());
  return Number.isNaN(latestDate.getTime()) ? new Date() : latestDate;
};

const EDIT_WINDOW_MS = 20 * 60 * 1000;

export const getChatChannels = async (req, res) => {
  const channels = getAllowedChannels(req.user.role);
  return res.status(200).json({ channels });
};

export const getGroupUnreadSummary = async (req, res) => {
  try {
    const channels = getAllowedChannels(req.user.role);
    const userId = String(req.user._id);

    const [chats, readStates] = await Promise.all([
      GroupChat.find({ channel: { $in: channels } }).lean(),
      GroupChatReadState.find({
        userId: req.user._id,
        channel: { $in: channels },
      }).lean(),
    ]);

    const chatMap = new Map(chats.map((chat) => [chat.channel, chat]));
    const readStateMap = new Map(
      readStates.map((state) => [state.channel, new Date(state.lastReadAt || 0)])
    );

    const unreadByChannel = {};
    let total = 0;

    for (const channel of channels) {
      const chat = chatMap.get(channel);
      const messages = Array.isArray(chat?.messages) ? chat.messages : [];
      const lastReadAt = readStateMap.get(channel) || new Date(0);

      const count = messages.filter((message) => {
        const senderId = message?.senderId?._id || message?.senderId;
        const createdAt = new Date(
          message?.createdAt || message?.updatedAt || 0
        );

        return (
          !Number.isNaN(createdAt.getTime()) &&
          createdAt > lastReadAt &&
          String(senderId) !== userId
        );
      }).length;

      unreadByChannel[channel] = count;
      total += count;
    }

    return res.status(200).json({ unreadByChannel, total });
  } catch (error) {
    console.error("❌ getGroupUnreadSummary error:", error);
    return res.status(500).json({ message: "Failed to load unread chat summary" });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const channel = normalizeChannel(req.params.channel);
    const role = req.user.role;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "30", 10), 1),
      100
    );

    if (!["students", "coaches"].includes(channel)) {
      return res.status(400).json({ message: "Invalid chat channel" });
    }

    if (!canAccessChannel(role, channel)) {
      return res.status(403).json({ message: "You cannot access this chat room" });
    }

    let chat = await GroupChat.findOne({ channel }).lean();

    // Backward compatibility: migrate old "users" channel to "students" on read.
    if (!chat && channel === "students") {
      const legacy = await GroupChat.findOne({ channel: "users" });
      if (legacy) {
        legacy.channel = "students";
        await legacy.save();
        chat = await GroupChat.findOne({ channel: "students" }).lean();
      }
    }

    if (!chat) {
      chat = await GroupChat.create({ channel, messages: [] });
      chat = await GroupChat.findById(chat._id).lean();
    }

    const allMessages = Array.isArray(chat.messages) ? chat.messages : [];
    const total = allMessages.length;
    const end = total - (page - 1) * limit;
    const start = Math.max(end - limit, 0);
    const pagedMessages = allMessages.slice(start, Math.max(end, 0));

    const senderIds = [
      ...new Set(pagedMessages.map((m) => String(m.senderId)).filter(Boolean)),
    ];
    const senders = await User.find({ _id: { $in: senderIds } })
      .select("fullName role profilePhoto")
      .lean();
    const senderMap = new Map(senders.map((s) => [String(s._id), s]));

    const messages = pagedMessages.map((m) => ({
      ...m,
      senderId: senderMap.get(String(m.senderId)) || m.senderId,
    }));

    return res.status(200).json({
      channel,
      page,
      limit,
      total,
      hasMore: start > 0,
      messages,
    });
  } catch (error) {
    console.error("❌ getGroupMessages error:", error);
    return res.status(500).json({ message: "Failed to load group messages" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const channel = normalizeChannel(req.params.channel);
    const role = req.user.role;
    const userId = req.user._id;
    const { text } = req.body;

    if (!["students", "coaches"].includes(channel)) {
      return res.status(400).json({ message: "Invalid chat channel" });
    }

    if (!canAccessChannel(role, channel)) {
      return res.status(403).json({ message: "You cannot send to this chat room" });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }

    let chat = await GroupChat.findOne({ channel });
    if (!chat) {
      chat = await GroupChat.create({ channel, messages: [] });
    }

    chat.messages.push({
      senderId: userId,
      text: text.trim(),
    });
    await chat.save();

    const savedIndex = chat.messages.length - 1;
    await chat.populate(`messages.${savedIndex}.senderId`, "fullName role profilePhoto");
    const saved = chat.messages[savedIndex];

    req.io?.to(`group-chat:${channel}`).emit("groupChatMessage", {
      channel,
      message: saved,
    });

    return res.status(201).json({ channel, message: saved });
  } catch (error) {
    console.error("❌ sendGroupMessage error:", error);
    return res.status(500).json({ message: "Failed to send group message" });
  }
};

export const markGroupChannelRead = async (req, res) => {
  try {
    const channel = normalizeChannel(req.params.channel);

    if (!["students", "coaches"].includes(channel)) {
      return res.status(400).json({ message: "Invalid chat channel" });
    }

    if (!canAccessChannel(req.user.role, channel)) {
      return res.status(403).json({ message: "Unauthorized for this chat channel" });
    }

    let chat = await GroupChat.findOne({ channel }).lean();

    if (!chat && channel === "students") {
      const legacy = await GroupChat.findOne({ channel: "users" });
      if (legacy) {
        legacy.channel = "students";
        await legacy.save();
        chat = await GroupChat.findOne({ channel: "students" }).lean();
      }
    }

    const lastReadAt = getLatestMessageTimestamp(chat);

    await GroupChatReadState.findOneAndUpdate(
      { userId: req.user._id, channel },
      { $max: { lastReadAt } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      channel,
      lastReadAt: lastReadAt.toISOString(),
    });
  } catch (error) {
    console.error("❌ markGroupChannelRead error:", error);
    return res.status(500).json({ message: "Failed to mark chat as read" });
  }
};

export const reactToGroupMessage = async (req, res) => {
  try {
    const channel = normalizeChannel(req.params.channel);
    const { messageId } = req.params;
    const { reaction } = req.body;
    const userId = String(req.user._id);

    if (!["students", "coaches"].includes(channel)) {
      return res.status(400).json({ message: "Invalid chat channel" });
    }

    if (!["like", "dislike"].includes(reaction)) {
      return res.status(400).json({ message: "Reaction must be like or dislike" });
    }

    if (!canAccessChannel(req.user.role, channel)) {
      return res.status(403).json({ message: "Unauthorized for this chat channel" });
    }

    const chat = await GroupChat.findOne({ channel, "messages._id": messageId });
    if (!chat) return res.status(404).json({ message: "Message not found" });

    const msg = chat.messages.id(messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    const likedSet = new Set((msg.likedBy || []).map((id) => String(id)));
    const dislikedSet = new Set((msg.dislikedBy || []).map((id) => String(id)));

    // A user can hold only one reaction state at a time.
    // Clicking like always sets like (and removes dislike).
    // Clicking unlike(dislike) always sets dislike (and removes like).
    if (reaction === "like") {
      likedSet.add(userId);
      dislikedSet.delete(userId);
    } else {
      dislikedSet.add(userId);
      likedSet.delete(userId);
    }

    msg.likedBy = Array.from(likedSet);
    msg.dislikedBy = Array.from(dislikedSet);
    await chat.save();

    const messageIndex = chat.messages.findIndex(
      (m) => String(m._id) === String(messageId)
    );
    if (messageIndex >= 0) {
      await chat.populate(
        `messages.${messageIndex}.senderId`,
        "fullName role profilePhoto"
      );
    }
    const populatedMessage = chat.messages.id(messageId);

    return res.status(200).json({
      message: populatedMessage,
      likedCount: populatedMessage.likedBy.length,
      dislikedCount: populatedMessage.dislikedBy.length,
      likedByMe: likedSet.has(userId),
      dislikedByMe: dislikedSet.has(userId),
    });
  } catch (error) {
    console.error("❌ reactToGroupMessage error:", error);
    return res.status(500).json({ message: "Failed to react to message" });
  }
};

export const editGroupMessage = async (req, res) => {
  try {
    const channel = normalizeChannel(req.params.channel);
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = String(req.user._id);
    const role = req.user.role;

    if (!["students", "coaches"].includes(channel)) {
      return res.status(400).json({ message: "Invalid chat channel" });
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }
    if (!canAccessChannel(role, channel)) {
      return res.status(403).json({ message: "Unauthorized for this chat channel" });
    }

    const chat = await GroupChat.findOne({ channel, "messages._id": messageId });
    if (!chat) return res.status(404).json({ message: "Message not found" });

    const msg = chat.messages.id(messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    const isOwner = String(msg.senderId) === userId;
    if (!isOwner) {
      return res.status(403).json({ message: "You can only edit your own message" });
    }
    if (Date.now() - new Date(msg.createdAt).getTime() > EDIT_WINDOW_MS) {
      return res.status(403).json({
        message: "Messages can only be edited within 20 minutes",
      });
    }

    msg.text = text.trim();
    await chat.save();

    const messageIndex = chat.messages.findIndex(
      (m) => String(m._id) === String(messageId)
    );
    if (messageIndex >= 0) {
      await chat.populate(
        `messages.${messageIndex}.senderId`,
        "fullName role profilePhoto"
      );
    }

    return res.status(200).json({ message: chat.messages.id(messageId) });
  } catch (error) {
    console.error("❌ editGroupMessage error:", error);
    return res.status(500).json({ message: "Failed to edit message" });
  }
};

export const deleteGroupMessage = async (req, res) => {
  try {
    const channel = normalizeChannel(req.params.channel);
    const { messageId } = req.params;
    const userId = String(req.user._id);
    const role = req.user.role;

    if (!["students", "coaches"].includes(channel)) {
      return res.status(400).json({ message: "Invalid chat channel" });
    }
    if (!canAccessChannel(role, channel)) {
      return res.status(403).json({ message: "Unauthorized for this chat channel" });
    }

    const chat = await GroupChat.findOne({ channel, "messages._id": messageId });
    if (!chat) return res.status(404).json({ message: "Message not found" });

    const msg = chat.messages.id(messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    const isOwner = String(msg.senderId) === userId;
    if (!isOwner) {
      return res.status(403).json({ message: "You can only delete your own message" });
    }

    chat.messages.pull({ _id: messageId });
    await chat.save();

    return res.status(200).json({ success: true, messageId });
  } catch (error) {
    console.error("❌ deleteGroupMessage error:", error);
    return res.status(500).json({ message: "Failed to delete message" });
  }
};
