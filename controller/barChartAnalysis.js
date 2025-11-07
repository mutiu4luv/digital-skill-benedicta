import BarChartAnalysis from "../module/barChartAnalysis.js";
import User from "../module/userModule.js";
// If you have Assignment and CoachingSession models, import them here
// import Assignment from "../module/assignmentModule.js";
// import CoachingSession from "../module/coachingSessionModule.js";

// 📊 Analytics endpoint
export const getAnalytics = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    // Students registered per month
    const students = await User.find({
      role: "student",
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`),
      },
    });
    // Assignments submitted per month
    let assignments = [];
    // if (typeof Assignment !== "undefined") {
    //   assignments = await Assignment.find({
    //     createdAt: {
    //       $gte: new Date(`${year}-01-01`),
    //       $lte: new Date(`${year}-12-31`),
    //     },
    //   });
    // }
    // Coaching sessions per month
    let sessions = [];
    // if (typeof CoachingSession !== "undefined") {
    //   sessions = await CoachingSession.find({
    //     createdAt: {
    //       $gte: new Date(`${year}-01-01`),
    //       $lte: new Date(`${year}-12-31`),
    //     },
    //   });
    // }
    // Helper to get monthly counts
    function getMonthlyCounts(docs, type, dateField = "createdAt") {
      const months = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(0, i).toLocaleString("default", { month: "short" }),
        count: 0,
      }));
      docs.forEach((doc) => {
        const date = new Date(doc[dateField]);
        const month = date.getMonth();
        months[month].count += 1;
      });
      // Store each month's data in BarChartAnalysis collection
      months.forEach((m) => {
        BarChartAnalysis.findOneAndUpdate(
          { type, month: m.month, year },
          { $set: { count: m.count, createdAt: new Date() } },
          { upsert: true, new: true }
        ).exec();
      });
      return months;
    }
    const studentRegistrations = getMonthlyCounts(students, "student");
    const assignmentSubmissions = getMonthlyCounts(assignments, "assignment");
    const coachingSessions = getMonthlyCounts(sessions, "coachingSession");
    // Fetch all analytics for frontend display
    const analyticsData = await BarChartAnalysis.find({ year });
    res.json({
      studentRegistrations,
      assignmentSubmissions,
      coachingSessions,
      analyticsData,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Analytics fetch failed", error: error.message });
  }
};
