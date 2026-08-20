import path from "path";
import cloudinary from "../config/cloudnary.js";
import Course from "../module/course.js";
import User from "../module/userModule.js";
import mongoose from "mongoose";
import cohort from "../module/cohort.js";
import Cohort from "../module/cohort.js";

const getIdValue = (value) => {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "object") {
    return String(value._id || value.id || value.toString?.() || "");
  }

  return String(value);
};

const isSameId = (left, right) => getIdValue(left) === getIdValue(right);

const buildCoachCoursePayload = (cohortDoc, courseDoc) => {
  const courseName =
    courseDoc?.courseId?.name ||
    courseDoc?.name ||
    courseDoc?.courseName ||
    "Untitled Course";

  return {
    cohortCourseId: getIdValue(courseDoc?._id),
    cohortId: getIdValue(cohortDoc?._id),
    cohortName: cohortDoc?.name || "No Cohort",
    courseId: getIdValue(courseDoc?.courseId),
    courseName,
    name: courseName,
    title: courseName,
    category: courseDoc?.courseId?.category || courseDoc?.category || "",
    duration: courseDoc?.durationInDays
      ? `${courseDoc.durationInDays} days`
      : courseDoc?.courseId?.duration || "",
    status: courseDoc?.status || "not_started",
    startDate: courseDoc?.startDate || null,
    endDate: courseDoc?.endDate || null,
  };
};

// ---------------------------------------------------------
// ✅ Coach sets class schedule
// ---------------------------------------------------------
export const setClassSchedule = async (req, res) => {
  const { courseId } = req.params;
  const { classDay, classTime } = req.body;
  const coachId = req.user.id;

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: "Course not found" });

  if (!course.coach || !course.coach.equals(coachId)) {
    return res.status(403).json({ message: "Not your course" });
  }

  // Create class start & end time
  const [hour, minute] = classTime.split(":");
  const now = new Date();

  const classStart = new Date(now);
  classStart.setHours(hour, minute, 0, 0);

  const classEnd = new Date(classStart.getTime() + 3 * 60 * 60 * 1000);

  course.classDay = classDay;
  course.classTime = classTime;
  course.classStartTime = classStart;
  course.classEndTime = classEnd;
  course.isClassOpen = false;

  await course.save();

  res.json({
    message: `Class scheduled for ${classDay} at ${classTime}`,
    course,
  });
};

// ---------------------------------------------------------
// ✅ OWNER: Create course
// ---------------------------------------------------------

export const createCourse = async (req, res) => {
  try {
    const { name, category, description, coachId, duration } = req.body;

    if (!name || !category || !coachId || !duration) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let imageUrl = "";

    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "courses",
        });
        imageUrl = result.secure_url;
      } catch (err) {
        console.error("Cloudinary upload failed:", err);
        return res
          .status(500)
          .json({ message: "Failed to upload image", error: err.message });
      }
    }

    const newCourse = await Course.create({
      name,
      category,
      description: description || "",
      coach: coachId,
      createdBy: req.user.id,
      duration,
      image: imageUrl,
    });

    return res
      .status(201)
      .json({ message: "Course created", course: newCourse });
  } catch (error) {
    console.error("Create course error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ---------------------------------------------------------
// PUBLIC: Get all courses
// ---------------------------------------------------------
export const getAllCourses = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");

    const courses = await Course.find().populate("coach", "fullName email");
    res.status(200).json(courses);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Cannot fetch courses", error: error.message });
  }
};

// ---------------------------------------------------------
// STUDENT: Get only MY registered courses
// ---------------------------------------------------------
export const getMyCourses = async (req, res) => {
  try {
    const userId = req.user.id;
    const courses = await Course.find({ students: userId }).populate(
      "coach",
      "fullName email"
    );

    res.json(courses);
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch student courses",
      error: error.message,
    });
  }
};

// get my courses for coach and student
export const getMyCoursesForCoach = async (req, res) => {
  try {
    const userId = req.user.id;

    let courses;
    if (req.user.role === "coach") {
      courses = await Course.find({ coach: userId }).populate(
        "coach",
        "fullName email"
      );
    } else if (req.user.role === "student") {
      courses = await Course.find({ students: userId }).populate(
        "coach",
        "fullName email"
      );
    } else {
      courses = await Course.find().populate("coach", "fullName email");
    }

    res.status(200).json({ courses });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({
      message: "Could not fetch courses",
      error: error.message,
    });
  }
};

// ---------------------------------------------------------
// OWNER: Assign coach
// ---------------------------------------------------------
export const assignCoach = async (req, res) => {
  try {
    const { courseId, coachId } = req.body;

    if (req.user.role !== "owner") {
      return res.status(403).json({ message: "Only owner can assign coaches" });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const coach = await User.findById(coachId);
    if (!coach || coach.role !== "coach") {
      return res.status(400).json({ message: "Invalid coach ID" });
    }

    course.coach = coachId;
    await course.save();

    res.json({ message: "Coach assigned successfully", course });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to assign coach", error: error.message });
  }
};
// ---------------------------------------------------------
// OWNER: Delete a course

export const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params; // use courseId instead of id

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (req.user.role !== "owner") {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this course" });
    }

    await course.deleteOne();
    res.json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("Delete course error:", error);
    res
      .status(500)
      .json({ message: "Failed to delete course", error: error.message });
  }
};

// GET COACH'S COURSES

export const getCoachCourses = async (req, res) => {
  try {
    const coachId = req.user.id;

    // Find all cohorts where this coach teaches at least one course
    const cohorts = await cohort
      .find({
        "courses.coachId": coachId,
      })
      .populate("courses.courseId")
      .populate("courses.coachId");

    let myCourses = [];

    cohorts.forEach((cohort) => {
      cohort.courses.forEach((c) => {
        if (isSameId(c.coachId, coachId) && c.courseId) {
          myCourses.push(buildCoachCoursePayload(cohort, c));
        }
      });
    });

    return res.status(200).json({
      message: "Coach courses fetched successfully",
      courses: myCourses,
    });
  } catch (err) {
    console.error("Get Coach Courses Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
// Express route: GET /api/cohort/:cohortId/courses-for-coach

export const getCohortCoursesForCoach = async (req, res) => {
  try {
    const { cohortId } = req.params;
    const coachId = req.user.id;

    console.log("▶️ cohortId:", cohortId);
    console.log("▶️ coachId:", coachId);

    // ✅ Use Cohort model (NOT cohort)
    const cohortDoc = await Cohort.findById(cohortId)
      .populate("courses.courseId")
      .populate("courses.coachId");

    console.log("▶️ cohortDoc:", cohortDoc);

    if (!cohortDoc) {
      console.log("❌ Cohort not found");
      return res.status(404).json({ message: "Cohort not found" });
    }

    // ✅ Only courses belonging to this coach
    const myCourses = cohortDoc.courses
      .filter((c) => {
        const isCoachMatch = isSameId(c.coachId, coachId);

        console.log(
          "🔍 Checking course:",
          c.courseId?.name,
          "Coach match:",
          isCoachMatch
        );

        return isCoachMatch;
      })
      .map((c) => buildCoachCoursePayload(cohortDoc, c));

    console.log("✅ Filtered courses:", myCourses);

    return res.status(200).json({
      message: "Cohort courses fetched successfully",
      courses: myCourses,
    });
  } catch (err) {
    console.error("❌ Get Cohort Courses For Coach Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
