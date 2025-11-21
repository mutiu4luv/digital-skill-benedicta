import Course from "../module/course.js";
import User from "../module/userModule.js";
import mongoose from "mongoose";
import cloudinary from "../config/cloudnary.js";

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
    const { name, category, description, coachId, duration, image } = req.body;

    // Validate required fields
    if (!name || !category || !coachId || !duration) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate duration format (fixed)
    const durationRegex = /^(1-month|3-months|6-months|1-year)$/;
    if (!durationRegex.test(duration)) {
      return res.status(400).json({
        message:
          'Invalid duration format! Use "1-month", "3-months", "6-months", or "1-year"',
      });
    }

    const newCourse = await Course.create({
      name,
      category,
      description: description || "",
      coach: coachId,
      createdBy: req.user.id,
      duration,
      image: image || "",
    });

    res.status(201).json({ message: "Course created", course: newCourse });
  } catch (error) {
    console.error("Create course error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ---------------------------------------------------------
// PUBLIC: Get all courses
// ---------------------------------------------------------
export const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find().populate("coach", "fullName email");
    res.json(courses);
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
