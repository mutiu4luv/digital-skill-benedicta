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

    let filter = {};
    if (coachId) filter.coach = coachId;

    // 🧠 Active students under this coach
    const activeStudents = await User.countDocuments({
      role: "student",
      assignedCoach: coachId,
      status: "active",
    });

    // 😔 Missed sessions
    const missedSessions = await CoachingSession.countDocuments({
      coach: coachId,
      status: "missed",
    });

    // 📝 Assignment submissions
    const assignmentCount = await Assignment.countDocuments({
      coach: coachId,
    });

    // 💬 Student feedback
    const feedbacks = await feedback
      .find({ coach: coachId })
      .populate("student", "name");

    // ⭐ Average rating for this coach
    const ratings = feedbacks.map((f) => f.rating);
    const avgRating = ratings.length
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    res.json({
      coachId,
      activeStudents,
      missedSessions,
      assignmentCount,
      feedbacks,
      avgRating,
    });
  } catch (error) {
    console.error("❌ Coach performance error:", error);
    res
      .status(500)
      .json({ message: "Error fetching coach performance", error });
  }
};
