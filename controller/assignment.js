import Assignment from "../module/cohortAssignment.js";
import Cohort from "../module/cohort.js";
// import mongoose from "mongoose";
export const createCohortAssignment = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { cohortId, title, description, dueDate } = req.body;

    if (!cohortId || !title) {
      return res.status(400).json({
        message: "cohortId and title are required",
      });
    }

    const cohort = await Cohort.findById(cohortId);
    if (!cohort) return res.status(404).json({ message: "Cohort not found" });

    // Find the course that belongs to this coach
    const courseInCohort = cohort.courses.find(
      (c) => c.coachId.toString() === coachId
    );

    if (!courseInCohort) {
      return res.status(403).json({
        message: "You do not have any course in this cohort",
      });
    }

    // Prevent assignment if course is completed
    if (courseInCohort.status === "completed") {
      return res.status(403).json({
        message:
          "Cannot create assignment because this course has been completed",
      });
    }

    // Use the courseId automatically
    const assignment = await Assignment.create({
      title,
      description,
      cohortId,
      courseId: courseInCohort.courseId, // grabbed automatically
      coachId,
      dueDate,
    });

    return res.status(201).json({
      message: "Assignment created successfully",
      assignment,
    });
  } catch (err) {
    console.error("Create Assignment Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
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
      assignment.isExpired = true;
      await assignment.save();

      return res.status(403).json({
        message:
          "Assignment has expired! Please submit before the due date elapses.",
      });
    }

    // 3️⃣ Check if student already submitted
    const alreadySubmitted = assignment.submissions.some(
      (s) => s.student?.toString() === studentId
    );

    if (alreadySubmitted) {
      return res.status(400).json({
        message: "You have already submitted this assignment",
      });
    }

    // 4️⃣ Push valid submission
    assignment.submissions.push({
      student: studentId,
      fileUrl: file.path, // If you're using Cloudinary/S3, replace with secure_url
      submittedAt: now,
      grade: null,
    });

    await assignment.save();

    return res.status(200).json({
      message: "Assignment submitted successfully!",
      fileUrl: file.path,
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

    // 1️⃣ Find cohorts coach teaches
    const cohorts = await Cohort.find({ coachId });
    const cohortIds = cohorts.map((c) => c._id);

    if (cohortIds.length === 0) {
      return res.json({ assignments: [] });
    }

    // 2️⃣ Find assignments inside those cohorts that belong to this coach
    const assignments = await Assignment.find({
      coachId,
      cohortId: { $in: cohortIds },
      "submissions.0": { $exists: true },
    })
      .populate("submissions.student", "fullName email")
      .populate("cohortId", "cohortName");

    // 3️⃣ Flatten submissions
    const submissionsList = assignments.flatMap((a) =>
      a.submissions.map((s) => ({
        assignmentId: a._id,
        title: a.title,
        description: a.description,
        dueDate: a.dueDate,
        cohort: a.cohortId?.cohortName,
        student: s.student
          ? {
              _id: s.student._id,
              fullName: s.student.fullName,
              email: s.student.email,
            }
          : null,
        grade: s.grade,
        submittedAt: s.submittedAt,
      }))
    );

    res.json({ assignments: submissionsList });
  } catch (err) {
    console.error("Error fetching student assignments:", err);
    res.status(500).json({ message: "Server error" });
  }
};
