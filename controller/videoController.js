import Video from "../module/video.js";
import cloudinary from "../config/cloudnary.js";
import fs from "fs";

// ✅ Upload video (admin only)
export const uploadVideo = async (req, res) => {
  try {
    const { title } = req.body;
    const file = req.file;

    if (!file)
      return res.status(400).json({ message: "No video file uploaded" });
    if (!title)
      return res.status(400).json({ message: "Video title required" });

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(file.path, {
      resource_type: "video",
      folder: "hgsc_videos",
    });

    // Remove local file after upload
    fs.unlink(file.path, (err) => {
      if (err) console.error("Failed to delete temp file:", err);
    });

    // Save to database
    const video = await Video.create({
      title,
      videoUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    });

    res.status(201).json({
      message: "🎥 Video uploaded successfully",
      video,
    });
  } catch (error) {
    console.error("❌ Video upload error:", error);
    res.status(500).json({
      message: "Upload failed",
      error: error.message,
    });
  }
};

// ✅ Get all videos (public)
export const getVideos = async (req, res) => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.status(200).json(videos);
  } catch (error) {
    console.error("❌ Fetch videos error:", error);
    res.status(500).json({
      message: "Failed to fetch videos",
      error: error.message,
    });
  }
};

// ✅ Delete video (admin only)
export const deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await Video.findById(id);
    if (!video) return res.status(404).json({ message: "Video not found" });

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(video.publicId, {
      resource_type: "video",
    });

    // Delete from DB
    await video.deleteOne();

    res.status(200).json({ message: "🗑️ Video deleted successfully" });
  } catch (error) {
    console.error("❌ Delete video error:", error);
    res.status(500).json({
      message: "Failed to delete video",
      error: error.message,
    });
  }
};
