import Material from "../module/coachUpload.js";
import cloudinary from "../config/cloudnary.js";
import User from "../module/userModule.js";
import streamifier from "streamifier";
import Course from "../module/course.js";
import Cohort from "../module/cohort.js";

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

// ✅ Upload Video
// ✅ Upload Video
export const uploadVideo = async (req, res) => {
  try {
    const { title, courseId } = req.body; // <-- include courseId
    const coachId = req.user.id;

    if (!req.file)
      return res.status(400).json({ message: "No video file uploaded" });
    if (!courseId)
      return res.status(400).json({ message: "Course ID is required" });

    // Check course ownership
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (!course.coach.equals(coachId))
      return res
        .status(403)
        .json({ message: "You are not the coach of this course" });

    // Restrict upload if class is closed
    if (!course.isClassOpen)
      return res.status(403).json({
        message: "Class is closed. You can only upload during class time.",
      });

    // Upload to cloudinary
    const result = await streamUpload(req.file.buffer, "videos", "video");

    // Save video in DB
    const video = await Material.create({
      title,
      fileUrl: result.secure_url,
      type: "video",
      coach: coachId,
      course: courseId, // ✅ link to course
    });

    res.status(201).json({ message: "✅ Video uploaded successfully", video });
  } catch (error) {
    console.error("❌ Video upload failed:", error);
    res
      .status(500)
      .json({ message: "Video upload failed", error: error.message });
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

    // 1️⃣ Find all cohorts where the student is enrolled
    const cohorts = await Cohort.find({
      "studentIds.studentId": studentId,
    }).populate({
      path: "courses.courseId",
      select: "name coach",
      populate: {
        path: "coach",
        select: "fullName email profilePhoto avgRating",
      },
    });

    if (!cohorts || cohorts.length === 0) {
      return res.status(404).json({
        message: "You are not enrolled in any cohort yet.",
      });
    }

    // 2️⃣ Collect all paid course coaches where cohort course status is "in_progress"
    const coachMap = new Map();

    cohorts.forEach((cohort) => {
      const studentEntry = Cohort.studentIds.find(
        (s) => s.studentId.toString() === studentId
      );

      if (!studentEntry) return;

      studentEntry.enrollments.forEach((enrollment) => {
        if (!enrollment.paid) return;

        // Find the course in cohort.courses and check if in_progress
        const courseInCohort = cohort.courses.find(
          (c) =>
            c.courseId._id.toString() === enrollment.courseId.toString() &&
            c.status === "in_progress"
        );

        if (courseInCohort && courseInCohort.courseId.coach) {
          coachMap.set(
            courseInCohort.courseId.coach._id.toString(),
            courseInCohort.courseId.coach
          );
        }
      });
    });

    const uniqueCoaches = Array.from(coachMap.values());

    if (uniqueCoaches.length === 0) {
      return res.status(404).json({
        message:
          "You have no assigned coaches at the moment. Only active courses are considered.",
      });
    }

    res.status(200).json({
      message: "✅ Assigned coaches fetched successfully",
      coaches: uniqueCoaches,
    });
  } catch (error) {
    console.error("❌ Fetch assigned coaches failed:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
