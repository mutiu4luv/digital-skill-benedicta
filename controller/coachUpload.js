import Material from "../module/coachUpload.js";
import cloudinary from "../config/cloudnary.js";

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
