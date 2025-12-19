import mongoose from "mongoose";
import FreeCourse from "../module/freeCoure.js";
import FreeCourseContent from "../module/freeCourseContent.js";
import FreeCourseEnrollment from "../module/freeCourseEnrollment.js";

export const createFreeCourse = async (req, res) => {
  try {
    const { title, description } = req.body;
    const coachId = req.user.id;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const course = await FreeCourse.create({
      title: title.trim(),
      description: description?.trim(),
      coachId,
    });

    res.status(201).json({
      message: "Free course created successfully",
      course,
    });
  } catch (err) {
    console.error("Create free course error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
// get all free courses
export const getFreeCourses = async (req, res) => {
  try {
    const courses = await FreeCourse.find({ isPublished: true })
      .populate("coachId", "fullName profilePhoto")
      .sort({ createdAt: -1 });

    res.json({ courses });
  } catch (err) {
    res.status(500).json({ message: "Failed to load free courses" });
  }
};
// register for a free course
export const registerFreeCourse = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { courseId } = req.params;

    const exists = await FreeCourseEnrollment.findOne({
      studentId,
      courseId,
    });

    if (exists) {
      return res.status(400).json({ message: "Already registered" });
    }

    await FreeCourseEnrollment.create({
      studentId,
      courseId,
    });

    res.json({ message: "Registered successfully" });
  } catch (err) {
    res.status(500).json({ message: "Registration failed" });
  }
};

// get selected free course by student(get my free course)

export const getMyFreeCourses = async (req, res) => {
  try {
    const studentId = req.user.id;

    const enrollments = await FreeCourseEnrollment.find({ studentId }).populate(
      {
        path: "courseId",
        populate: {
          path: "coachId",
          select: "fullName profilePhoto",
        },
      }
    );

    const courses = enrollments
      .filter((e) => e.courseId)
      .map((e) => ({
        enrollmentId: e._id,
        courseId: e.courseId._id,
        title: e.courseId.title,
        description: e.courseId.description,
        coach: e.courseId.coachId,
      }));

    res.json({ courses });
  } catch (err) {
    res.status(500).json({ message: "Failed to load courses" });
  }
};
// coach add content
export const addFreeCourseContent = async (req, res) => {
  try {
    const { type, title, url } = req.body;
    const { courseId } = req.params;
    const coachId = req.user.id;

    const course = await FreeCourse.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (String(course.coachId) !== String(coachId)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const content = await FreeCourseContent.create({
      courseId,
      type,
      title,
      url,
    });

    res.status(201).json({ content });
  } catch (err) {
    res.status(500).json({ message: "Failed to add content" });
  }
};
// get selected course content by student

export const getFreeCourseContentForStudent = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { courseId } = req.params;

    const enrolled = await FreeCourseEnrollment.findOne({
      studentId,
      courseId,
    });

    if (!enrolled) {
      return res
        .status(403)
        .json({ message: "Register to access this course" });
    }

    const contents = await FreeCourseContent.find({ courseId }).sort({
      createdAt: 1,
    });

    res.json({ contents });
  } catch (err) {
    res.status(500).json({ message: "Failed to load contents" });
  }
};
// DELETE COURSE BY OWNER

export const deleteFreeCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    // Find course
    const course = await FreeLearningCourse.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // 🔐 Only owner/coach who created the course can delete
    if (course.coachId.toString() !== userId) {
      return res.status(403).json({
        message: "You are not allowed to delete this course",
      });
    }

    await course.deleteOne();

    return res.status(200).json({
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete Free Course Error:", error);
    return res.status(500).json({
      message: "Failed to delete course",
    });
  }
};
