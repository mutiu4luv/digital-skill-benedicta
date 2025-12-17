import mongoose from "mongoose";
import selfLearningContent from "../module/selfLearningContent.js";
import selfLearningCourse from "../module/selfLearningCourse.js";
import selfLearningEnrollment from "../module/selfLearningEnrollment.js";

// 📚 Create Self-Learning Course

export const createSelfLearningCourse = async (req, res) => {
  try {
    const { title, description, price } = req.body;
    const coachId = req.user?.id;

    // 🔐 Auth check
    if (!coachId) {
      return res.status(401).json({
        message: "Unauthorized. Please login as a coach.",
      });
    }

    // ✅ Validation
    if (!title || !description || price === undefined) {
      return res.status(400).json({
        message: "Title, description and price are required",
      });
    }

    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({
        message: "Price must be a valid non-negative number",
      });
    }

    // 🚀 Create course
    const course = await selfLearningCourse.create({
      title: title.trim(),
      description: description.trim(),
      price,
      coachId,
    });

    return res.status(201).json({
      message: "Self-learning course created successfully",
      course,
    });
  } catch (error) {
    console.error("❌ Create Self Learning Course Error:", error);

    // 🧠 Handle mongoose validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }

    return res.status(500).json({
      message: "Server error while creating self-learning course",
      error: error.message,
    });
  }
};

// 📚 Add Content to Self-Learning Course

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

// 📚 Register Student for Self-Learning Course
export const registerSelfLearning = async (req, res) => {
  try {
    const studentId = req.user?.id;
    const { courseId } = req.params;

    // 🔐 Auth check
    if (!studentId) {
      return res.status(401).json({
        message: "Unauthorized. Please login.",
      });
    }

    // ✅ Validate input
    if (!courseId) {
      return res.status(400).json({
        message: "Course ID is required",
      });
    }

    // 🔎 Ensure course exists
    const course = await selfLearningCourse.findById(courseId);
    if (!course) {
      return res.status(404).json({
        message: "Self-learning course not found",
      });
    }

    // 🧠 Prevent duplicate enrollment
    const exists = await SelfLearningEnrollment.findOne({
      studentId,
      courseId,
    });

    if (exists) {
      return res.status(400).json({
        message: "Already registered for this course",
      });
    }

    // 🚀 Create enrollment
    const enrollment = await selfLearningEnrollment.create({
      studentId,
      courseId,
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

    // 🧠 Handle mongoose validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }

    // 🧠 Handle duplicate key error (race condition)
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Already registered for this course",
      });
    }

    return res.status(500).json({
      message: "Server error while registering for course",
      error: error.message,
    });
  }
};

// 📚 Confirm Payment for Self-Learning Course
export const confirmPayment = async (req, res) => {
  try {
    const { studentId, courseId } = req.body;
    const adminId = req.user?.id;
    const userRole = req.user?.role;

    // 🔐 Auth & role check (admin / owner / system only)
    if (!adminId) {
      return res.status(401).json({
        message: "Unauthorized. Please login.",
      });
    }

    if (!["admin", "owner"].includes(userRole)) {
      return res.status(403).json({
        message: "You are not allowed to confirm payments",
      });
    }

    // ✅ Validate input
    if (!studentId || !courseId) {
      return res.status(400).json({
        message: "studentId and courseId are required",
      });
    }

    // ✅ Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(studentId) ||
      !mongoose.Types.ObjectId.isValid(courseId)
    ) {
      return res.status(400).json({
        message: "Invalid studentId or courseId",
      });
    }

    // 🔎 Find enrollment
    const enrollment = await selfLearningEnrollment.findOne({
      studentId,
      courseId,
    });

    if (!enrollment) {
      return res.status(404).json({
        message: "Enrollment not found",
      });
    }

    // 🧠 Prevent double confirmation
    if (enrollment.paymentConfirmed) {
      return res.status(400).json({
        message: "Payment already confirmed",
      });
    }

    // 💳 Confirm payment
    enrollment.paid = true;
    enrollment.paymentConfirmed = true;
    enrollment.paidAt = new Date();

    await enrollment.save();

    return res.status(200).json({
      message: "Payment confirmed successfully",
      enrollment,
    });
  } catch (error) {
    console.error("❌ Confirm Payment Error:", error);

    // 🧠 Handle mongoose validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }

    return res.status(500).json({
      message: "Server error while confirming payment",
      error: error.message,
    });
  }
};

// 📚 Get Course Content for Enrolled Student
export const getCourseContent = async (req, res) => {
  try {
    const studentId = req.user?.id;
    const { courseId } = req.params;

    // 🔐 Auth check
    if (!studentId) {
      return res.status(401).json({
        message: "Unauthorized. Please login.",
      });
    }

    // ✅ Validate courseId
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        message: "Invalid course ID",
      });
    }

    // 🔎 Check enrollment & payment
    const enrollment = await selfLearningEnrollment.findOne({
      studentId,
      courseId,
      paymentConfirmed: true,
    });

    if (!enrollment) {
      return res.status(403).json({
        message: "Access denied. Payment required for this course.",
      });
    }

    // 📚 Fetch course content
    const contents = await selfLearningContent.find({ courseId }).sort({
      createdAt: 1,
    }); // optional: keep content ordered

    return res.status(200).json({
      message: "Course content fetched successfully",
      courseId,
      contents,
    });
  } catch (error) {
    console.error("❌ Get Course Content Error:", error);

    // 🧠 Handle mongoose validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }

    return res.status(500).json({
      message: "Server error while fetching course content",
      error: error.message,
    });
  }
};

// 📚 Get Paid Students for a Self-Learning Course
export const getPaidStudents = async (req, res) => {
  try {
    const coachId = req.user?.id;
    const userRole = req.user?.role;
    const { courseId } = req.params;

    // 🔐 Auth check
    if (!coachId) {
      return res.status(401).json({
        message: "Unauthorized. Please login.",
      });
    }

    // 🔒 Only course owner (coach) or admin/owner can view paid students
    if (!["coach", "admin", "owner"].includes(userRole)) {
      return res.status(403).json({
        message: "You are not allowed to view paid students",
      });
    }

    // ✅ Validate courseId
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        message: "Invalid course ID",
      });
    }

    // 🔎 Ensure course exists & belongs to coach (if coach role)
    if (userRole === "coach") {
      const course = await selfLearningCourse.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.coachId.toString() !== coachId.toString()) {
        return res.status(403).json({
          message: "You are not allowed to view students for this course",
        });
      }
    }

    // 📋 Fetch paid students
    const students = await selfLearningEnrollment
      .find({
        courseId,
        paymentConfirmed: true,
      })
      .populate("studentId", "fullName email profilePhoto");

    return res.status(200).json({
      message: "Paid students fetched successfully",
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("❌ Get Paid Students Error:", error);

    // 🧠 Handle mongoose validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }

    return res.status(500).json({
      message: "Server error while fetching paid students",
      error: error.message,
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
