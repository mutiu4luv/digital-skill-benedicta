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
    const { title, courseId, classStartTime, cohortId } = req.body;
    const coachId = req.user.id;

    if (!title) return res.status(400).json({ message: "Title is required" });
    if (!req.file)
      return res.status(400).json({ message: "No video file uploaded" });
    if (!courseId)
      return res.status(400).json({ message: "Course ID is required" });
    if (!classStartTime)
      return res.status(400).json({ message: "Class start time is required" });
    if (!cohortId)
      return res.status(400).json({ message: "Cohort ID is required" });

    // Validate course
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Validate ownership
    if (!course.coach.equals(coachId))
      return res
        .status(403)
        .json({ message: "You are not authorized. This is not your course." });

    // Convert classStartTime to UTC Date
    const startTime = new Date(classStartTime);
    const utcStartTime = new Date(
      startTime.getUTCFullYear(),
      startTime.getUTCMonth(),
      startTime.getUTCDate(),
      startTime.getUTCHours(),
      startTime.getUTCMinutes(),
      0,
      0
    );

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
      cohortId: cohortId,
      unlockAt: utcStartTime, // store in UTC
    });

    return res.status(201).json({
      message: "🎥 Video uploaded successfully",
      material,
    });
  } catch (error) {
    console.error("❌ Upload Video Error:", error);
    return res
      .status(500)
      .json({ message: "Video upload failed", error: error.message });
  }
};

