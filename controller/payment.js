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

// ADMIN: Confirm Payment for cohort Student

export const adminConfirmPayment = async (req, res) => {
  try {
    const { cohortId, courseId } = req.body;
    const studentId = req.params.id;

    const foundCohort = await Cohort.findById(cohortId);
    if (!foundCohort)
      return res.status(404).json({ message: "Cohort not found" });

    // Log for debugging
    console.log("foundCohort.studentIds:", foundCohort.studentIds);

    const studentEntry = foundCohort.studentIds.find((s) => {
      // Support both plain ObjectId and nested studentId
      const id = s.studentId ? s.studentId.toString() : s._id?.toString();
      return id === studentId;
    });

    if (!studentEntry)
      return res
        .status(404)
        .json({ message: "Student not found in this cohort" });

    const enrollment = studentEntry.enrollments?.find(
      (e) => e.courseId.toString() === courseId.toString()
    );

    if (!enrollment)
      return res.status(404).json({ message: "Enrollment not found" });

    // ✅ Confirm payment
    enrollment.paymentConfirmed = true;
    enrollment.hasAccess = true;
    enrollment.paid = true;

    await foundCohort.save();

    return res.status(200).json({
      message: "Payment confirmed by admin. Student now has access.",
    });
  } catch (error) {
    console.error("Admin Payment Confirmation Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
// ADMIN: Reject Payment for cohort Student
export const adminRejectPayment = async (req, res) => {
  try {
    const { cohortId, courseId, reason } = req.body;
    const studentId = req.params.id;

    const cohort = await Cohort.findById(cohortId);
    if (!cohort) return res.status(404).json({ message: "Cohort not found" });

    const studentEntry = cohort.studentIds.find(
      (s) => s.studentId.toString() === studentId
    );
    if (!studentEntry)
      return res.status(404).json({ message: "Student not found" });

    const enrollment = studentEntry.enrollments.find(
      (e) => e.courseId.toString() === courseId
    );
    if (!enrollment)
      return res.status(404).json({ message: "Enrollment not found" });

    enrollment.paid = false;
    enrollment.paymentConfirmed = false;
    enrollment.paymentStatus = "rejected";
    enrollment.hasAccess = false;
    enrollment.rejectionReason = reason;

    await cohort.save();

    res.status(200).json({ message: "Payment rejected successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/payment/pending-confirmation
export const getPendingConfirmationStudents = async (req, res) => {
  try {
    const cohorts = await Cohort.find({
      "studentIds.enrollments.paymentConfirmed": false,
    })
      .populate("studentIds.studentId", "fullName email phoneNumber")
      .populate("studentIds.enrollments.courseId", "name");

    const pendingStudents = [];

    cohorts.forEach((cohort) => {
      cohort.studentIds.forEach((student) => {
        // 🚨 Guard against deleted users
        if (!student.studentId) return;

        student.enrollments.forEach((enrollment) => {
          // ✅ ONLY REAL PENDING PAYMENTS
          if (
            enrollment.paymentConfirmed === true ||
            enrollment.paymentStatus === "rejected"
          ) {
            return;
          }

          pendingStudents.push({
            _id: student.studentId._id,
            fullName: student.studentId.fullName,
            email: student.studentId.email,
            phoneNumber: student.studentId.phoneNumber,

            paid: enrollment.paid,
            paymentConfirmed: enrollment.paymentConfirmed,
            paymentStatus: enrollment.paymentStatus || "pending",

            registeredCohort: {
              cohortId: cohort._id,
              courseId: enrollment.courseId?._id || null,
              courseName: enrollment.courseId?.name || "-",
              registeredAt:
                enrollment.registeredAt || enrollment.paidAt || null,
              proofOfPayment: enrollment.proofOfPayment
                ? {
                    url: enrollment.proofOfPayment.url || "",
                    publicId: enrollment.proofOfPayment.publicId || "",
                  }
                : null,
            },
          });
        });
      });
    });

    return res.status(200).json({
      count: pendingStudents.length,
      students: pendingStudents,
    });
  } catch (err) {
    console.error("Fetch Pending Payments Error:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// export const getPendingConfirmationStudents = async (req, res) => {
//   try {
//     const cohorts = await Cohort.find({
//       "studentIds.enrollments.paymentConfirmed": false,
//     })
//       .populate("studentIds.studentId", "fullName email phoneNumber")
//       .populate("studentIds.enrollments.courseId", "name");

//     const pendingStudents = [];

//     cohorts.forEach((cohort) => {
//       cohort.studentIds.forEach((student) => {
//         // 🔴 CRITICAL GUARD: skip broken references
//         if (!student.studentId) return;

//         student.enrollments.forEach((enrollment) => {
//           // skip confirmed payments
//           if (enrollment.paymentConfirmed) return;

//           pendingStudents.push({
//             // Use both studentId and courseId for uniqueness if needed
//             _id: student.studentId._id,
//             fullName: student.studentId.fullName,
//             email: student.studentId.email,
//             phoneNumber: student.studentId.phoneNumber,

//             paid: enrollment.paid,
//             paymentConfirmed: enrollment.paymentConfirmed,

//             registeredCohort: {
//               cohortId: cohort._id,
//               courseId: enrollment.courseId?._id || null,
//               courseName: enrollment.courseId?.name || "-",
//               registeredAt:
//                 enrollment.registeredAt || enrollment.paidAt || null,
//               proofOfPayment: enrollment.proofOfPayment
//                 ? {
//                     url: enrollment.proofOfPayment.url || "",
//                     publicId: enrollment.proofOfPayment.publicId || "",
//                   }
//                 : null,
//             },
//           });
//         });
//       });
//     });

//     return res.status(200).json({ students: pendingStudents });
//   } catch (err) {
//     console.error("Fetch Pending Payments Error:", err);
//     return res.status(500).json({ message: "Server Error" });
//   }
// };

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
        paid: false,
        paymentConfirmed: false, // initially false
        hasAccess: false, // initially false
        paidAt: new Date(),
      });
    } else {
      // Update existing enrollment
      enrollment.paid = false;
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
