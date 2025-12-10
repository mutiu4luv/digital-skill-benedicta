import Material from "../module/coachUpload.js";
import cloudinary from "../config/cloudnary.js";
import User from "../module/userModule.js";
import streamifier from "streamifier";
import Course from "../module/course.js";
import Cohort from "../module/cohort.js";
import mongoose from "mongoose";
import moment from "moment";

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
    const { title, courseId, unlockAt } = req.body; // ISO string
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
      unlockAt: moment.utc(unlockAt).toDate(), // <-- store as UTC
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

    // Convert studentId to ObjectId if possible
    let studentObjectId = null;
    try {
      studentObjectId = new mongoose.Types.ObjectId(studentId);
    } catch {
      // keep null if conversion fails (string is fine)
    }

    // Fetch cohorts where the student is enrolled
    const cohorts = await Cohort.find({
      $or: [
        { "studentIds.studentId": studentId },
        ...(studentObjectId
          ? [{ "studentIds.studentId": studentObjectId }]
          : []),
      ],
    }).populate({
      path: "courses.courseId",
      select: "name coach status",
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

    cohorts.forEach((cohort) => {
      // Find the student object in this cohort
      const studentData = cohort.studentIds.find(
        (s) =>
          s.studentId.toString() === studentId.toString() ||
          s.studentId === studentId
      );

      if (!studentData) return;

      // Iterate through all enrollments (even if payment not confirmed)
      const enrollments = Array.isArray(studentData.enrollments)
        ? studentData.enrollments
        : [];

      enrollments.forEach((enrollment) => {
        // Find the course in this cohort (any status)
        const course = cohort.courses.find(
          (c) =>
            c.courseId &&
            c.courseId._id.toString() === enrollment.courseId.toString()
        );

        if (course?.courseId?.coach) {
          const coach = course.courseId.coach;
          // Add to map to avoid duplicates
          coachMap.set(coach._id.toString(), {
            _id: coach._id,
            fullName: coach.fullName,
            email: coach.email,
            profilePhoto: coach.profilePhoto,
            avgRating: coach.avgRating,
            courseName: course.courseId.name,
            courseStatus: course.status,
          });
        }
      });
    });

    const uniqueCoaches = Array.from(coachMap.values());

    if (!uniqueCoaches.length) {
      return res.status(404).json({
        message: "You have no assigned coaches at the moment.",
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
            // unlocked → include fileUrl
            unlockedMaterials.push({
              cohortId: cohort._id,
              courseId: courseInCohort.courseId,
              ...upload.toObject(),
              fileUrl: upload.fileUrl, // ✅ important
            });
          } else {
            // locked or expired → hide URL
            lockedMaterials.push({
              cohortId: cohort._id,
              courseId: courseInCohort.courseId,
              ...upload.toObject(),
              fileUrl: null,
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

    // Always use UTC for all comparisons
    const now = moment().utc().toDate();

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 1️⃣ Get cohorts the student belongs to
    const cohorts = await Cohort.find({ "studentIds.studentId": studentId })
      .select("studentIds courses")
      .populate({
        path: "studentIds.enrollments.courseId",
        select: "_id name",
      })
      .populate({
        path: "courses.courseId",
        select: "_id name coach",
        populate: { path: "coach", select: "_id fullName profilePhoto email" },
      });

    // 2️⃣ Build list of accessible course IDs
    const allowedCourseIds = [];

    cohorts.forEach((cohort) => {
      const student = cohort.studentIds.find(
        (s) => s.studentId.toString() === studentId
      );
      if (!student?.enrollments) return;

      student.enrollments.forEach((enrollment) => {
        if (enrollment.hasAccess)
          allowedCourseIds.push(enrollment.courseId._id.toString());
      });
    });

    if (!allowedCourseIds.length) {
      return res.status(200).json({
        message: "No accessible course materials",
        unlockedMaterials: [],
        upcomingMaterials: [],
        nextClass: null,
        nextClassCountdown: null,
        lockedMaterialsMessage: "No materials available",
        materialsByCourse: {},
        pagination: { page, limit, total: 0 },
      });
    }

    // 3️⃣ Fetch materials for allowed courses
    const allMaterials = await Material.find({
      course: { $in: allowedCourseIds },
    })
      .populate("course", "_id name coach")
      .sort({ unlockAt: 1 });

    const materialsByCourse = {};
    const unlockedMaterials = [];
    const upcomingMaterials = [];
    let nextClass = null;

    allMaterials.forEach((material) => {
      const unlockTime = moment(material.unlockAt).utc().toDate();
      const expireTime = new Date(unlockTime.getTime() + 3 * 60 * 60 * 1000); // 3 hours

      const isUnlocked = now >= unlockTime && now <= expireTime;
      const isUpcoming = now < unlockTime;

      // Skip expired materials
      if (!isUnlocked && !isUpcoming) return;

      const courseId = material.course._id.toString();

      // Ensure group exists
      if (!materialsByCourse[courseId]) {
        materialsByCourse[courseId] = {
          courseId: material.course._id,
          courseName: material.course.name,
          coach: material.course.coach,
          unlocked: [],
          upcoming: [],
        };
      }

      // Hide fileUrl if within 3-hour class window
      const fileUrl = isUnlocked ? null : material.fileUrl;

      const item = {
        _id: material._id,
        title: material.title,
        type: material.type,
        fileUrl, // hide download if unlocked
        unlockAt: material.unlockAt,
        courseId: { _id: material.course._id, name: material.course.name },
        createdAt: material.createdAt,
      };

      if (isUnlocked) {
        materialsByCourse[courseId].unlocked.push(item);
        unlockedMaterials.push(item);
      } else if (isUpcoming) {
        materialsByCourse[courseId].upcoming.push(item);
        upcomingMaterials.push(item);

        if (!nextClass || moment(item.unlockAt).isBefore(nextClass.unlockAt)) {
          nextClass = item;
        }
      }
    });

    // 4️⃣ Build next class countdown
    let nextClassCountdown = null;
    if (nextClass) {
      const duration = moment.duration(
        moment(nextClass.unlockAt).diff(moment.utc())
      );
      const hours = Math.floor(duration.asHours());
      const minutes = duration.minutes();
      nextClassCountdown = `Next class unlocks in: ${hours}h ${minutes}m`;
    }

    // 5️⃣ Pagination by course groups
    const courseIds = Object.keys(materialsByCourse);
    const paginatedIds = courseIds.slice(skip, skip + limit);

    const paginatedData = {};
    paginatedIds.forEach((id) => {
      paginatedData[id] = materialsByCourse[id];
    });

    res.status(200).json({
      message: "✅ Materials fetched successfully",
      unlockedMaterials,
      upcomingMaterials,
      nextClass,
      nextClassCountdown,
      lockedMaterialsMessage:
        unlockedMaterials.length + upcomingMaterials.length === 0
          ? "No materials available"
          : null,
      materialsByCourse: paginatedData,
      pagination: {
        page,
        limit,
        total: courseIds.length,
      },
    });
  } catch (error) {
    console.error("❌ Could not fetch materials:", error);
    res.status(500).json({
      message: "Could not fetch materials",
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
