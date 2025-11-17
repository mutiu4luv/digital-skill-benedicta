import Cohort from "../module/cohort.js";

import Course from "../module/course.js";

export const createCohort = async (req, res) => {
  const { courseId, studentIds, name } = req.body; // include 'name'
  const ownerId = req.user.id;

  try {
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const durationMap = { "1-month": 30, "3-months": 90, "6-months": 180 };

    const newCohort = await Cohort.create({
      name,
      courseId,
      coachId: course.coach,
      ownerId,
      durationInDays: durationMap[course.duration],
      studentIds: studentIds || [],
    });

    res
      .status(201)
      .json({ message: "Cohort created successfully", cohort: newCohort });
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
