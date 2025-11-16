import Cohort from "../module/cohort.js";

export const createCohort = async (req, res) => {
  const { courseId, coachId, durationInDays, studentIds } = req.body;
  const ownerId = req.user.id;

  try {
    const newCohort = await Cohort.create({
      courseId,
      coachId,
      ownerId,
      durationInDays,
      studentIds: studentIds || [],
    });

    res
      .status(201)
      .json({ message: "Cohort created successfully", cohort: newCohort });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// controllers/cohortController.js
export const startCohort = async (req, res) => {
  try {
    const cohort = req.cohort;

    if (cohort.status !== "not_started") {
      return res
        .status(400)
        .json({ message: "Cohort already started or completed" });
    }

    cohort.status = "in_progress";
    cohort.startDate = new Date();
    await cohort.save();

    res.json({ message: "Cohort started successfully", cohort });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const endCohort = async (req, res) => {
  try {
    const cohort = req.cohort;

    if (cohort.status !== "in_progress") {
      return res
        .status(400)
        .json({ message: "Cohort not in progress or already completed" });
    }

    cohort.status = "completed";
    cohort.endDate = new Date();
    await cohort.save();

    res.json({ message: "Cohort ended successfully", cohort });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
