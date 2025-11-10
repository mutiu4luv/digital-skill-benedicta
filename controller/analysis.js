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

    // Get all feedback, assignments, and sessions for the coach
    const feedbacks = await Feedback.find({ coach: coachId });

    // 💡 Improvement: Filter assignments to only count those the coach has reviewed (assuming an 'isReviewed' field)
    const assignmentsReviewed = await Assignment.find({
      coach: coachId,
      isReviewed: true,
    });

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
          sessionsCount: 0, // Changed to sessionsCount for clarity
          studentsTaught: 0,
          assignmentsReviewedCount: 0, // Changed for clarity
          totalRating: 0,
          ratingsCount: 0, // New field to track the total number of ratings
        };
      }
    };

    // 1. Aggregate Feedback & Ratings
    feedbacks.forEach((f) => {
      const month = getMonthKey(f.createdAt);
      initializeMonth(month);

      monthlyData[month].totalRating += f.rating;
      monthlyData[month].ratingsCount += 1; // Increment the count of ratings
    });

    // 2. Aggregate Sessions (Assuming attended students are "studentsTaught")
    sessions.forEach((s) => {
      const month = getMonthKey(s.createdAt);
      initializeMonth(month);

      monthlyData[month].sessionsCount += 1;
      // Assuming 'attended' is the array of student IDs
      monthlyData[month].studentsTaught += s.attended ? s.attended.length : 0;
    });

    // 3. Aggregate Assignments Reviewed
    // We are only iterating over assignments that are already filtered by { isReviewed: true } in the query
    assignmentsReviewed.forEach((a) => {
      const month = getMonthKey(a.updatedAt || a.createdAt); // Use updatedAt if possible, or createdAt
      initializeMonth(month);

      monthlyData[month].assignmentsReviewedCount += 1;
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
        avgRating: avgRating.toFixed(1), // Calculate and format average rating
      };
    });

    // Sort by month (optional but recommended for charts)
    // For more robust sorting, you'd track the month number, but name sort is fine for a single year view.
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
