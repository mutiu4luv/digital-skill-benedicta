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
    // If you have Assignment model, import and use it. Otherwise, skip or adjust.
    let assignments = [];
    if (typeof Assignment !== "undefined") {
      assignments = await Assignment.find({
        createdAt: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      });
    }
    // Coaching sessions per month
    let sessions = [];
    if (typeof CoachingSession !== "undefined") {
      sessions = await CoachingSession.find({
        createdAt: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      });
    }
    // Helper to get monthly counts
    function getMonthlyCounts(docs, dateField = "createdAt") {
      const months = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(0, i).toLocaleString("default", { month: "short" }),
        count: 0,
      }));
      docs.forEach((doc) => {
        const date = new Date(doc[dateField]);
        const month = date.getMonth();
        months[month].count += 1;
      });
      return months;
    }
    const studentRegistrations = getMonthlyCounts(students);
    const assignmentSubmissions = getMonthlyCounts(assignments);
    const coachingSessions = getMonthlyCounts(sessions);
    res.json({ studentRegistrations, assignmentSubmissions, coachingSessions });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Analytics fetch failed", error: error.message });
  }
};
