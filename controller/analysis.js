import CoachingSession from "../module/coachesSession.js";
import Assignment from "../module/assignmentStudent.js";
import User from "../module/userModule.js";
import feedback from "../module/feedback.js";

export const getEngagementAnalytics = async (req, res) => {
  try {
    // Only allow owner
    if (req.user.role !== "owner") {
      return res.status(403).json({ message: "Access denied" });
    }

    // Active students (students who attended at least one session)
    const activeStudents = await CoachingSession.distinct("attended");

    // Missed sessions (students who registered but did not attend)
    const sessions = await CoachingSession.find().populate(
      "students attended coach feedbacks.student"
    );
    let missedSessions = 0;
    sessions.forEach((session) => {
      missedSessions += session.students.length - session.attended.length;
    });

    // Assignment submissions
    const assignmentCount = await Assignment.countDocuments();

    // Feedbacks & ratings
    let feedbacks = [];
    let coachRatings = {};
    sessions.forEach((session) => {
      session.feedbacks.forEach((fb) => {
        feedbacks.push({
          coach: session.coach.fullName,
          student: fb.student.fullName,
          rating: fb.rating,
          comment: fb.comment,
        });
        // Aggregate ratings per coach
        if (!coachRatings[session.coach._id])
          coachRatings[session.coach._id] = [];
        coachRatings[session.coach._id].push(fb.rating);
      });
    });

    // Top-performing coaches (by average rating)
    let topCoaches = [];
    for (const coachId in coachRatings) {
      const ratings = coachRatings[coachId];
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      topCoaches.push({
        coachId,
        avgRating: avg,
        ratingsCount: ratings.length,
      });
    }
    topCoaches.sort((a, b) => b.avgRating - a.avgRating);

    res.json({
      activeStudents: activeStudents.length,
      missedSessions,
      assignmentCount,
      feedbacks,
      topCoaches,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Analytics fetch failed", error: err.message });
  }
};

export const getCoachPerformance = async (req, res) => {
  try {
    const { coachId } = req.query;
    if (!coachId) return res.status(400).json({ message: "Coach ID required" });

    // Get all feedback, assignments, and sessions for the coach
    const feedbacks = await Feedback.find({ coach: coachId });
    const assignments = await Assignment.find({ coach: coachId });
    const sessions = await CoachingSession.find({ coach: coachId });

    // Group by month
    const monthlyData = {};

    feedbacks.forEach((f) => {
      const month = new Date(f.createdAt).toLocaleString("default", {
        month: "short",
      });
      if (!monthlyData[month])
        monthlyData[month] = {
          month,
          sessions: 0,
          studentsTaught: 0,
          assignmentsReviewed: 0,
          avgRating: 0,
          ratings: [],
        };
      monthlyData[month].ratings.push(f.rating);
    });

    sessions.forEach((s) => {
      const month = new Date(s.createdAt).toLocaleString("default", {
        month: "short",
      });
      if (!monthlyData[month])
        monthlyData[month] = {
          month,
          sessions: 0,
          studentsTaught: 0,
          assignmentsReviewed: 0,
          avgRating: 0,
          ratings: [],
        };
      monthlyData[month].sessions += 1;
    });

    assignments.forEach((a) => {
      const month = new Date(a.createdAt).toLocaleString("default", {
        month: "short",
      });
      if (!monthlyData[month])
        monthlyData[month] = {
          month,
          sessions: 0,
          studentsTaught: 0,
          assignmentsReviewed: 0,
          avgRating: 0,
          ratings: [],
        };
      monthlyData[month].assignmentsReviewed += 1;
    });

    // Calculate average ratings
    Object.values(monthlyData).forEach((m) => {
      if (m.ratings.length > 0)
        m.avgRating = m.ratings.reduce((a, b) => a + b, 0) / m.ratings.length;
      delete m.ratings;
    });

    res.json({
      coachId,
      monthlyPerformance: Object.values(monthlyData),
    });
  } catch (error) {
    console.error("❌ Error in getCoachPerformance:", error);
    res
      .status(500)
      .json({ message: "Error fetching coach performance", error });
  }
};
