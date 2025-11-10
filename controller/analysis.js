import CoachingSession from "../module/coachesSession.js";
import Assignment from "../module/assignmentStudent.js";
import User from "../module/userModule.js";
import Feedback from "../module/feedback.js";

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

    // --- Core Queries: All data is filtered by the requested coachId ---

    // 1. Get all feedbacks given TO this specific coach
    const feedbacks = await Feedback.find({ coach: coachId });

    // 2. Get all assignments REVIEWED by this specific coach (assuming isReviewed: true means the coach completed the review)
    const assignmentsReviewed = await Assignment.find({
      coach: coachId,
      isReviewed: true,
    });

    // 3. Get all sessions led by this specific coach
    const sessions = await CoachingSession.find({ coach: coachId });

    // Grouping structure initialization
    const monthlyData = {};

    // Helper function to get the month key (e.g., 'Jan', 'Feb')
    const getMonthKey = (date) =>
      new Date(date).toLocaleString("default", { month: "short" });

    // Helper to ensure month structure exists
    const initializeMonth = (month) => {
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          sessionsCount: 0,
          studentsTaught: 0,
          assignmentsReviewedCount: 0,
          totalRating: 0,
          ratingsCount: 0,
        };
      }
    };

    // 1. Aggregate Feedback & Ratings (COUNTED FOR THE COACH)
    feedbacks.forEach((f) => {
      const month = getMonthKey(f.createdAt);
      initializeMonth(month);

      monthlyData[month].totalRating += f.rating;
      monthlyData[month].ratingsCount += 1; // Coach gets +1 rating count
    });

    // 2. Aggregate Sessions (COUNTED FOR THE COACH)
    sessions.forEach((s) => {
      const month = getMonthKey(s.createdAt);
      initializeMonth(month);

      monthlyData[month].sessionsCount += 1; // Coach gets +1 session count
      // Coach gets credit for every student who attended their session
      monthlyData[month].studentsTaught += s.attended ? s.attended.length : 0;
    });

    // 3. Aggregate Assignments Reviewed (COUNTED FOR THE COACH)
    assignmentsReviewed.forEach((a) => {
      // Use updatedAt as the time of review, falling back to createdAt
      const month = getMonthKey(a.updatedAt || a.createdAt);
      initializeMonth(month);

      monthlyData[month].assignmentsReviewedCount += 1; // Coach gets +1 reviewed assignment count
    });

    // Finalize data and calculate averages
    const monthlyPerformance = Object.values(monthlyData).map((data) => {
      const avgRating =
        data.ratingsCount > 0 ? data.totalRating / data.ratingsCount : 0;

      return {
        month: data.month,
        sessions: data.sessionsCount,
        studentsTaught: data.studentsTaught,
        assignmentsReviewed: data.assignmentsReviewedCount,
        // The Avg Rating is the coach's average rating for that month
        avgRating: avgRating.toFixed(1),
      };
    });

    // Sort by month (optional but recommended for charts)
    monthlyPerformance.sort((a, b) => {
      const monthOrder = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
    });

    res.json(monthlyPerformance);
  } catch (err) {
    console.error("Coach performance fetch failed:", err);
    res
      .status(500)
      .json({ message: "Coach performance fetch failed", error: err.message });
  }
};
