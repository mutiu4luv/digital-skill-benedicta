import Material from "../module/coachUpload.js";
import cloudinary from "../config/cloudnary.js";
import Material from "../module/coachUpload.js";
import User from "../models/userModel.js"; // adjust path if needed

// ✅ Helper: Upload file to Cloudinary
const uploadToCloudinary = async (filePath, folder, resourceType) => {
  return await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: resourceType,
  });
};

// ✅ Upload Video (Coach or Owner only)
export const uploadVideo = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "No video file uploaded" });
    const { title } = req.body;
    const coachId = req.user.id;

    // Upload video to Cloudinary
    const result = await uploadToCloudinary(req.file.path, "videos", "video");

    const video = await Material.create({
      title,
      fileUrl: result.secure_url,
      type: "video",
      coach: coachId,
    });

    res.status(201).json({ message: "✅ Video uploaded successfully", video });
  } catch (error) {
    console.error("❌ Video upload failed:", error);
    res
      .status(500)
      .json({ message: "Video upload failed", error: error.message });
  }
};

// ✅ Upload Document (Coach or Owner only)
export const uploadDocument = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "No document file uploaded" });
    const { title } = req.body;
    const coachId = req.user.id;

    // Upload document to Cloudinary
    const result = await uploadToCloudinary(req.file.path, "documents", "auto");

    const document = await Material.create({
      title,
      fileUrl: result.secure_url,
      type: "document",
      coach: coachId,
    });

    res
      .status(201)
      .json({ message: "✅ Document uploaded successfully", document });
  } catch (error) {
    console.error("❌ Document upload failed:", error);
    res
      .status(500)
      .json({ message: "Document upload failed", error: error.message });
  }
};

// ✅ Fetch all materials (for students)

export const getAllMaterials = async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await User.findById(userId);

    if (!student) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Only students can access
    if (student.role !== "student") {
      return res
        .status(403)
        .json({ message: "Only students can access this route" });
    }

    // ✅ Time-based access logic
    const now = new Date();
    const classDate = new Date(student.classDate);

    const isSameDay =
      now.getFullYear() === classDate.getFullYear() &&
      now.getMonth() === classDate.getMonth() &&
      now.getDate() === classDate.getDate();

    const currentHour = now.getHours();
    const isBetween8and11 = currentHour >= 20 && currentHour < 23;

    if (!isSameDay || !isBetween8and11) {
      return res.status(403).json({
        message:
          "Materials are only available between 8 PM and 11 PM on your class date.",
      });
    }

    // ✅ Check assignment restriction — but skip if it's first class
    if (!student.isFirstClass && !student.assignmentCompleted) {
      return res.status(403).json({
        message:
          "You must complete your previous assignment before accessing materials.",
      });
    }

    // ✅ Fetch materials
    const materials = await Material.find()
      .populate("coach", "fullName email")
      .sort({ createdAt: -1 });

    res.json(materials);
  } catch (error) {
    console.error("❌ Fetch materials failed:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch materials", error: error.message });
  }
};
