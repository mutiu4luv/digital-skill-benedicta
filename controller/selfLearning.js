import mongoose from "mongoose";
import selfLearningContent from "../module/selfLearningContent.js";
import selfLearningCourse from "../module/selfLearningCourse.js";
import selfLearningEnrollment from "../module/selfLearningEnrollment.js";

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

// 📚 upload document Content to Self-Learning Course for students to see

export const addContent = async (req, res) => {
  try {
    const { type, title, url } = req.body;
    const { courseId } = req.params;
    const coachId = req.user?.id;

    // 🔐 Auth check
    if (!coachId) {
      return res.status(401).json({
        message: "Unauthorized. Please login.",
      });
    }

    // ✅ Validate courseId
    if (!courseId) {
      return res.status(400).json({
        message: "Course ID is required",
      });
    }

    // ✅ Validate content fields
    if (!type || !title || !url) {
      return res.status(400).json({
        message: "Type, title and url are required",
      });
    }

    const allowedTypes = ["video", "document", "link"];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        message: `Invalid content type. Allowed: ${allowedTypes.join(", ")}`,
      });
    }

    // 🔎 Confirm course exists & belongs to coach
    const course = await selfLearningCourse.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.coachId.toString() !== coachId.toString()) {
      return res.status(403).json({
        message: "You are not allowed to add content to this course",
      });
    }

    // 🚀 Create content
    const content = await selfLearningContent.create({
      courseId,
      type,
      title: title.trim(),
      url: url.trim(),
    });

    return res.status(201).json({
      message: "Content added successfully",
      content,
    });
  } catch (error) {
    console.error("❌ Add Self Learning Content Error:", error);

    // 🧠 Handle mongoose validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }

    return res.status(500).json({
      message: "Server error while adding content",
      error: error.message,
    });
  }
};
// 📚 Get Course Content for Coach
export const getCoachCourseContent = async (req, res) => {
  const coachId = req.user?.id;
  const { courseId } = req.params;

  const course = await selfLearningCourse.findById(courseId);

  if (!course || course.coachId.toString() !== coachId.toString()) {
    return res.status(403).json({ message: "Access denied" });
  }

  const contents = await selfLearningContent.find({ courseId });
  res.json({ contents });
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
    const studentId = req.user?.id;
    const { courseId } = req.params;

    if (!studentId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    // ✅ CHECK: student must be enrolled AND paid
    const enrollment = await selfLearningEnrollment.findOne({
      studentId,
      courseId,
      paymentConfirmed: true,
    });

    if (!enrollment) {
      return res.status(403).json({
        message: "You are not enrolled in this course",
      });
    }

    // ✅ Fetch ONLY this course content
    const contents = await selfLearningContent
      .find({ courseId })
      .sort({ createdAt: 1 });

    return res.status(200).json({
      contents,
    });
  } catch (error) {
    console.error("❌ Fetch Course Content Error:", error);
    res.status(500).json({
      message: "Failed to load course content",
    });
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
// 📚 Delete Self-Learning Course
export const deleteSelfLearningCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await selfLearningCourse.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    await course.deleteOne();

    res.status(200).json({
      message: "Self-learning course deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to delete course",
    });
  }
};
