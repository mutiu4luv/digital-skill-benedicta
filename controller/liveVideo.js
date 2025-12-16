import Cohort from "../module/cohort.js";

export const startLiveSession = async (req, res) => {
  const { cohortId, courseId } = req.params;
  const { meetLink } = req.body;
  const coachId = req.user.id;

  if (!meetLink) {
    return res.status(400).json({ message: "Meet link required" });
  }

  const cohort = await Cohort.findById(cohortId);
  if (!cohort) return res.status(404).json({ message: "Cohort not found" });

  const course = cohort.courses.find(
    (c) => c._id.toString() === courseId && c.coachId.toString() === coachId
  );

  if (!course) {
    return res.status(403).json({ message: "Not authorized" });
  }

  course.liveSession = {
    meetLink,
    startedAt: new Date(),
    isLive: true,
  };

  await cohort.save();

  // 🔔 Notify students via socket
  req.io.to(`${cohortId}:${courseId}`).emit("liveStarted", {
    meetLink,
    courseId,
  });

  res.json({ success: true, meetLink });
};

// ✅ Get live session status

export const getLiveSession = async (req, res) => {
  const { cohortId, courseId } = req.params;
  const userId = req.user.id;

  const cohort = await Cohort.findById(cohortId);
  if (!cohort) return res.status(404).json({});

  const course = cohort.courses.find((c) => c.courseId.toString() === courseId);
  if (!course?.liveSession?.isLive) {
    return res.json({ isLive: false });
  }

  // access check (coach OR enrolled student)
  const isCoach = course.coachId.toString() === userId;
  const isStudent = cohort.studentIds.some(
    (s) =>
      s.studentId.toString() === userId &&
      s.enrollments.some(
        (e) => e.courseId.toString() === courseId && e.hasAccess
      )
  );

  if (!isCoach && !isStudent) {
    return res.status(403).json({});
  }

  res.json({
    isLive: true,
    meetLink: course.liveSession.meetLink,
  });
};
