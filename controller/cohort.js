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
    const ownerId = req.user.id;
    const { name, courses, studentIds } = req.body;

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

    const validatedCourses = [];

    for (const course of courses) {
      const { courseId, coachId } = course;

      if (!courseId || !coachId) {
        return res.status(400).json({
          message: "Each course must include courseId and coachId",
        });
      }

      const courseDoc = await Course.findById(courseId);
      if (!courseDoc) {
        return res
          .status(404)
          .json({ message: `Course not found: ${courseId}` });
      }

      const durationInDays = convertDurationStringToDays(courseDoc.duration);

      validatedCourses.push({
        courseId,
        coachId,
        durationInDays,
        status: "not_started",
        startDate: null,
        endDate: null,
      });
    }

    const newCohort = new Cohort({
      name,
      ownerId,
      courses: validatedCourses.map((c) =>
        new Cohort.schema.path("courses").caster(c)
      ),
      studentIds: studentIds || [],
    });

    await newCohort.save();

    return res.status(201).json({
      message: "Cohort created successfully",
      cohort: newCohort.toObject(), // this will now include status/startDate/endDate
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
  const studentId = req.user?.id; // make sure user is logged in

  if (!studentId) {
    return res
      .status(401)
      .json({ message: "You must be logged in to register" });
  }

  try {
    // Verify user exists
    const user = await User.findById(studentId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const cohort = await Cohort.findById(cohortId);
    if (!cohort) {
      return res.status(404).json({ message: "Cohort not found" });
    }

    // Check if cohort has courses
    if (!cohort.courses || cohort.courses.length === 0) {
      return res.status(400).json({ message: "This cohort has no courses" });
    }

    // Avoid duplicate registration
    if (cohort.studentIds.includes(studentId)) {
      return res.status(400).json({ message: "Student already registered" });
    }

    cohort.studentIds.push(studentId);
    await cohort.save();

    res.status(200).json({
      message: "Student registered successfully",
      cohort: {
        _id: cohort._id,
        name: cohort.name,
        courses: cohort.courses.map((c) => ({
          courseId: c.courseId,
          coachId: c.coachId,
          durationInDays: c.durationInDays,
          status: c.status,
          startDate: c.startDate,
          endDate: c.endDate,
        })),
        studentIds: cohort.studentIds,
        status: cohort.status,
        createdAt: cohort.createdAt,
        updatedAt: cohort.updatedAt,
      },
    });
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

  if (!mongoose.Types.ObjectId.isValid(cohortCourseId)) {
    return res.status(400).json({ message: "Invalid course ID" });
  }

  try {
    const cohort = await Cohort.findOne({
      ownerId,
      "courses._id": cohortCourseId,
    });

    if (!cohort) {
      return res.status(404).json({ message: "Course not found in cohort" });
    }

    const courseItem = cohort.courses.id(cohortCourseId);

    if (courseItem.status === "in_progress") {
      return res.status(400).json({ message: "Course already started" });
    }

    if (courseItem.status === "completed") {
      return res.status(400).json({ message: "Course already completed" });
    }

    // 🔥 START THE COURSE ONLY
    courseItem.status = "in_progress";
    courseItem.startDate = new Date();

    await cohort.save();

    const updated = await Cohort.findById(cohort._id).populate(
      "courses.courseId"
    );

    return res.json({
      message: "Course started successfully",
      course: {
        _id: courseItem._id,
        courseId: courseItem.courseId, // populated if you want full details
        coachId: courseItem.coachId,
        durationInDays: courseItem.durationInDays,
        status: courseItem.status, // explicitly include status
        startDate: courseItem.startDate,
        endDate: courseItem.endDate,
      },
    });
  } catch (error) {
    console.error("Start cohort error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const endCohortByCourse = async (req, res) => {
  try {
    const { cohortCourseId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Find cohort that contains this course
    const cohort = await Cohort.findOne({
      "courses._id": cohortCourseId,
    });

    if (!cohort) {
      return res.status(404).json({ message: "Cohort course not found" });
    }

    const courseItem = cohort.courses.id(cohortCourseId);
    if (!courseItem) {
      return res.status(404).json({ message: "Course not found in cohort" });
    }

    if (courseItem.status !== "in_progress") {
      return res.status(400).json({ message: "Course is not in progress" });
    }

    // Coach can only end their own course
    if (userRole === "coach" && courseItem.coachId.toString() !== userId) {
      return res.status(403).json({
        message: "You cannot end a course you are not coaching",
      });
    }

    // End course
    courseItem.status = "completed";
    courseItem.endDate = new Date();

    await cohort.save();

    res.json({
      message: "Course completed successfully",
      course: courseItem,
    });
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
