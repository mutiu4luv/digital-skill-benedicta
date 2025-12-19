import mongoose from "mongoose";
import selfLearningContent from "../module/selfLearningContent.js";
import selfLearningCourse from "../module/selfLearningCourse.js";
import selfLearningEnrollment from "../module/selfLearningEnrollment.js";
import cloudinary from "../config/cloudnary.js";

// 📚 Create Self-Learning Course

export const createSelfLearningCourse = async (req, res) => {
  try {
    const { title, description, price, coachId: selectedCoachId } = req.body;
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // 🔐 Determine coach
    let coachId = userId;

    if (["admin", "owner"].includes(role)) {
      if (!selectedCoachId) {
        return res.status(400).json({
          message: "Coach is required",
        });
      }
      coachId = selectedCoachId;
    }

    if (!title || !description || price === undefined) {
      return res.status(400).json({
        message: "Title, description and price are required",
      });
    }

    // 🚀 Create course
    const createdCourse = await selfLearningCourse.create({
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      coachId,
    });

    // 🔁 Re-fetch with coach populated
    const course = await selfLearningCourse
      .findById(createdCourse._id)
      .populate("coachId", "fullName email profilePhoto");

    return res.status(201).json({
      message: "Self-learning course created successfully",
      course,
    });
  } catch (error) {
    console.error("❌ Create Course Error:", error);

    return res.status(500).json({
      message: "Server error while creating course",
    });
  }
};

// 📚coach upload document Content to Self-Learning Course for students to see

export const addContent = async (req, res) => {
  try {
    const { type, title, url } = req.body;
    const { courseId } = req.params;
    const coachId = req.user?.id;

    if (!coachId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    if (!type || !title) {
      return res.status(400).json({
        message: "Type and title are required",
      });
    }

    const allowedTypes = ["video", "document", "link"];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        message: `Invalid type. Allowed: ${allowedTypes.join(", ")}`,
      });
    }

    const course = await selfLearningCourse.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.coachId.toString() !== coachId.toString()) {
      return res.status(403).json({
        message:
          "You are not allowed to add content to this course,kindly select your course",
      });
    }

    let finalUrl = "";

    // 📌 CASE 1: FILE upload (document or video)
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: "self-learning/content",
              resource_type: "auto", // video / pdf / doc
            },
            (error, result) => {
              if (error) reject(error);
              resolve(result);
            }
          )
          .end(req.file.buffer);
      });

      finalUrl = uploadResult.secure_url;
    }

    // 📌 CASE 2: URL (for link type)
    if (!finalUrl && url) {
      finalUrl = url.trim();
    }

    // ❌ MUST have either file OR url
    if (!finalUrl) {
      return res.status(400).json({
        message: "Provide either a file upload or a URL",
      });
    }

    const content = await selfLearningContent.create({
      courseId,
      type,
      title: title.trim(),
      url: finalUrl,
    });

    return res.status(201).json({
      message: "Content added successfully",
      content,
    });
  } catch (error) {
    console.error("❌ Add Content Error:", error);
    return res.status(500).json({
      message: "Server error while adding content",
    });
  }
};

// 📚 Get Course Content for Coach
export const getCourseContent = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { courseId } = req.params;

    // 🚫 Only coaches allowed
    if (userRole !== "coach") {
      return res.status(403).json({
        message: "Access denied. Coaches only.",
      });
    }

    // ✅ Fetch only content uploaded by THIS coach
    const contents = await selfLearningContent
      .find({
        courseId,
        coachId: userId,
      })
      .sort({ createdAt: 1 });

    // 🚫 Coach selected a course they don't own
    if (!contents || contents.length === 0) {
      return res.status(403).json({
        message:
          "You do not have access to this course. Please select a course assigned to you.",
      });
    }

    return res.status(200).json({ contents });
  } catch (error) {
    console.error("❌ Get Course Content Error:", error);
    return res.status(500).json({
      message: "Failed to load course content",
    });
  }
};

