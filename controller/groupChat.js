import GroupChat from "../module/groupChat.js";

const canAccessChannel = (role, channel) => {
  if (channel === "users") return ["student", "coach", "owner", "admin"].includes(role);
  if (channel === "coaches") return ["coach", "owner", "admin"].includes(role);
  return false;
};

const getAllowedChannels = (role) => {
  if (role === "student") return ["users"];
  if (role === "coach") return ["users", "coaches"];
  if (role === "owner" || role === "admin") return ["users", "coaches"];
  return [];
};

export const getChatChannels = async (req, res) => {
  const channels = getAllowedChannels(req.user.role);
  return res.status(200).json({ channels });
};

export const getGroupMessages = async (req, res) => {
  try {
    const { channel } = req.params;
    const role = req.user.role;

    if (!["users", "coaches"].includes(channel)) {
      return res.status(400).json({ message: "Invalid chat channel" });
    }

    if (!canAccessChannel(role, channel)) {
      return res.status(403).json({ message: "You cannot access this chat room" });
    }

    let chat = await GroupChat.findOne({ channel }).populate(
      "messages.senderId",
      "fullName role profilePhoto"
    );

    if (!chat) {
      chat = await GroupChat.create({ channel, messages: [] });
      chat = await GroupChat.findById(chat._id).populate(
        "messages.senderId",
        "fullName role profilePhoto"
      );
    }

    return res.status(200).json({ channel, messages: chat.messages || [] });
  } catch (error) {
    console.error("❌ getGroupMessages error:", error);
    return res.status(500).json({ message: "Failed to load group messages" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { channel } = req.params;
    const role = req.user.role;
    const userId = req.user._id;
    const { text } = req.body;

    if (!["users", "coaches"].includes(channel)) {
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

    return res.status(201).json({ channel, message: saved });
  } catch (error) {
    console.error("❌ sendGroupMessage error:", error);
    return res.status(500).json({ message: "Failed to send group message" });
  }
};
