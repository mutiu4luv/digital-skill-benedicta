import mongoose from "mongoose";
import FreeCourse from "../module/freeCoure.js";
import FreeCourseContent from "../module/freeCourseContent.js";
import FreeCourseEnrollment from "../module/freeCourseEnrollment.js";
import cloudinary from "../config/cloudnary.js";

export const createFreeCourse = async (req, res) => {
  try {
    const { title, description, coachId, assignedCoachId } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const finalCoachId = coachId || assignedCoachId || req.user?.id;

    if (!finalCoachId) {
      return res.status(400).json({ message: "A Coach must be assigned." });
    }

    /* ----------------------------------
       🖼 UPLOAD IMAGE (OPTIONAL)
    ---------------------------------- */
    let imageUrl = "";

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: "hgsc_free_courses" }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          })
          .end(req.file.buffer);
      });

      imageUrl = uploadResult.secure_url;
    }

    /* ----------------------------------
       🚀 CREATE COURSE
    ---------------------------------- */
    const course = await FreeCourse.create({
      title: title.trim(),
      description: description?.trim(),
      coachId: finalCoachId,
      image: imageUrl,
    });

    res.status(201).json({
      message: "Free course created successfully",
      course,
    });
  } catch (err) {
    console.error("❌ Create free course error:", err);
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
    const { courseId } = req.params;
    const { type, title, url } = req.body;
    const coachId = req.user.id;

    if (!type || !title) {
      return res.status(400).json({ message: "Type and title are required" });
    }

    const course = await FreeCourse.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Free course not found" });
    }

    // 🔐 ensure coach owns the course
    if (course.coachId.toString() !== coachId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    let finalUrl = "";

    // FILE upload
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: "free-learning/content",
              resource_type: "auto",
            },
            (err, result) => {
              if (err) reject(err);
              resolve(result);
            }
          )
          .end(req.file.buffer);
      });

      finalUrl = uploadResult.secure_url;
    }

    // URL fallback
    if (!finalUrl && url) {
      finalUrl = url.trim();
    }

    if (!finalUrl) {
      return res.status(400).json({
        message: "Provide a file or a URL",
      });
    }

    const content = await FreeCourseContent.create({
      courseId,
      type,
      title: title.trim(),
      url: finalUrl,
    });

    res.status(201).json({
      message: "Content added successfully",
      content,
    });
  } catch (err) {
    console.error("Add free content error:", err);
    res.status(500).json({ message: "Server error" });
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
    const course = await FreeCourse.findById(courseId);

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
// get free course contents for COACH (owner only)
export const getFreeCourseContentForCoach = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { courseId } = req.params;

    // validate course
    const course = await FreeCourse.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Free course not found" });
    }

    // 🔐 ensure coach owns the course
    if (course.coachId.toString() !== coachId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const contents = await FreeCourseContent.find({ courseId }).sort({
      createdAt: 1,
    });

    res.json({ contents });
  } catch (err) {
    console.error("Get free content (coach) error:", err);
    res.status(500).json({ message: "Failed to load contents" });
  }
};
// ✅ get free courses created by logged-in coach
export const getMyFreeCoursesForCoach = async (req, res) => {
  try {
    const coachId = req.user.id;

    const courses = await FreeCourse.find({
      coachId: coachId, // 👈 strict ownership
    }).sort({ createdAt: -1 });

    res.json({ courses });
  } catch (err) {
    console.error("Get coach free courses error:", err);
    res.status(500).json({ message: "Failed to load courses" });
  }
};
