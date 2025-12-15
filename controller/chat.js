import mongoose from "mongoose";
import CohortChat from "../module/chat.js";
import Cohort from "../module/cohort.js";

// Send a message to a cohort chat for a specific course
export const sendCohortMessage = async (req, res) => {
  const { cohortId, courseId } = req.params;
  const { text } = req.body;
  const senderId = req.user._id;

  if (!text?.trim()) {
    return res.status(400).json({ message: "Message text is required" });
  }

  try {
    const cohort = await Cohort.findById(cohortId);
    if (!cohort) {
      return res.status(404).json({ message: "Cohort not found" });
    }

    const course = cohort.courses.find(
      (c) => c.courseId.toString() === courseId
    );

    if (!course) {
      return res.status(404).json({ message: "Course not found in cohort" });
    }

    let chat = await CohortChat.findOne({ cohortId, courseId });

    if (!chat) {
      chat = new CohortChat({
        cohortId,
        courseId,
        coachId: course.coachId,
        messages: [],
      });
    }

    const message = {
      _id: new mongoose.Types.ObjectId(),
      senderId,
      text,
      timestamp: new Date(),
    };

    chat.messages.push(message);
    await chat.save();

    req.io.to(`${cohortId}:${courseId}`).emit("cohortMessage", message);

    return res.status(200).json(message);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get messages for a cohort chat for a specific course
export const getCohortMessages = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { cohortId, courseId } = req.params;
    const userId = req.user._id.toString();

    const cohort = await Cohort.findById(cohortId);
    if (!cohort) {
      return res.status(404).json({ message: "Cohort not found" });
    }

    const courses = cohort.courses || [];
    const students = cohort.studentIds || [];

    const course = courses.find(
      (c) =>
        c.courseId?.toString() === courseId && c.coachId?.toString() === userId
    );

    const isCoachForCourse = Boolean(course);

    const studentRecord = students.find(
      (s) => s.studentId?.toString() === userId
    );

    const hasStudentAccess =
      studentRecord &&
      studentRecord.enrollments?.some(
        (e) => e.courseId.toString() === courseId && e.hasAccess === true
      );

    if (!isCoachForCourse && !hasStudentAccess) {
      return res.status(403).json({
        message: "You do not have access to this course chat",
      });
    }

    const chat = await CohortChat.findOne({ cohortId, courseId }).populate(
      "messages.senderId",
      "fullName email role"
    );

    return res.status(200).json({
      messages: chat?.messages || [],
    });
  } catch (err) {
    console.error("Get cohort messages error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
