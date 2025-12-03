import Assignment from "../module/cohortAssignment.js";
import Cohort from "../module/cohort.js";
import cloudinary from "../config/cloudnary.js";
import fs from "fs";

// Controller to create an assignment with optional file upload
export const createCohortAssignment = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { cohortId, title, description, dueDate } = req.body;

    if (!cohortId || !title) {
      return res
        .status(400)
        .json({ message: "cohortId and title are required" });
    }

    const cohort = await Cohort.findById(cohortId);
    if (!cohort) return res.status(404).json({ message: "Cohort not found" });

    const courseInCohort = cohort.courses.find(
      (c) => c.coachId.toString() === coachId
    );

    if (!courseInCohort) {
      return res.status(403).json({
        message: "You do not have any course in this cohort",
      });
    }

    if (courseInCohort.status === "completed") {
      return res.status(403).json({
        message:
          "Cannot create assignment because this course has been completed",
      });
    }

    // ✅ Upload file to Cloudinary if exists
    let fileUrl = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "assignments", // optional: organize in a folder
        resource_type: "auto", // supports all file types
      });
      fileUrl = result.secure_url;

      // Optionally delete the local file after uploading
      fs.unlinkSync(req.file.path);
    }

    const assignment = await Assignment.create({
      title,
      description,
      cohortId,
      courseId: courseInCohort.courseId,
      coachId,
      dueDate,
      file: fileUrl, // store cloudinary URL in DB
    });

    return res.status(201).json({
      message: "Assignment created successfully",
      assignment,
    });
  } catch (err) {
    console.error("Create Assignment Error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// student assignments get controller
export const getStudentAssignments = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Get all cohorts where the student is enrolled
    const cohorts = await Cohort.find({
      "studentIds.studentId": studentId,
    });

    if (!cohorts.length) {
      return res
        .status(404)
        .json({ message: "You are not enrolled in any cohort" });
    }

    let allowedAssignments = [];

    const now = new Date();

    for (const cohort of cohorts) {
      // Skip cohorts that have ended
      if (cohort.endDate && cohort.endDate < now) continue;

      const student = cohort.studentIds.find(
        (s) => s.studentId.toString() === studentId.toString()
      );

      // Only allow courses where student hasAccess true
      const allowedCourseIds = student.enrollments
        .filter((e) => e.hasAccess)
        .map((e) => e.courseId.toString());

      if (allowedCourseIds.length === 0) continue;

      const assignments = await Assignment.find({
        cohortId: cohort._id,
        courseId: { $in: allowedCourseIds },
      })
        .populate("courseId", "name category duration")
        .populate("coachId", "fullName")
        .sort({ updatedAt: -1 });

      const formattedAssignments = assignments.map((a) => {
        const submission = a.submissions.find(
          (s) => s.studentId?.toString() === studentId.toString()
        );

        return {
          assignmentId: a._id,
          title: a.title,
          description: a.description,
          courseName: a.courseId?.name || "N/A",
          dueDate: a.dueDate,
          file: submission?.file || null,
          status: submission ? "Submitted" : "Pending",
          grade: submission?.grade || "-",
          updatedAt: a.updatedAt,
        };
      });

      // Move submitted assignments to the bottom
      formattedAssignments.sort((a, b) => {
        if (a.status === "Submitted" && b.status !== "Submitted") return 1;
        if (b.status === "Submitted" && a.status !== "Submitted") return -1;
        return b.updatedAt - a.updatedAt;
      });

      allowedAssignments.push(...formattedAssignments);
    }

    return res.status(200).json({ assignments: allowedAssignments });
  } catch (err) {
    console.error("Get Student Assignments Error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// submit assignment by student
export const submitAssignment = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { assignmentId } = req.params;
    const file = req.file;

    if (!assignmentId) {
      return res.status(400).json({ message: "Assignment ID is required" });
    }

    if (!file) {
      return res.status(400).json({ message: "Submission file is required" });
    }

    // 1️⃣ Find assignment
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const now = new Date();

    // 2️⃣ Check expiry
    if (assignment.dueDate && assignment.dueDate < now) {
      return res.status(403).json({
        message: "Assignment has expired! Please submit before the due date.",
      });
    }

    // 3️⃣ Check if student already submitted
    const alreadySubmitted = assignment.submissions.some(
      (s) => s.studentId?.toString() === studentId
    );

    if (alreadySubmitted) {
      return res.status(400).json({
        message: "You have already submitted this assignment",
      });
    }

    // 4️⃣ Upload submission to Cloudinary
    const result = await cloudinary.uploader.upload(file.path, {
      folder: "assignment_submissions",
      resource_type: "auto", // supports all file types
    });

    // Delete local file after upload
    fs.unlinkSync(file.path);

    // 5️⃣ Save submission in DB
    assignment.submissions.push({
      studentId: studentId,
      file: result.secure_url, // Cloudinary URL
      submittedAt: now,
      grade: null,
    });

    await assignment.save();

    return res.status(200).json({
      message: "Assignment submitted successfully!",
      file: result.secure_url,
      submittedAt: now,
    });
  } catch (err) {
    console.error("Submit Assignment Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
// GET ASSIGNMENTS SUBMITTED BY STUDENTS FOR A COACH
export const getCoachAssignments = async (req, res) => {
  try {
    const coachId = req.user.id;

    // Get all assignments created by this coach
    const assignments = await Assignment.find({ coachId })
      .populate("submissions.studentId", "fullName email")
      .populate("cohortId", "cohortName")
      .populate("courseId", "name category duration");

    // Collect every submission in a flat array
    const allSubmissions = [];

    assignments.forEach((a) => {
      if (a.submissions && a.submissions.length > 0) {
        a.submissions.forEach((s) => {
          allSubmissions.push({
            assignmentId: a._id,
            title: a.title,
            description: a.description,
            dueDate: a.dueDate,
            cohort: a.cohortId?.cohortName || "N/A",
            courseName: a.courseId?.name || "N/A",

            student: s.studentId
              ? {
                  _id: s.studentId._id,
                  fullName: s.studentId.fullName,
                  email: s.studentId.email,
                }
              : {
                  _id: null,
                  fullName: "Unknown Student",
                  email: null,
                },

            studentId: s.studentId?._id || null,
            file: s.file || null,

            grade: s.grade !== undefined ? s.grade : null,
            feedback: s.feedback ?? null,
            submittedAt: s.submittedAt,
            submissionId: s._id,
          });
        });
      }
    });

    // Sort submissions by most recent first
    allSubmissions.sort(
      (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
    );

    // Only keep assignments that have submissions
    const submittedAssignments = assignments.filter(
      (a) => a.submissions && a.submissions.length > 0
    );

    // Group assignments by cohort
    const assignmentsByCohort = {};
    submittedAssignments.forEach((a) => {
      const cohortName = a.cohortId?.cohortName || "No Cohort";
      if (!assignmentsByCohort[cohortName])
        assignmentsByCohort[cohortName] = [];
      assignmentsByCohort[cohortName].push(a);
    });

    return res.status(200).json({
      assignmentsByCohort, // assignments grouped by cohort name
      submissions: allSubmissions, // all submissions flat array
    });
  } catch (err) {
    console.error("Error fetching coach assignments:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// export const getCoachAssignments = async (req, res) => {
//   try {
//     const coachId = req.user.id;

//     // Get all assignments created by this coach
//     const assignments = await Assignment.find({ coachId })
//       .populate("submissions.studentId", "fullName email")
//       .populate("cohortId", "cohortName")
//       .populate("courseId", "name category duration");

//     // Collect every submission in a flat array
//     const allSubmissions = [];

//     assignments.forEach((a) => {
//       // Only process assignments that have submissions
//       if (a.submissions && a.submissions.length > 0) {
//         a.submissions.forEach((s) => {
//           allSubmissions.push({
//             assignmentId: a._id,
//             title: a.title,
//             description: a.description,
//             dueDate: a.dueDate,
//             cohort: a.cohortId?.cohortName || "N/A",
//             courseName: a.courseId?.name || "N/A",

//             student: s.studentId
//               ? {
//                   _id: s.studentId._id,
//                   fullName: s.studentId.fullName,
//                   email: s.studentId.email,
//                 }
//               : {
//                   _id: null,
//                   fullName: "Unknown Student",
//                   email: null,
//                 },

//             studentId: s.studentId?._id || null,
//             file: s.file || null,

//             grade: s.grade !== undefined ? s.grade : null,
//             feedback: s.feedback ?? null,
//             submittedAt: s.submittedAt,
//             submissionId: s._id,
//           });
//         });
//       }
//     });

//     // Sort submissions by most recent first
//     allSubmissions.sort(
//       (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
//     );

//     // Return only assignments that have submissions
//     const submittedAssignments = assignments.filter(
//       (a) => a.submissions && a.submissions.length > 0
//     );

//     return res.status(200).json({
//       assignments: submittedAssignments,
//       submissions: allSubmissions,
//     });
//   } catch (err) {
//     console.error("Error fetching coach assignments:", err);
//     return res.status(500).json({
//       message: "Server error",
//       error: err.message,
//     });
//   }
// };

// ✅ Coach grades a student submission
export const submitAssignmentGrade = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { assignmentId, studentId } = req.params;
    const { grade } = req.body;

    if (grade === undefined || grade === null) {
      return res.status(400).json({ message: "Grade is required" });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment)
      return res.status(404).json({ message: "Assignment not found" });

    // Optional: Ensure only the coach who created the assignment can grade
    if (assignment.coachId.toString() !== coachId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Find the student's submission
    const submission = assignment.submissions.find(
      (s) => s.studentId?.toString() === studentId
    );

    if (!submission) {
      return res.status(404).json({ message: "Student submission not found" });
    }

    // Update grade
    submission.grade = grade;
    submission.gradedAt = new Date();

    await assignment.save();

    return res.status(200).json({
      message: "Grade submitted successfully",
      updatedSubmission: submission,
    });
  } catch (err) {
    console.error("Submit Grade Error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};
