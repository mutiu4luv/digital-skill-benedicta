import Announcement from "../module/anouncement.js";

// ===============================
// CREATE ANNOUNCEMENT (CEO ONLY)
// ===============================
export const createAnnouncement = async (req, res) => {
  try {
    const { title, message, button, whatsappLink, telegramLink, youtubeLink } =
      req.body;

    if (!title || !message) {
      return res
        .status(400)
        .json({ message: "Title and message are required" });
    }

    const announcement = await Announcement.create({
      title,
      message,
      button: button || null,
      whatsappLink: button === "whatsapp" ? whatsappLink : null,
      telegramLink: button === "telegram" ? telegramLink : null,
      youtubeLink: button === "youtube" ? youtubeLink : null,
      createdBy: req.user.id,
    });

    return res.status(201).json({
      message: "Announcement created successfully",
      announcement,
    });
  } catch (err) {
    console.error("Create Announcement Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ===============================
// DELETE ANNOUNCEMENT (CEO ONLY)
// ===============================
export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    await announcement.deleteOne();

    return res.status(200).json({
      message: "Announcement deleted successfully",
    });
  } catch (err) {
    console.error("Delete Announcement Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

export const getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ announcements });
  } catch (err) {
    console.error("Get Announcements Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
