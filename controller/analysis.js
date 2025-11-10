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
    const feedbacks = await Feedback.find({ coach: coachId }); // FIX: Use 'Feedback' model
    const assignments = await Assignment.find({ coach: coachId });
    const sessions = await CoachingSession.find({ coach: coachId });

    // Group by month
    const monthlyData = {};

    // Helper function to get the month key (e.g., 'Jan', 'Feb')
    const getMonthKey = (date) =>
      new Date(date).toLocaleString("default", { month: "short" });

    // Aggregate Feedback
    feedbacks.forEach((f) => {
      const month = getMonthKey(f.createdAt);
      if (!monthlyData[month])
        monthlyData[month] = {
          month,
          sessions: 0,
          studentsTaught: 0,
          assignmentsReviewed: 0,
          avgRating: 0,
          ratings: new Set(),
          totalRating: 0,
        };

      monthlyData[month].totalRating += f.rating;
      monthlyData[month].ratings.add(f._id.toString()); // Use Set to count number of ratings
      // NOTE: studentsTaught calculation is complex without more context. Assuming a rating equals a student interaction for now.
    });

    // Aggregate Sessions (assuming attended students are "studentsTaught")
    sessions.forEach((s) => {
      const month = getMonthKey(s.createdAt);
      if (!monthlyData[month])
        monthlyData[month] = {
          month,
          sessions: 0,
          studentsTaught: 0,
          assignmentsReviewed: 0,
          avgRating: 0,
          ratings: new Set(),
          totalRating: 0,
        };

      monthlyData[month].sessions += 1;
      monthlyData[month].studentsTaught += s.attended.length; // Assuming 'attended' is the array of student IDs
    });

    // Aggregate Assignments Reviewed
    assignments.forEach((a) => {
      const month = getMonthKey(a.createdAt);
      if (!monthlyData[month])
        monthlyData[month] = {
          month,
          sessions: 0,
          studentsTaught: 0,
          assignmentsReviewed: 0,
          avgRating: 0,
          ratings: new Set(),
          totalRating: 0,
        };

      monthlyData[month].assignmentsReviewed += 1;
    });

    // Finalize data and calculate averages
    const monthlyPerformance = Object.values(monthlyData).map((data) => ({
      ...data,
      avgRating:
        data.ratings.size > 0
          ? (data.totalRating / data.ratings.size).toFixed(1)
          : 0, // Calculate average rating
      ratings: undefined, // Remove internal array
      totalRating: undefined, // Remove internal total
    }));

    // Sort by month (optional but recommended for charts)
    // You might need a more robust date sorting if you span years
    // For now, simple sort by month name:
    monthlyPerformance.sort((a, b) => a.month.localeCompare(b.month));

    res.json(monthlyPerformance); // <<< FIX: Return the array of monthly performance objects
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Coach performance fetch failed", error: err.message });
  }
};
