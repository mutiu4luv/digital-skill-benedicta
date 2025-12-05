import Material from "../module/coachUpload.js";
import cloudinary from "../config/cloudnary.js";
import User from "../module/userModule.js";
import streamifier from "streamifier";
import Course from "../module/course.js";
import Cohort from "../module/cohort.js";
import mongoose from "mongoose";

// ✅ Upload helper
const streamUpload = (buffer, folder, resourceType) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// =============================================
//  COACH UPLOAD VIDEO (upload anytime)
//  Coach chooses classStartTime from frontend
// =============================================
export const uploadVideo = async (req, res) => {
  try {
    const { title, courseId, classStartTime } = req.body;
    const coachId = req.user.id;

    if (!title) return res.status(400).json({ message: "Title is required" });

    if (!req.file)
      return res.status(400).json({ message: "No video file uploaded" });

    if (!courseId)
      return res.status(400).json({ message: "Course ID is required" });

    if (!classStartTime)
      return res.status(400).json({ message: "Class start time is required" });

    // Validate course
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Validate course ownership
    if (!course.coach.equals(coachId))
      return res.status(403).json({
        message: "You are not authorized. This is not your course.",
      });

    // Convert classStartTime to Date
    const startTime = new Date(classStartTime);
    const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000);

    // Upload video to Cloudinary
    const uploadResult = await streamUpload(
      req.file.buffer,
      "HGSC-videos",
      "video"
    );

    // Save material in DB
    const material = await Material.create({
      title,
      fileUrl: uploadResult.secure_url,
      type: "video",
      coach: coachId,
      course: courseId,
      availableFrom: startTime,
      availableUntil: endTime,
    });

    return res.status(201).json({
      message: "🎥 Video uploaded successfully",
      material,
    });
  } catch (error) {
    console.error("❌ Upload Video Error:", error);
    return res.status(500).json({
      message: "Video upload failed",
      error: error.message,
    });
  }
};
// ✅ Upload Document
export const uploadDocument = async (req, res) => {
  try {
    const { title, courseId } = req.body;
    const coachId = req.user.id;

    if (!req.file)
      return res.status(400).json({ message: "No document file uploaded" });
    if (!courseId)
      return res.status(400).json({ message: "Course ID is required" });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (!course.coach.equals(coachId))
      return res
        .status(403)
        .json({ message: "You are not the coach of this course" });

    if (!course.isClassOpen)
      return res.status(403).json({
        message: "Class is closed. You can only upload during class time.",
      });

    const result = await streamUpload(req.file.buffer, "documents", "auto");

    const document = await Material.create({
      title,
      fileUrl: result.secure_url,
      type: "document",
      coach: coachId,
      course: courseId, // ✅ link to course
    });

    res.status(201).json({
      message: "✅ Document uploaded successfully",
      document,
    });
  } catch (error) {
    console.error("❌ Document upload failed:", error);
    res.status(500).json({
      message: "Document upload failed",
      error: error.message,
    });
  }
};

export const getMyVideos = async (req, res) => {
  try {
    const coachId = req.user.id;

    const videos = await Material.find({
      coach: coachId,
      type: "video",
    })
      .populate("course", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json(videos);
  } catch (error) {
    return res.status(500).json({
      message: "Could not fetch videos",
      error: error.message,
    });
  }
};

// ✅ Fetch all materials (for students)

export const getAllMaterials = async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;

  const course = await Course.findById(courseId).populate("students");
  if (!course) return res.status(404).json({ message: "Course not found" });

  // Restrict to enrolled students or course coach
  const isStudentEnrolled = course.students.some(
    (student) => student._id.toString() === userId
  );

  if (req.user.role === "student" && !isStudentEnrolled) {
    return res
      .status(403)
      .json({ message: "You are not enrolled in this course" });
  }

  if (!course.isClassOpen) {
    return res
      .status(403)
      .json({ message: "Class is currently closed. Materials unavailable." });
  }

  // Fetch materials
  const materials = await Material.find({ course: courseId })
    .populate("coach", "fullName email")
    .sort({ createdAt: -1 });

  res.json({ message: "✅ Course materials fetched", materials });
};

// ✅ Get all coaches assigned to a student

export const getAssignedCoaches = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Convert to ObjectId for comparison
    let studentObjectId;
    try {
      studentObjectId = new mongoose.Types.ObjectId(studentId);
    } catch {
      studentObjectId = null; // in case the id is already string
    }

    // Fetch cohorts where student exists (string or ObjectId)
    const cohorts = await Cohort.find({
      $or: [
        { "studentIds.studentId": studentId }, // string match
        ...(studentObjectId
          ? [{ "studentIds.studentId": studentObjectId }]
          : []), // ObjectId match
      ],
    }).populate({
      path: "courses.courseId",
      select: "name coach",
      populate: {
        path: "coach",
        select: "fullName email profilePhoto avgRating",
      },
    });

    if (!cohorts || cohorts.length === 0) {
      return res
        .status(404)
        .json({ message: "You are not enrolled in any cohort yet." });
    }

    const coachMap = new Map();

    for (const cohort of cohorts) {
      // Find the student object in this cohort
      const studentData = cohort.studentIds.find(
        (s) =>
          s.studentId.toString() === studentId.toString() ||
          s.studentId === studentId
      );

      if (!studentData || !Array.isArray(studentData.enrollments)) continue;

      for (const enrollment of studentData.enrollments) {
        // Only consider enrollments that are confirmed
        if (!enrollment.paymentConfirmed) continue;

        // Find the course in this cohort that is in progress
        const courseInCohort = cohort.courses.find(
          (c) =>
            c.courseId &&
            c.courseId._id.toString() === enrollment.courseId.toString() &&
            c.status === "in_progress" &&
            c.courseId.coach
        );

        if (courseInCohort) {
          const coach = courseInCohort.courseId.coach;
          coachMap.set(coach._id.toString(), {
            _id: coach._id,
            fullName: coach.fullName,
            email: coach.email,
            profilePhoto: coach.profilePhoto,
            avgRating: coach.avgRating,
          });
        }
      }
    }

    const uniqueCoaches = Array.from(coachMap.values());

    if (uniqueCoaches.length === 0) {
      return res.status(404).json({
        message:
          "You have no assigned coaches for in-progress courses at the moment.",
      });
    }

    return res.status(200).json({
      message: "✅ Assigned coaches fetched successfully",
      coaches: uniqueCoaches,
    });
  } catch (error) {
    console.error("❌ Fetch assigned coaches failed:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
// ✅ Delete video by coach
export const deleteVideo = async (req, res) => {
  try {
    const videoId = req.params.id;

    const video = await Material.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    // Extract Cloudinary public_id from URL
    const urlParts = video.fileUrl.split("/");
    const publicIdWithExt = urlParts[urlParts.length - 1];
    const publicId = "HGSC-videos/" + publicIdWithExt.split(".")[0];

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId, { resource_type: "video" });

    // Delete from MongoDB
    await Material.findByIdAndDelete(videoId);

    res.json({ message: "Video deleted successfully" });
  } catch (error) {
    console.error("Delete video failed:", error);
    res.status(500).json({ message: "Server error deleting video" });
  }
};
