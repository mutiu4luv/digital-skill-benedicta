import mongoose from "mongoose";
import selfLearningCourse from "../module/selfLearningCourse.js";
import selfLearningEnrollment from "../module/selfLearningEnrollment.js";
import selfLearningPayment from "../module/selfLearningPayment.js";
import fs from "fs";
import cloudinary from "../config/cloudnary.js";

export const uploadPaymentProof = async (req, res) => {
  console.log("📥 uploadPaymentProof hit");
  console.log("User:", req.user);
  console.log("Body:", req.body);
  console.log("File:", req.file);
  try {
    const studentId = req.user?.id;
    const { courseId } = req.body;

    if (!studentId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid or missing course ID" });
    }

    // ✅ FIX: validate file correctly
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        message: "Payment proof file is required",
      });
    }

    // Ensure enrollment exists
    const enrollment = await selfLearningEnrollment.findOne({
      studentId,
      courseId,
    });

    if (!enrollment) {
      return res.status(404).json({
        message: "You are not registered for this course",
      });
    }

    // Prevent duplicate submission
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

    // ☁️ Upload buffer to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "self-learning/payments",
            resource_type: "auto",
          },
          (error, result) => {
            if (error) reject(error);
            resolve(result);
          }
        )
        .end(req.file.buffer);
    });

    // Save payment proof
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
    const { studentId, courseId, action } = req.body;
    const adminId = req.user?.id;
    const userRole = req.user?.role;

    // 🔐 Auth & role check
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!["admin", "owner"].includes(userRole)) {
      return res.status(403).json({
        message: "You are not allowed to confirm payments",
      });
    }

    // ✅ Validate input
    if (!studentId || !courseId || !action) {
      return res.status(400).json({
        message: "studentId, courseId and action are required",
      });
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        message: "Invalid action. Use approve or reject",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(studentId) ||
      !mongoose.Types.ObjectId.isValid(courseId)
    ) {
      return res.status(400).json({
        message: "Invalid studentId or courseId",
      });
    }

    // 🔎 Find payment proof
    const payment = await selfLearningPayment.findOne({
      studentId,
      courseId,
      status: "pending",
    });

    if (!payment) {
      return res.status(404).json({
        message: "Pending payment proof not found",
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

    // ✅ APPROVE
    if (action === "approve") {
      payment.status = "approved";
      payment.reviewedAt = new Date();
      payment.reviewedBy = adminId;

      enrollment.paid = true;
      enrollment.paymentConfirmed = true;
      enrollment.paidAt = new Date();

      await payment.save();
      await enrollment.save();

      return res.status(200).json({
        message: "Payment approved successfully",
        status: "approved",
        enrollment,
        payment,
      });
    }

    // ❌ REJECT
    payment.status = "rejected";
    payment.reviewedAt = new Date();
    payment.reviewedBy = adminId;

    await payment.save();

    return res.status(200).json({
      message: "Payment rejected",
      status: "rejected",
      payment,
    });
  } catch (error) {
    console.error("❌ Confirm Payment Error:", error);

    return res.status(500).json({
      message: "Server error while confirming payment",
      error: error.message,
    });
  }
};
// 📚 Get Pending Payments for Self-Learning Courses
export const getPendingPayments = async (req, res) => {
  try {
    if (!["admin", "owner"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const payments = await selfLearningPayment
      .find({ status: "pending" })
      .populate("studentId", "fullName email")
      .populate("courseId", "title");

    res.status(200).json({
      payments: payments.map((p) => ({
        _id: p._id,
        proofUrl: p.proofUrl,
        status: p.status,
        student: p.studentId,
        course: p.courseId,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load payments" });
  }
};
