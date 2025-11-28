import Announcement from "../module/anouncement.js";

export const createAnnouncement = async (req, res) => {
  try {
    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        message: "Title and message are required",
      });
    }

    const announcement = await Announcement.create({
      title,
      message,
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
