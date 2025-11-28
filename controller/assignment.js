import Assignment from "../module/cohortAssignment.js";
import Cohort from "../module/cohort.js";
// import mongoose from "mongoose";
export const createCohortAssignment = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { cohortId, courseId, title, description, dueDate } = req.body;

    if (!cohortId || !courseId || !title) {
      return res.status(400).json({
        message: "cohortId, courseId and title are required",
      });
    }

    const cohort = await Cohort.findById(cohortId);
    if (!cohort) return res.status(404).json({ message: "Cohort not found" });

    // Check if course exists in cohort under this coach
    const courseInCohort = cohort.courses.find(
      (c) =>
        c.courseId.toString() === courseId && c.coachId.toString() === coachId
    );

    if (!courseInCohort) {
      return res.status(403).json({
        message: "You are not the coach for this course in this cohort",
      });
    }

    // 🚫 Stop coach from creating assignment if course has ended
    if (courseInCohort.status === "completed") {
      return res.status(403).json({
        message:
          "Cannot create assignment because this course has been completed",
      });
    }

    // Create assignment
    const assignment = await Assignment.create({
      title,
      description,
      cohortId,
      courseId,
      coachId,
      dueDate,
    });

    return res
      .status(201)
      .json({ message: "Assignment created successfully", assignment });
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
      }).populate("courseId coachId", "name fullName");

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
