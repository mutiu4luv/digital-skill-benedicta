import mongoose from "mongoose";
import selfLearningCourse from "../module/selfLearningCourse.js";
import selfLearningEnrollment from "../module/selfLearningEnrollment.js";
import selfLearningPayment from "../module/selfLearningPayment.js";
import fs from "fs";
import cloudinary from "../config/cloudnary.js";

export const uploadPaymentProof = async (req, res) => {
  try {
    const studentId = req.user?.id;
    const { courseId } = req.body;

    // 🔐 Auth check
    if (!studentId) {
      return res.status(401).json({
        message: "Unauthorized. Please login.",
      });
    }

    // ✅ Validate courseId
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        message: "Invalid or missing course ID",
      });
    }

    // 📎 Validate file
    if (!req.file || !req.file.path) {
      return res.status(400).json({
        message: "Payment proof file is required",
      });
    }

    // 🔎 Ensure enrollment exists
    const enrollment = await selfLearningEnrollment.findOne({
      studentId,
      courseId,
    });

    if (!enrollment) {
      return res.status(404).json({
        message: "You are not registered for this course",
      });
    }

    // 🧠 Prevent duplicate submission
    const existingProof = await selfLearningPayment.findOne({
      studentId,
      courseId,
      status: { $in: ["pending", "approved"] },
    });

    if (existingProof) {
      return res.status(400).json({
        message: "Payment proof already submitted for this course",
      });
    }

    // ☁️ Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: "self-learning/payments",
      resource_type: "auto", // allows images, pdf, etc.
    });

    // 🧹 Remove local file after upload
    fs.unlinkSync(req.file.path);

    // 💳 Save payment proof
    const payment = await selfLearningPayment.create({
      studentId,
      courseId,
      proofUrl: uploadResult.secure_url,
      cloudinaryId: uploadResult.public_id,
      status: "pending",
      submittedAt: new Date(),
    });

    return res.status(201).json({
      message: "Payment proof submitted successfully. Awaiting approval.",
      payment,
    });
  } catch (error) {
    console.error("❌ Upload Payment Proof Error:", error);

    // Cleanup file if error happens after upload
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }

    return res.status(500).json({
      message: "Server error while uploading payment proof",
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