// 📚 Register Student for Self-Learning Course
export const registerSelfLearning = async (req, res) => {
  try {
    const studentId = req.user?.id;
    const { courseId } = req.params;

    if (!studentId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    const course = await selfLearningCourse.findById(courseId);
    if (!course) {
      return res.status(404).json({
        message: "Self-learning course not found",
      });
    }

    // 🔎 Check existing enrollment
    const existingEnrollment = await selfLearningEnrollment.findOne({
      studentId,
      courseId,
    });

    // ❌ Block only if ACTIVE
    if (existingEnrollment && existingEnrollment.status === "active") {
      return res.status(400).json({
        message: "You are already enrolled in this course",
      });
    }

    // 🔁 Allow retry if pending (cleanup)
    if (existingEnrollment && existingEnrollment.status === "pending") {
      await existingEnrollment.deleteOne();
    }

    // 🚀 Create TEMP enrollment
    const enrollment = await selfLearningEnrollment.create({
      studentId,
      courseId,
      status: "pending",
      paid: false,
      paymentConfirmed: false,
      registeredAt: new Date(),
    });

    return res.status(201).json({
      message: "Registered successfully. Awaiting payment.",
      enrollment,
    });
  } catch (error) {
    console.error("❌ Register Self Learning Error:", error);

    return res.status(500).json({
      message: "Server error while registering",
    });
  }
};

// 📚 Get Course Content for Enrolled Student

export const getCourseContentForStudent = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    // ✅ Student must be enrolled AND payment confirmed
    const enrollment = await selfLearningEnrollment.findOne({
      studentId,
      courseId,
      paymentConfirmed: true,
    });

    if (!enrollment) {
      return res.status(403).json({
        message: "You must complete payment to access this course",
      });
    }

    // ✅ Fetch course content uploaded by coaches
    const contents = await selfLearningContent
      .find({ courseId })
      .select("title type url createdAt")
      .sort({ createdAt: 1 });

    res.status(200).json({ contents });
  } catch (error) {
    console.error("❌ Student content fetch error:", error);
    res.status(500).json({ message: "Failed to load course materials" });
  }
};

// 📚 Get All Self-Learning Courses
export const getSelfLearningCourses = async (req, res) => {
  try {
    const courses = await selfLearningCourse
      .find()
      .populate("coachId", "fullName profilePhoto");

    res.status(200).json({
      courses,
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to load self-learning courses",
    });
  }
};
// my paid courses
export const getMyPaidSelfLearningCourses = async (req, res) => {
  try {
    const studentId = req.user.id;

    const enrollments = await selfLearningEnrollment
      .find({
        studentId,
        paymentConfirmed: true,
      })
      .populate({
        path: "courseId",
        populate: {
          path: "coachId",
          select: "fullName profilePhoto",
        },
      });

    const courses = enrollments
      .filter((e) => e.courseId) // guard deleted courses
      .map((e) => ({
        enrollmentId: e._id,
        courseId: e.courseId._id,
        title: e.courseId.title,
        description: e.courseId.description,
        price: e.courseId.price,
        coach: e.courseId.coachId,
        paidAt: e.paidAt,
      }));

    return res.json({ courses });
  } catch (error) {
    console.error("❌ Get My Paid Courses Error:", error);
    res.status(500).json({ message: "Failed to load paid courses" });
  }
};

// 📚 Delete Self-Learning Course by owner
export const deleteSelfLearningCourse = async (req, res) => {
  try {
    const coachId = req.user?.id;
    const { contentId } = req.params;

    const content = await selfLearningContent.findById(contentId);
    if (!content) {
      return res.status(404).json({ message: "Content not found" });
    }

    const course = await selfLearningCourse.findById(content.courseId);
    if (!course || course.coachId.toString() !== coachId.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    // delete from Cloudinary
    if (content.cloudinaryId) {
      await cloudinary.uploader.destroy(content.cloudinaryId, {
        resource_type: "auto",
      });
    }

    await content.deleteOne();

    res.json({ message: "Content deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// delete self learning  course created by coach
export const deleteSelfLearningContent = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { contentId } = req.params;

  const content = await selfLearningContent.findById(contentId);
  if (!content) {
    return res.status(404).json({ message: "Content not found" });
  }

  const course = await selfLearningCourse.findById(content.courseId);
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  if (
    userRole !== "owner" &&
    (!course.coachId || course.coachId.toString() !== userId.toString())
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  await content.deleteOne();
  res.json({ message: "Content deleted successfully" });
};
