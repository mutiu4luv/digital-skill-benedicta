import Assignment from "../module/cohortAssignment.js";
import Cohort from "../module/cohort.js";
import cloudinary from "../config/cloudnary.js";
import mongoose from "mongoose";
import fs from "fs";

const toEndOfDay = (date) => {
  if (!date) return date;

  const dueDate = new Date(date);
  dueDate.setHours(23, 59, 59, 999);
  return dueDate;
};

const deleteLocalFile = (filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return;
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error("Delete local assignment file error:", err);
  }
};

const studentHasAssignmentAccess = async (assignment, studentId) => {
  const cohort = await Cohort.findOne({
    _id: assignment.cohortId,
    "studentIds.studentId": studentId,
  });

  if (!cohort) return false;

  const student = cohort.studentIds.find(
    (s) => s.studentId?.toString() === studentId.toString()
  );

  return Boolean(
    student?.enrollments?.some(
      (enrollment) =>
        enrollment.courseId?.toString() === assignment.courseId.toString() &&
        enrollment.hasAccess
    )
  );
};

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
      dueDate: toEndOfDay(dueDate),
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

    // Find all cohorts the student belongs to
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
      // Skip ended cohorts
      if (cohort.endDate && cohort.endDate < now) continue;

      const student = cohort.studentIds.find(
        (s) => s.studentId.toString() === studentId.toString()
      );

      if (!student) continue;

      // Only allow courses where student hasAccess
      const allowedCourseIds =
        student.enrollments
          ?.filter((e) => e.hasAccess)
          ?.map((e) => e.courseId.toString()) || [];

      if (allowedCourseIds.length === 0) continue;

      // Fetch assignments only for eligible courses
      const assignments = await Assignment.find({
        cohortId: cohort._id,
        courseId: { $in: allowedCourseIds },
      })
        .populate("courseId", "name category duration")
        .populate("coachId", "fullName")
        .sort({ updatedAt: -1 });

      const formattedAssignments = assignments.map((a) => {
        const submission = a.submissions?.find(
          (s) => s.studentId?.toString() === studentId.toString()
        );

        const dueDate = toEndOfDay(a.dueDate);

        return {
          assignmentId: a._id,
          title: a.title,
          description: a.description,
          courseName: a.courseId?.name || "N/A",
          dueDate,
          file: submission?.file || submission?.files?.[0] || null,
          files:
            Array.isArray(submission?.files) && submission.files.length > 0
              ? submission.files
              : submission?.file
              ? [submission.file]
              : [],
          status: submission ? "Submitted" : "Pending",
          grade: submission?.grade || "-",
          updatedAt: a.updatedAt,
        };
      });

      // Submitted assignments move to bottom
      formattedAssignments.sort((a, b) => {
        if (a.status === "Submitted" && b.status !== "Submitted") return 1;
        if (b.status === "Submitted" && a.status !== "Submitted") return -1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
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

// export const getStudentAssignments = async (req, res) => {
//   try {
//     const studentId = req.user.id;

//     // Find all cohorts the student belongs to
//     const cohorts = await Cohort.find({
//       "studentIds.studentId": studentId,
//     });

//     if (!cohorts.length) {
//       return res
//         .status(404)
//         .json({ message: "You are not enrolled in any cohort" });
//     }

//     let allowedAssignments = [];
//     const now = new Date();

//     for (const cohort of cohorts) {
//       // Skip ended cohorts
//       if (cohort.endDate && cohort.endDate < now) continue;

//       const student = cohort.studentIds.find(
//         (s) => s.studentId.toString() === studentId.toString()
//       );

//       if (!student) continue; // safety

//       // Only allow courses where student hasAccess
//       const allowedCourseIds =
//         student.enrollments
//           ?.filter((e) => e.hasAccess)
//           ?.map((e) => e.courseId.toString()) || [];

//       if (allowedCourseIds.length === 0) continue;

//       // Fetch assignments only for eligible courses
//       const assignments = await Assignment.find({
//         cohortId: cohort._id,
//         courseId: { $in: allowedCourseIds },
//       })
//         .populate("courseId", "name category duration")
//         .populate("coachId", "fullName")
//         .sort({ updatedAt: -1 });

//       const formattedAssignments = assignments.map((a) => {
//         const submission = a.submissions?.find(
//           (s) => s.studentId?.toString() === studentId.toString()
//         );

//         return {
//           assignmentId: a._id,
//           title: a.title,
//           description: a.description,
//           courseName: a.courseId?.name || "N/A",
//           dueDate: a.dueDate,
//           file: submission?.file || null,
//           status: submission ? "Submitted" : "Pending",
//           grade: submission?.grade || "-",
//           updatedAt: a.updatedAt,
//         };
//       });

//       // Submitted assignments move to bottom
//       formattedAssignments.sort((a, b) => {
//         if (a.status === "Submitted" && b.status !== "Submitted") return 1;
//         if (b.status === "Submitted" && a.status !== "Submitted") return -1;
//         return new Date(b.updatedAt) - new Date(a.updatedAt);
//       });

//       allowedAssignments.push(...formattedAssignments);
//     }

//     return res.status(200).json({ assignments: allowedAssignments });
//   } catch (err) {
//     console.error("Get Student Assignments Error:", err);
//     return res
//       .status(500)
//       .json({ message: "Server error", error: err.message });
//   }
// };

// submit assignment by student
export const submitAssignment = async (req, res) => {
  let localFilePaths = [];
  try {
    const studentId = req.user.id;
    const { assignmentId } = req.params;
    const filesFromArray = Array.isArray(req.files) ? req.files : [];
    const filesFromFields = Array.isArray(req.files?.files) ? req.files.files : [];
    const fileFromSingle = Array.isArray(req.files?.file) ? req.files.file : [];
    const oneFromReqFile = req.file ? [req.file] : [];
    const files = [
      ...filesFromArray,
      ...filesFromFields,
      ...fileFromSingle,
      ...oneFromReqFile,
    ];
    localFilePaths = files.map((f) => f.path).filter(Boolean);

    if (!assignmentId) {
      return res.status(400).json({ message: "Assignment ID is required" });
    }

    if (!mongoose.isValidObjectId(assignmentId)) {
      localFilePaths.forEach(deleteLocalFile);
      return res.status(400).json({ message: "Invalid assignment ID" });
    }

    if (!files.length) {
      return res
        .status(400)
        .json({ message: "At least one submission file is required" });
    }

    // 1️⃣ Find assignment
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      localFilePaths.forEach(deleteLocalFile);
      return res.status(404).json({ message: "Assignment not found" });
    }

    const hasAccess = await studentHasAssignmentAccess(assignment, studentId);
    if (!hasAccess) {
      localFilePaths.forEach(deleteLocalFile);
      return res.status(403).json({
        message: "You do not have access to submit this assignment",
      });
    }

    const now = new Date();

    // 2️⃣ Check expiry
    const dueDate = toEndOfDay(assignment.dueDate);

    if (dueDate && dueDate < now) {
      localFilePaths.forEach(deleteLocalFile);
      return res.status(403).json({
        message: "Assignment has expired! Please submit before the due date.",
      });
    }
    // const isExpired = new Date(assignment.dueDate) < new Date();

    // if (isExpired) {
    //   return res.status(403).json({
    //     message: "Assignment has expired",
    //   });
    // }

    // 3️⃣ Check if student already submitted
    const alreadySubmitted = assignment.submissions.some(
      (s) => s.studentId?.toString() === studentId
    );

    if (alreadySubmitted) {
      localFilePaths.forEach(deleteLocalFile);
      return res.status(400).json({
        message: "You have already submitted this assignment",
      });
    }

    // 4️⃣ Upload submission files to Cloudinary
    const uploadedFiles = [];
    for (const currentFile of files) {
      const result = await cloudinary.uploader.upload(currentFile.path, {
        folder: "assignment_submissions",
        resource_type: "auto", // supports all file types
      });
      uploadedFiles.push(result.secure_url);
      deleteLocalFile(currentFile.path);
    }
    localFilePaths = [];

    // 5️⃣ Save submission in DB
    assignment.submissions.push({
      studentId: studentId,
      file: uploadedFiles[0] || null, // backward compatibility
      files: uploadedFiles, // all uploaded files
      submittedAt: now,
      grade: null,
    });

    await assignment.save();

    return res.status(200).json({
      message: "Assignment submitted successfully!",
      file: uploadedFiles[0] || null,
      files: uploadedFiles,
      submittedAt: now,
    });
  } catch (err) {
    localFilePaths.forEach(deleteLocalFile);
    console.error("Submit Assignment Error:", err);
    return res.status(500).json({
      message: "Error submitting assignment",
      error: err.message,
    });
  }
};
// GET ASSIGNMENTS SUBMITTED BY STUDENTS FOR A COACH
export const getCoachAssignments = async (req, res) => {
  try {
    const coachId = req.user.id;

    // Fetch all assignments created by this coach
    const assignments = await Assignment.find({ coachId })
      .populate("submissions.studentId", "fullName email")
      .populate("cohortId", "name studentIds") // include studentIds to check access
      .populate("courseId", "name category duration");

    const allSubmissions = [];

    assignments.forEach((a) => {
      const cohort = a.cohortId;

      // Build a Set of student IDs who have access for this course
      const studentsWithAccess = new Set();
      if (cohort && Array.isArray(cohort.studentIds)) {
        cohort.studentIds.forEach((s) => {
          const enrollment = s.enrollments.find(
            (e) =>
              e.courseId.toString() === a.courseId._id.toString() && e.hasAccess
          );
          if (enrollment) studentsWithAccess.add(s.studentId.toString());
        });
      }

      if (Array.isArray(a.submissions) && a.submissions.length > 0) {
        a.submissions.forEach((s) => {
          // Only include submission if student has access
          if (!s.studentId || !studentsWithAccess.has(s.studentId.toString()))
            return;

          allSubmissions.push({
            assignmentId: a._id,
            title: a.title,
            description: a.description,
            dueDate: a.dueDate,
            cohort: cohort?.name || "No Cohort",
            cohortId: cohort?._id || null,
            courseName: a.courseId?.name || "N/A",
            student: {
              _id: s.studentId._id,
              fullName: s.studentId.fullName,
              email: s.studentId.email,
            },
            studentId: s.studentId._id,
            file: s.file || s.files?.[0] || null,
            files:
              Array.isArray(s.files) && s.files.length > 0
                ? s.files
                : s.file
                ? [s.file]
                : [],
            grade: s.grade ?? null,
            feedback: s.feedback ?? null,
            submittedAt: s.submittedAt,
            submissionId: s._id,
          });
        });
      } else {
        // No submissions — include assignment only if some student has access
        if (studentsWithAccess.size > 0) {
          allSubmissions.push({
            assignmentId: a._id,
            title: a.title,
            description: a.description,
            dueDate: a.dueDate,
            cohort: cohort?.name || "No Cohort",
            cohortId: cohort?._id || null,
            courseName: a.courseId?.name || "N/A",
            student: null,
            studentId: null,
            file: null,
            grade: null,
            feedback: null,
            submittedAt: a.createdAt, // fallback for sorting
            submissionId: null,
          });
        }
      }
    });

    // Sort so that graded submissions come first, then by most recent
    allSubmissions.sort((a, b) => {
      const aGraded = a.grade !== null;
      const bGraded = b.grade !== null;

      if (aGraded && !bGraded) return -1;
      if (!aGraded && bGraded) return 1;

      const aDate = a.submittedAt || a.dueDate || 0;
      const bDate = b.submittedAt || b.dueDate || 0;
      return new Date(bDate) - new Date(aDate);
    });

    // Group assignments by cohort
    const assignmentsByCohort = {};
    assignments.forEach((a) => {
      const cohortName = a.cohortId?.name || "No Cohort";
      if (!assignmentsByCohort[cohortName])
        assignmentsByCohort[cohortName] = [];
      assignmentsByCohort[cohortName].push(a);
    });

    return res.status(200).json({
      assignmentsByCohort,
      submissions: allSubmissions,
    });
  } catch (err) {
    console.error("Error fetching coach assignments:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

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

// ✅ Coach updates assignment details
export const updateAssignment = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { assignmentId } = req.params;
    const { dueDate } = req.body;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    if (assignment.coachId.toString() !== coachId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (dueDate) {
      assignment.dueDate = toEndOfDay(dueDate);
    }

    await assignment.save();

    return res.status(200).json({
      message: "Assignment updated successfully",
      assignment,
    });
  } catch (err) {
    console.error("Update Assignment Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
