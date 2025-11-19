import mongoose from "mongoose";
import Cohort from "..//module/cohort.js";
import Course from "../module/course.js";

function convertDurationStringToDays(duration) {
  if (!duration) return null;

  const [num, unit] = duration.split("-");

  const n = parseInt(num);

  if (unit === "months" || unit === "month") {
    return n * 30;
  }

  if (unit === "year") {
    return n * 365;
  }

  return null;
}
export const createCohort = async (req, res) => {
  try {
    const ownerId = req.user.id; // AUTHENTICATED OWNER
    const { name, courses, startDate, endDate, studentIds } = req.body;

    // -------------------------
    // 🔎 BASIC VALIDATION
    // -------------------------
    if (!name || !ownerId) {
      return res
        .status(400)
        .json({ message: "Name and ownerId are required." });
    }

    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one course is required." });
    }

    // -------------------------
    // 🔎 VALIDATE EACH COURSE
    // -------------------------
    const validatedCourses = [];

    for (const course of courses) {
      const { courseId, coachId } = course;

      const courseDoc = await Course.findById(courseId);
      if (!courseDoc) {
        return res.status(404).json({
          message: `Course not found: ${courseId}`,
        });
      }

      const durationInDays = convertDurationStringToDays(courseDoc.duration);

      if (!durationInDays) {
        return res.status(400).json({
          message: `Invalid duration format for course ${courseId}: ${courseDoc.duration}`,
        });
      }

      validatedCourses.push({
        courseId,
        coachId,
        durationInDays,
      });
    }

    // -------------------------
    // 🔎 CREATE COHORT
    // -------------------------
    const newCohort = await Cohort.create({
      name,
      ownerId,
      courses: validatedCourses,
      startDate,
      endDate,
      studentIds: studentIds || [],
    });

    return res.status(201).json({
      message: "Cohort created successfully",
      cohort: newCohort,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error while creating cohort",
      error: error.message,
    });
  }
};

//REGISTER STUDENT TO COHORT

export const registerStudentToCohort = async (req, res) => {
  const { cohortId } = req.params;
  const studentId = req.user.id; // assume student is logged in

  try {
    const cohort = await Cohort.findById(cohortId);
    if (!cohort) return res.status(404).json({ message: "Cohort not found" });

    // Avoid duplicates
    if (cohort.studentIds.includes(studentId)) {
      return res.status(400).json({ message: "Student already registered" });
    }

    cohort.studentIds.push(studentId);
    await cohort.save();

    res
      .status(200)
      .json({ message: "Student registered successfully", cohort });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
//GET STUDENTS IN A COHORT
export const getCohortStudents = async (req, res) => {
  try {
    const cohort = await Cohort.findById(req.params.cohortId).populate(
      "studentIds",
      "name email"
    );
    if (!cohort) return res.status(404).json({ message: "Cohort not found" });

    res.status(200).json({ students: cohort.studentIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// controllers/cohortController.js

export const startCohortByCourse = async (req, res) => {
  let { cohortCourseId } = req.params;
  const ownerId = req.user.id;

  try {
    // validate ObjectId
    cohortCourseId = new mongoose.Types.ObjectId(cohortCourseId);

    // find cohort that contains this course entry
    const cohort = await Cohort.findOne({
      ownerId,
      "courses._id": cohortCourseId,
    });

    if (!cohort)
      return res.status(404).json({ message: "Cohort course not found" });

    // select the course inside the array
    const courseItem = cohort.courses.id(cohortCourseId);

    if (courseItem.startDate)
      return res
        .status(400)
        .json({ message: "This cohort course already started" });

    courseItem.startDate = new Date();
    await cohort.save();

    res.status(200).json({
      message: "Cohort course started successfully",
      cohort,
    });
  } catch (error) {
    console.error("Start cohort course error:", error);
    res.status(500).json({ message: "Server error starting cohort course" });
  }
};

export const endCohortByCourse = async (req, res) => {
  try {
    const { cohortId } = req.params;

    const cohort = await Cohort.findOne({ _id: cohortId });
    if (!cohort) return res.status(404).json({ message: "Cohort not found" });

    if (cohort.status !== "in_progress") {
      return res.status(400).json({ message: "Cohort is not in progress" });
    }

    // Coach can only end their course cohort
    if (
      req.user.role === "coach" &&
      cohort.coachId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "You cannot end a cohort for a course you do not coach",
      });
    }

    // Owner can end any cohort
    cohort.status = "completed";
    cohort.endDate = new Date();
    await cohort.save();

    res.json({ message: "Cohort ended successfully", cohort });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export const getAllCohorts = async (req, res) => {
  try {
    const cohorts = await Cohort.find()
      .populate("courses.courseId", "name duration")
      .populate("courses.coachId", "fullName email")
      .populate("ownerId", "fullName email");

    res.json(cohorts);
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

export const deleteCohort = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { cohortId } = req.params;
    if (!cohortId) {
      return res.status(400).json({ message: "Cohort ID is required" });
    }

    const cohort = await Cohort.findById(cohortId);
    if (!cohort) {
      return res.status(404).json({ message: "Cohort not found" });
    }

    // Only owner can delete
    if (cohort.ownerId.toString() !== ownerId.toString()) {
      return res.status(403).json({
        message: "You are not authorized to delete this cohort",
      });
    }

    await Cohort.findByIdAndDelete(cohortId);

    res.json({ message: "Cohort deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Server error while deleting cohort",
      error: error.message,
    });
  }
};
