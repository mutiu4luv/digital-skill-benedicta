import Cohort from "../module/cohort.js";
import User from "../module/userModule.js";

// paymentController.js
export const confirmPayment = async (req, res) => {
  try {
    const { studentId, courseId } = req.body;

    if (!studentId || !courseId) {
      return res.status(400).json({ message: "Missing studentId or courseId" });
    }

    const user = await User.findById(studentId);
    if (!user) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Ensure registeredCohort exists
    if (!user.registeredCohort) {
      user.registeredCohort = {};
    }

    // Update payment fields
    user.paid = true;
    user.paymentConfirmed = true;

    // Update registeredCohort fields
    user.registeredCohort.courseId = courseId;
    user.registeredCohort.registeredAt =
      user.registeredCohort.registeredAt || new Date();
    // Keeps original date if already set

    const updatedUser = await user.save();

    return res.status(200).json({
      message: "Payment confirmed successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Confirm Payment Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getPaidStudents = async (req, res) => {
  try {
    const students = await User.find({ paid: true }).select(
      "fullName email phoneNumber registeredCohort createdAt"
    );

    return res.status(200).json({ students });
  } catch (err) {
    console.error("Fetch Paid Students Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ADMIN: Confirm Payment for a Student
export const adminConfirmPayment = async (req, res) => {
  try {
    const userId = req.params.id; // student id
    const { courseId } = req.body; // course inside array

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // find course record inside user.courses array
    const courseRecord = user.courses.find(
      (c) => c._id.toString() === courseId
    );

    if (!courseRecord) {
      return res
        .status(404)
        .json({ message: "Course not found for this user" });
    }

    courseRecord.paid = true;
    courseRecord.paymentConfirmed = true;

    await user.save();

    return res.status(200).json({
      message: "Payment successfully confirmed",
      userId,
      courseId,
    });
  } catch (err) {
    console.error("Admin Confirm Payment Error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// GET /api/payment/pending-confirmation
export const getPendingConfirmationStudents = async (req, res) => {
  try {
    const students = await User.find({
      role: "student",
      $or: [{ paid: false }, { paymentConfirmed: false }],
    }).select(
      "fullName email phoneNumber registeredCohort paid paymentConfirmed"
    );

    return res.status(200).json({ students });
  } catch (err) {
    console.error("Fetch Pending Payments Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// COHORT BASED PAYMENT CONFIRMATION

export const confirmCoursePayment = async (req, res) => {
  try {
    const { studentId, cohortId, courseId } = req.body;

    // FIXED: use Cohort model
    const foundCohort = await Cohort.findById(cohortId);
    if (!foundCohort)
      return res.status(404).json({ message: "Cohort not found" });

    // FIX: Normalize studentIds array
    if (!Array.isArray(foundCohort.studentIds)) {
      foundCohort.studentIds = [];
    }

    // Find this student
    let studentEntry = foundCohort.studentIds.find(
      (s) => s.studentId.toString() === studentId.toString()
    );

    // If not found, create
    if (!studentEntry) {
      studentEntry = {
        studentId,
        enrollments: [],
      };
      foundCohort.studentIds.push(studentEntry);
    }

    // Ensure enrollments array exists
    if (!Array.isArray(studentEntry.enrollments)) {
      studentEntry.enrollments = [];
    }

    // Find enrollment for this course
    let enrollment = studentEntry.enrollments.find(
      (e) => e.courseId.toString() === courseId.toString()
    );

    if (!enrollment) {
      // New Enrollment
      studentEntry.enrollments.push({
        courseId,
        paid: true,
        paymentConfirmed: true,
        hasAccess: true,
        paidAt: new Date(),
      });
    } else {
      // Update existing enrollment
      enrollment.paid = true;
      enrollment.paymentConfirmed = true;
      enrollment.hasAccess = true;
      enrollment.paidAt = new Date();
    }

    await foundCohort.save();

    return res.status(200).json({
      message: "Payment confirmed, access granted.",
      cohort: foundCohort,
    });
  } catch (error) {
    console.error("Payment Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// CHECK ACCESS BASED ON PAYMENT AND ENROLLMENT

export const checkAccess = async (req, res) => {
  const { cohortId, studentId, courseId } = req.params;

  const cohort = await Cohort.findById(cohortId);
  if (!cohort) return res.status(404).json({ access: false });

  const student = cohort.studentIds.find(
    (s) => s.studentId.toString() === studentId
  );
  if (!student) return res.status(403).json({ access: false });

  const enrollment = student.enrollments.find(
    (e) => e.courseId.toString() === courseId
  );

  if (!enrollment || !enrollment.hasAccess) {
    return res.status(403).json({ access: false });
  }

  return res.status(200).json({ access: true });
};