// ✅ Upload Document
export const uploadDocument = async (req, res) => {
  try {
    const { title, courseId, unlockAt } = req.body; // unlockAt is ISO string
    const coachId = req.user.id;

    if (!req.file)
      return res.status(400).json({ message: "No document file uploaded" });
    if (!courseId)
      return res.status(400).json({ message: "Course ID is required" });
    if (!unlockAt)
      return res.status(400).json({ message: "Unlock time is required" });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (!course.coach.equals(coachId))
      return res
        .status(403)
        .json({ message: "You are not the coach of this course" });

    const result = await streamUpload(req.file.buffer, "documents", "auto");

    const document = await Material.create({
      title,
      fileUrl: result.secure_url,
      type: "document",
      coach: coachId,
      course: courseId,
      unlockAt: new Date(unlockAt), // store unlock time
    });

    res.status(201).json({
      message: "✅ Document uploaded successfully",
      unlockedMaterials: [
        {
          _id: document._id,
          title: document.title,
          fileUrl: document.fileUrl,
          type: document.type,
          coach: document.coach,
          courseId: { _id: course._id, name: course.name },
          unlockAt: document.unlockAt,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
      ],
      lockedMaterialsMessage: null,
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

// ✅ Student fetches course video with 3-hour unlock window

export const getStudentCourseMaterials = async (req, res) => {
  try {
    const studentId = req.user.id;
    const now = Date.now(); // current timestamp in ms

    // Convert to ObjectId safely
    let studentObjectId;
    try {
      studentObjectId = new mongoose.Types.ObjectId(studentId);
    } catch {
      studentObjectId = null;
    }

    // Fetch cohorts where student exists
    const cohorts = await Cohort.find({
      $or: [
        { "studentIds.studentId": studentId },
        ...(studentObjectId
          ? [{ "studentIds.studentId": studentObjectId }]
          : []),
      ],
    });

    if (!cohorts || cohorts.length === 0) {
      return res
        .status(404)
        .json({ message: "You are not enrolled in any cohort yet." });
    }

    const unlockedMaterials = [];
    const lockedMaterials = [];

    for (const cohort of cohorts) {
      const studentData = cohort.studentIds.find(
        (s) =>
          s.studentId.toString() === studentId.toString() ||
          s.studentId === studentId
      );

      if (!studentData || !Array.isArray(studentData.enrollments)) continue;

      for (const enrollment of studentData.enrollments) {
        if (!enrollment.paymentConfirmed) continue;

        const courseInCohort = cohort.courses.find(
          (c) => c.courseId.toString() === enrollment.courseId.toString()
        );

        if (!courseInCohort) continue;

        const uploads = await Material.find({
          cohortId: cohort._id,
          course: courseInCohort.courseId,
        }).select("title type fileUrl coach unlockAt createdAt updatedAt");

        for (const upload of uploads) {
          const unlockTime = upload.unlockAt?.getTime() || 0;
          const expireTime = unlockTime + 3 * 60 * 60 * 1000; // 3 hours in ms

          if (unlockTime <= now && now <= expireTime) {
            // unlocked and within 3-hour window
            unlockedMaterials.push({
              cohortId: cohort._id,
              courseId: courseInCohort.courseId,
              ...upload.toObject(),
            });
          } else {
            // locked (either not yet unlocked OR expired)
            lockedMaterials.push({
              cohortId: cohort._id,
              courseId: courseInCohort.courseId,
              ...upload.toObject(),
            });
          }
        }
      }
    }

    if (unlockedMaterials.length === 0 && lockedMaterials.length === 0) {
      return res.status(404).json({
        message: "Your coach has not uploaded any course materials yet.",
      });
    }

    return res.status(200).json({
      message: "✅ Course materials fetched successfully",
      unlockedMaterials,
      lockedMaterialsMessage: lockedMaterials.length
        ? `Your coach has uploaded ${lockedMaterials.length} material(s). They will be available after the unlock time or are expired.`
        : null,
    });
  } catch (error) {
    console.error("❌ Fetch course materials failed:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// ✅ Student fetches documents with 3-hour unlock window

export const getStudentDocuments = async (req, res) => {
  try {
    const studentId = req.user.id;
    const now = new Date();

    // 1️⃣ Get cohorts where the student belongs and populate enrollments
    const cohorts = await Cohort.find({ "studentIds.studentId": studentId })
      .populate({
        path: "courses.courseId",
        select: "_id name",
      })
      .populate({
        path: "studentIds.enrollments",
      });

    // 2️⃣ Flatten allowed course IDs where the student has access
    const allowedCourseIds = [];

    cohorts.forEach((cohort) => {
      // Find the student in this cohort
      const studentEntry = cohort.studentIds.find(
        (s) => s.studentId.toString() === studentId
      );

      if (studentEntry?.enrollments?.length) {
        studentEntry.enrollments.forEach((enrollment) => {
          if (enrollment.hasAccess) {
            allowedCourseIds.push(enrollment.courseId.toString());
          }
        });
      }
    });

    // 3️⃣ Fetch documents for allowed courses
    const documents = await Material.find({
      type: "document",
      course: { $in: allowedCourseIds },
      unlockAt: { $lte: now },
    })
      .populate("course", "name coach")
      .sort({ createdAt: -1 });

    // 4️⃣ Filter documents that are not expired (3 hours after unlockAt)
    const unlockedMaterials = documents
      .filter(
        (doc) => now <= new Date(doc.unlockAt.getTime() + 3 * 60 * 60 * 1000)
      )
      .map((doc) => ({
        _id: doc._id,
        title: doc.title,
        fileUrl: doc.fileUrl,
        type: doc.type,
        coach: doc.coach,
        courseId: doc.course
          ? { _id: doc.course._id, name: doc.course.name }
          : null,
        unlockAt: doc.unlockAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }));

    res.status(200).json({
      message: "✅ Documents fetched successfully",
      unlockedMaterials,
      lockedMaterialsMessage:
        unlockedMaterials.length === 0 ? "No documents available" : null,
    });
  } catch (error) {
    console.error("❌ Could not fetch documents:", error);
    res.status(500).json({
      message: "Could not fetch documents",
      error: error.message,
    });
  }
};

// get all documents uploaded by the coach
export const getCoachDocuments = async (req, res) => {
  try {
    const coachId = req.user.id;

    // Get all documents uploaded by this coach
    const documents = await Material.find({
      coach: coachId,
      type: "document",
    })
      .populate("course", "name category duration")
      .sort({ createdAt: -1 });

    // Format response EXACTLY like your upload response
    const formatted = documents.map((doc) => ({
      _id: doc._id,
      title: doc.title,
      fileUrl: doc.fileUrl,
      type: doc.type,
      coach: doc.coach,
      courseId: {
        _id: doc.course?._id || null,
        name: doc.course?.name || "Unknown Course",
      },
      unlockAt: doc.unlockAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    res.status(200).json({
      message: "Documents fetched successfully",
      unlockedMaterials: formatted,
      lockedMaterialsMessage: null,
    });
  } catch (error) {
    console.error("❌ Error fetching coach documents:", error);
    res.status(500).json({
      message: "Failed to fetch documents",
      error: error.message,
    });
  }
};
// ✅ Delete document by coach
export const deleteDocument = async (req, res) => {
  try {
    const coachId = req.user.id;
    const documentId = req.params.documentId;

    // Find document
    const doc = await Material.findById(documentId);

    if (!doc) {
      return res.status(404).json({
        message: "Document not found",
      });
    }

    // Ensure this coach owns the document
    if (doc.coach.toString() !== coachId) {
      return res.status(403).json({
        message: "You are not allowed to delete this document",
      });
    }

    // Delete it
    await Material.findByIdAndDelete(documentId);

    res.status(200).json({
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting document:", error);
    res.status(500).json({
      message: "Document deletion failed",
      error: error.message,
    });
  }
};
