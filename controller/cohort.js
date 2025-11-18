import Cohort from "../module/cohort.js";

import Course from "../module/course.js";

export const createCohort = async (req, res) => {
  const { name, courses } = req.body; // courses is an array
  const ownerId = req.user.id;

  if (!courses || courses.length === 0)
    return res.status(400).json({ message: "Courses are required" });

  try {
    const durationMap = { "1-month": 30, "3-months": 90, "6-months": 180 };
    const cohortCourses = [];

    // Fetch each course and prepare data
    for (const courseItem of courses) {
      const course = await Course.findById(courseItem.courseId);
      if (!course)
        return res
          .status(404)
          .json({ message: `Course not found: ${courseItem.courseId}` });

      cohortCourses.push({
        courseId: course._id,
        coachId: course.coach,
        durationInDays: durationMap[courseItem.duration],
      });
    }
    const newCohort = await Cohort.create({
      name,
      ownerId,
      courses: cohortCourses,
      studentIds: [],
    });

    res
      .status(201)
      .json({ message: "Cohort created successfully", cohort: newCohort });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
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
  try {
    const { courseId } = req.params;

    const cohort = await Cohort.findOne({ courseId });
    if (!cohort) return res.status(404).json({ message: "Cohort not found" });

    if (cohort.status !== "not_started") {
      return res
        .status(400)
        .json({ message: "Cohort already started or completed" });
    }

    // Coach can only start their own course cohort
    if (
      req.user.role === "coach" &&
      cohort.coachId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "You cannot start a cohort for a course you do not coach",
      });
    }

    // Owner can start any cohort
    cohort.status = "in_progress";
    cohort.startDate = new Date();
    await cohort.save();

    res.json({ message: "Cohort started successfully", cohort });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const endCohortByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const cohort = await Cohort.findOne({ courseId });
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
      .populate("courseId", "name duration")
      .populate("coachId", "fullName email")
      .populate("ownerId", "fullName email");
    res.json(cohorts);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
