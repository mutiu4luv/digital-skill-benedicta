import Cohort from "../module/cohort.js";

// ✅ Start live session by coach
export const startLiveSession = async (req, res) => {
  const { cohortId, courseId } = req.params;
  const { meetLink } = req.body;
  const userId = req.user.id;

  const cohort = await Cohort.findById(cohortId);
  if (!cohort) return res.status(404).json({ message: "Cohort not found" });

  // 🔥 MUST MATCH SUBDOCUMENT
  const course = cohort.courses.find(
    (c) => c._id.toString() === courseId || c.courseId.toString() === courseId
  );

  if (!course) {
    return res.status(404).json({ message: "Course not found in cohort" });
  }

  // Coach-only
  if (course.coachId.toString() !== userId) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  // ✅ WRITE TO THE SAME DOCUMENT STUDENTS READ
  course.liveSession = {
    isLive: true,
    meetLink,
    startedAt: new Date(),
  };

  // 🚨 REQUIRED FOR SUBDOC UPDATE
  cohort.markModified("courses");

  await cohort.save();

  console.log("✅ LIVE SAVED ON COURSE:", {
    subId: course._id.toString(),
    courseId: course.courseId.toString(),
    liveSession: course.liveSession,
  });

  res.json({ success: true });
};

// export const startLiveSession = async (req, res) => {
//   const { cohortId, courseId } = req.params; // courseId = subdocument _id
//   const { meetLink } = req.body;
//   const coachId = req.user.id;

//   if (!meetLink) {
//     return res.status(400).json({ message: "Meet link required" });
//   }

//   const cohort = await Cohort.findById(cohortId);
//   if (!cohort) return res.status(404).json({ message: "Cohort not found" });

//   // Use subdocument _id for matching
//   const course = cohort.courses.find(
//     (c) =>
//       c._id.toString() === courseId &&
//       c.coachId &&
//       c.coachId.toString() === coachId
//   );

//   if (!course) {
//     return res.status(403).json({ message: "Not authorized" });
//   }

//   course.liveSession = {
//     meetLink,
//     startedAt: new Date(),
//     isLive: true,
//   };

//   await cohort.save();

//   // 🔔 Notify students via socket
//   req.io.to(`${cohortId}:${courseId}`).emit("liveStarted", {
//     meetLink,
//     courseId,
//   });

//   res.json({ success: true, meetLink });
// };

// ✅ Get live session status
export const getLiveSession = async (req, res) => {
  const { cohortId, courseId } = req.params;
  const userId = req.user.id;

  const cohort = await Cohort.findById(cohortId);
  if (!cohort) return res.json({ isLive: false });

  // Use subdocument _id for matching
  const course = cohort.courses.find(
    (c) => c._id.toString() === courseId || c.courseId.toString() === courseId
  );
  if (!course || !course.liveSession?.isLive) {
    return res.json({ isLive: false });
  }

  const isCoach = course.coachId?.toString() === userId;

  const isStudent = cohort.studentIds.some(
    (s) =>
      s.studentId.toString() === userId &&
      s.enrollments.some(
        (e) =>
          e.courseId.toString() === course.courseId.toString() && e.hasAccess
      )
  );

  if (!isCoach && !isStudent) {
    return res.status(403).json({ isLive: false });
  }

  return res.json({
    isLive: true,
    meetLink: course.liveSession.meetLink,
    startedAt: course.liveSession.startedAt,
  });
};

// ✅ End live session
export const endLiveSession = async (req, res) => {
  const { cohortId, courseId } = req.params;
  const coachId = req.user.id;

  const cohort = await Cohort.findById(cohortId);
  if (!cohort) return res.status(404).json({ message: "Cohort not found" });

  // Use subdocument _id for matching
  const course = cohort.courses.find((c) => c._id.toString() === courseId);
  if (!course) return res.status(404).json({ message: "Course not found" });

  if (course.coachId.toString() !== coachId) {
    return res.status(403).json({ message: "Not authorized" });
  }

  course.liveSession.isLive = false;
  await cohort.save();

  // 🔔 Notify students via socket
  req.io.to(`${cohortId}:${courseId}`).emit("liveEnded", { courseId });

  res.json({ success: true });
};
