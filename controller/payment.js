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
    const { cohortId, courseId, studentId } = req.body;

    const foundCohort = await Cohort.findById(cohortId);
    if (!foundCohort)
      return res.status(404).json({ message: "Cohort not found" });

    let studentEntry = foundCohort.studentIds.find(
      (s) => s.studentId.toString() === studentId.toString()
    );
    if (!studentEntry)
      return res
        .status(404)
        .json({ message: "Student not found in this cohort" });

    let enrollment = studentEntry.enrollments.find(
      (e) => e.courseId.toString() === courseId.toString()
    );
    if (!enrollment)
      return res.status(404).json({ message: "Enrollment not found" });

    // ✅ Admin confirms payment
    enrollment.paymentConfirmed = true;
    enrollment.hasAccess = true;

    await foundCohort.save();

    return res.status(200).json({
      message: "Payment confirmed by admin. Student now has access.",
    });
  } catch (error) {
    console.error("Admin Payment Confirmation Error:", error);
    res.status(500).json({ message: "Server error" });
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
    const { cohortId, courseId } = req.body;
    const studentId = req.user.id; // secure ✔

    const foundCohort = await Cohort.findById(cohortId);
    if (!foundCohort)
      return res.status(404).json({ message: "Cohort not found" });

    if (!Array.isArray(foundCohort.studentIds)) {
      foundCohort.studentIds = [];
    }

    // Find student entry
    let studentEntry = foundCohort.studentIds.find(
      (s) => s.studentId.toString() === studentId.toString()
    );

    if (!studentEntry) {
      studentEntry = {
        studentId,
        enrollments: [],
      };
      foundCohort.studentIds.push(studentEntry);
    }

    if (!Array.isArray(studentEntry.enrollments)) {
      studentEntry.enrollments = [];
    }

    // Find enrollment for this course
    let enrollment = studentEntry.enrollments.find(
      (e) => e.courseId.toString() === courseId.toString()
    );

    if (!enrollment) {
      // ✅ Student submitted payment, but admin must confirm
      studentEntry.enrollments.push({
        courseId,
        paid: true,
        paymentConfirmed: false, // initially false
        hasAccess: false, // initially false
        paidAt: new Date(),
      });
    } else {
      // Update existing enrollment
      enrollment.paid = true;
      enrollment.paymentConfirmed = false; // reset in case admin needs to confirm
      enrollment.hasAccess = false; // reset access
      enrollment.paidAt = new Date();
    }

    await foundCohort.save();

    return res.status(200).json({
      message:
        "Payment submitted. Waiting for admin confirmation to grant access.",
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
