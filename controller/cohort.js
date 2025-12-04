import mongoose from "mongoose";
import Cohort from "..//module/cohort.js";
import Course from "../module/course.js";
import userModule from "../module/userModule.js";

//CREATE COHORT
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

    // ✅ Directly assign the array to the courses field
    const newCohort = new Cohort({
      name,
      ownerId,
      courses: validatedCourses,
      studentIds: studentIds || [],
    });

    await newCohort.save();

    return res.status(201).json({
      message: "Cohort created successfully",
      cohort: newCohort.toObject(),
    });
  } catch (error) {
    console.error("Create cohort error:", error);
    return res.status(500).json({
      message: "Server error while creating cohort",
      error: error.message,
    });
  }
};

//REGISTER STUDENT TO COHORT

export const registerStudentToCohort = async (req, res) => {
  const { cohortId } = req.params;
  const { courseId } = req.body;
  const studentId = req.user?.id;

  if (!studentId) {
    return res
      .status(401)
      .json({ message: "You must be logged in to register" });
  }

  try {
    // 1️⃣ Validate student
    const student = await userModule.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    // 2️⃣ Validate cohort
    const cohort = await Cohort.findById(cohortId);
    if (!cohort) return res.status(404).json({ message: "Cohort not found" });

    if (!cohort.courses || cohort.courses.length === 0) {
      return res.status(400).json({ message: "This cohort has no courses" });
    }

    const selectedCourse = cohort.courses.find(
      (c) => c.courseId.toString() === courseId
    );

    if (!selectedCourse) {
      return res.status(400).json({
        message: "Selected course does not belong to this cohort",
      });
    }

    // 3️⃣ NORMALIZE old studentIds shape:
    //    convert raw ObjectId entries into { studentId, enrollments: [] }
    if (!Array.isArray(cohort.studentIds)) {
      cohort.studentIds = [];
    } else {
      cohort.studentIds = cohort.studentIds
        .map((entry) => {
          // If entry is a plain ObjectId (old schema)
          if (
            typeof entry === "string" ||
            entry instanceof mongoose.Types.ObjectId
          ) {
            return {
              studentId: entry,
              enrollments: [],
            };
          }

          // If entry is already in new shape, keep it
          if (entry && entry.studentId) {
            if (!Array.isArray(entry.enrollments)) {
              entry.enrollments = [];
            }
            return entry;
          }

          // Fallback: skip invalid entries
          return null;
        })
        .filter(Boolean);
    }

    // 4️⃣ Find or create this student entry inside cohort.studentIds
    let studentEntry = cohort.studentIds.find(
      (s) => s.studentId.toString() === studentId.toString()
    );

    if (!studentEntry) {
      studentEntry = {
        studentId,
        enrollments: [],
      };
      cohort.studentIds.push(studentEntry);
    } else if (!Array.isArray(studentEntry.enrollments)) {
      studentEntry.enrollments = [];
    }

    // 5️⃣ Check if already registered for this course in this cohort
    const alreadyRegistered = studentEntry.enrollments.some(
      (reg) => reg.courseId.toString() === courseId.toString()
    );

    if (alreadyRegistered) {
      return res.status(400).json({
        message: "You have already registered for this course in this cohort",
      });
    }

    // 6️⃣ Add new enrollment for this course
    studentEntry.enrollments.push({
      courseId,
      paid: false,
      paymentConfirmed: false,
      hasAccess: false,
      paidAt: null,
    });

    // Optionally reset per-student global flags if you still use them
    student.paid = false;
    student.paymentConfirmed = false;

    await student.save();
    await cohort.save();

    return res.status(200).json({
      message: "Course registration successful.",
      cohort: {
        cohortId: cohort._id,
        cohortName: cohort.name,
      },
      selectedCourse,
    });
  } catch (err) {
    console.error("Registration Error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
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

export const getActiveCohorts = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1️⃣ Find all cohorts where student is enrolled
    const cohorts = await Cohort.find({
      "studentIds.studentId": userId,
    })
      .populate("courses.courseId")
      .populate("courses.coachId");

    if (!cohorts || cohorts.length === 0) {
      return res.status(200).json({ cohorts: [] });
    }

    // 2️⃣ Map cohorts to only include in-progress courses
    const activeCohorts = cohorts.map((cohort) => {
      // Courses that are "in_progress"
      const inProgressCourses = cohort.courses
        .filter((c) => c.status === "in_progress")
        .map((c) => {
          // Check if student is enrolled in this course
          const enrollment = cohort.enrollments.find(
            (e) => e.courseId.toString() === c.courseId._id.toString()
          );

          return {
            courseId: c.courseId._id,
            name: c.courseId.name,
            category: c.courseId.category,
            duration: c.durationInDays + " days",
            coachId: c.coachId._id,
            coachName: c.coachId.fullName,
            coachEmail: c.coachId.email,
            coachPhone: c.coachId.phoneNumber,
            status: c.status,
            startDate: c.startDate,
            endDate: c.endDate,
            enrolled: enrollment ? true : false,
            paymentConfirmed: enrollment?.paymentConfirmed || false,
          };
        });

      return {
        cohortId: cohort._id,
        cohortName: cohort.name,
        startDate: cohort.startDate,
        endDate: cohort.endDate,
        courses: inProgressCourses,
      };
    });

    return res.status(200).json({ cohorts: activeCohorts });
  } catch (err) {
    console.error("getActiveCohorts Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getNotActiveCohort = async (req, res) => {
  try {
    // Find a cohort that has at least one not-started course
    const cohort = await Cohort.findOne({
      "courses.status": "not_started",
    })
      .populate("courses.courseId")
      .populate("courses.coachId")
      .populate("studentIds");

    if (!cohort) {
      return res.status(404).json({ message: "❌ No active cohort available" });
    }

    const notStartedCourses = cohort.courses.filter(
      (course) => course.status === "not_started"
    );

    return res.status(200).json({
      cohort: {
        cohortName: cohort.name,
        cohortId: cohort._id,
        notStartedCourses,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

//✅ Get all coaches assigned to students

export const getCoachesAssignedToStudents = async (req, res) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({ message: "Unauthorized: No student ID" });
    }

    // Load only cohorts containing this student
    const cohorts = await Cohort.find({
      "studentIds.studentId": studentId,
    })
      .populate({
        path: "courses.courseId",
        select: "name duration category",
      })
      .populate({
        path: "courses.coachId",
        select: "fullName email profilePhoto avgRating",
      })
      .populate({
        path: "studentIds.studentId",
        select: "fullName email profilePhoto",
      });

    let assignedCoaches = [];

    for (const cohort of cohorts) {
      const studentEntry = cohort.studentIds.find(
        (s) => s.studentId && s.studentId._id.toString() === studentId
      );

      if (!studentEntry) continue;

      for (const enroll of studentEntry.enrollments) {
        if (!enroll.paid || !enroll.paymentConfirmed) continue;

        const courseMatch = cohort.courses.find(
          (c) =>
            c.courseId &&
            c.courseId._id.toString() === enroll.courseId.toString()
        );

        if (!courseMatch) continue;
        if (courseMatch.status !== "in_progress") continue;

        assignedCoaches.push({
          courseId: courseMatch.courseId._id,
          courseName: courseMatch.courseId.name,
          courseCategory: courseMatch.courseId.category,
          coachId: courseMatch.coachId?._id,
          coachName: courseMatch.coachId?.fullName,
          coachEmail: courseMatch.coachId?.email,
          coachPhoto: courseMatch.coachId?.profilePhoto,
          courseStatus: courseMatch.status,
        });
      }
    }

    return res.status(200).json({
      message: "Assigned coaches fetched successfully",
      studentId,
      coaches: assignedCoaches,
    });
  } catch (error) {
    console.error("❌ Error fetching coaches for student:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

//  get available cohorts with not started courses for students to register

export const getAvailableCohorts = async (req, res) => {
  try {
    // 1️⃣ Fetch all cohorts that have at least ONE course not started
    const cohorts = await Cohort.find({
      "courses.status": "not_started",
    })
      .populate("courses.courseId")
      .populate("courses.coachId")
      .select("name startDate endDate courses");

    // If no available cohorts
    if (!cohorts || cohorts.length === 0) {
      return res.status(200).json({ cohorts: [] });
    }

    // 2️⃣ Format clean response
    const availableCohorts = cohorts.map((cohort) => {
      const notStartedCourses = cohort.courses
        .filter((c) => c.status === "not_started")
        .map((c) => ({
          courseId: c.courseId._id,
          name: c.courseId.name,
          category: c.courseId.category,
          duration: c.durationInDays + " days",
          coachId: c.coachId._id,
          coachName: c.coachId.fullName,
          coachEmail: c.coachId.email,
          coachPhone: c.coachId.phoneNumber,
          status: c.status,
          startDate: c.startDate,
          endDate: c.endDate,
        }));

      return {
        cohortId: cohort._id,
        cohortName: cohort.name,
        startDate: cohort.startDate,
        endDate: cohort.endDate,
        courses: notStartedCourses,
      };
    });

    return res.status(200).json({ cohorts: availableCohorts });
  } catch (err) {
    console.error("getAvailableCohorts Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getCohortCourses = async (req, res) => {
  try {
    const cohort = await Cohort.findById(req.params.id)
      .populate("courses.courseId")
      .populate("courses.coachId");

    if (!cohort) {
      return res.status(404).json({ message: "Cohort not found" });
    }

    return res.json({ courses: cohort.courses });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
export const getCoachAssignedCohorts = async (req, res) => {
  try {
    const coachId = req.user.id;

    const cohorts = await Cohort.find({
      "courses.coachId": coachId,
    })
      .populate("courses.courseId")
      .populate("courses.coachId");

    if (!cohorts || cohorts.length === 0) {
      return res.status(200).json({ cohorts: [] });
    }

    const assigned = cohorts.map((cohort) => {
      const coachCourses = cohort.courses
        .filter((c) => c.coachId._id.toString() === coachId)
        .map((c) => ({
          cohortCourseId: c._id, // needed for start/end
          courseId: c.courseId._id,
          name: c.courseId.name,
          category: c.courseId.category,
          duration: c.durationInDays + " days",
          status: c.status,
          startDate: c.startDate,
          endDate: c.endDate,
        }));

      return {
        cohortId: cohort._id,
        cohortName: cohort.name,
        courses: coachCourses,
      };
    });

    return res.status(200).json({ cohorts: assigned });
  } catch (err) {
    console.error("getCoachAssignedCohorts Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
