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

    // Collect all allowed course IDs across all cohorts
    let allowedAssignments = [];
    for (const cohort of cohorts) {
      const student = cohort.studentIds.find(
        (s) => s.studentId.toString() === studentId.toString()
      );

      const allowedCourseIds = student.enrollments
        .filter((e) => e.paid && e.paymentConfirmed && e.hasAccess)
        .map((e) => e.courseId.toString());

      if (allowedCourseIds.length === 0) continue;

      const assignments = await Assignment.find({
        cohortId: cohort._id,
        courseId: { $in: allowedCourseIds },
      })
        .populate("courseId", "name category duration") // ✅ FIX HERE
        .populate("coachId", "fullName"); // coach info

      allowedAssignments.push(...assignments);
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

    const assignments = await Assignment.find({ coachId })
      .populate("submissions.studentId", "fullName email")
      .populate("cohortId", "cohortName");

    const assignmentsList = assignments
      .filter((a) => a.submissions.length > 0) // only assignments with submissions
      .map((a) => ({
        assignmentId: a._id,
        title: a.title,
        description: a.description,
        dueDate: a.dueDate,
        cohort: a.cohortId?.cohortName || null,
        submissions: a.submissions.map((s) => ({
          student: s.studentId
            ? {
                _id: s.studentId._id,
                fullName: s.studentId.fullName,
                email: s.studentId.email,
              }
            : null,
          file: s.file,
          grade: s.grade,
          feedback: s.feedback,
          submittedAt: s.submittedAt,
        })),
      }));

    return res.json({ assignments: assignmentsList });
  } catch (err) {
    console.error("Error fetching coach assignments:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};
