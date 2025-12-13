import CohortChat from "../module/chat.js";
import Cohort from "../module/cohort.js";

// Send a message in cohort chat
export const sendCohortMessage = async (req, res) => {
  const { cohortId } = req.params;
  const { text } = req.body;
  const senderId = req.user.id;

  if (!text)
    return res.status(400).json({ message: "Message text is required" });

  try {
    const cohort = await Cohort.findById(cohortId);
    if (!cohort) return res.status(404).json({ message: "Cohort not found" });

    // Ensure sender is part of the cohort (coach or student)
    const isCoach = cohort.courses.some(
      (c) => c.coachId.toString() === senderId
    );
    const isStudent = cohort.studentIds.some(
      (s) => s.studentId.toString() === senderId
    );

    if (!isCoach && !isStudent) {
      return res
        .status(403)
        .json({ message: "You are not part of this cohort" });
    }

    let chat = await CohortChat.findOne({ cohortId });
    if (!chat) {
      chat = new CohortChat({
        cohortId,
        coachId: cohort.courses[0].coachId,
        messages: [],
      });
    }

    const message = { senderId, text, timestamp: new Date() };
    chat.messages.push(message);

    await chat.save();

    // Emit message via socket.io
    req.io.to(cohortId).emit("newMessage", message);

    return res.status(200).json({ message: "Message sent", data: message });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// Get all messages in cohort chat
export const getCohortMessages = async (req, res) => {
  const { cohortId } = req.params;
  const userId = req.user.id;

  try {
    const cohort = await Cohort.findById(cohortId);
    if (!cohort) return res.status(404).json({ message: "Cohort not found" });

    const isCoach = cohort.courses.some((c) => c.coachId.toString() === userId);
    const isStudent = cohort.studentIds.some(
      (s) => s.studentId.toString() === userId
    );

    if (!isCoach && !isStudent) {
      return res
        .status(403)
        .json({ message: "You are not part of this cohort" });
    }

    const chat = await CohortChat.findOne({ cohortId }).populate(
      "messages.senderId",
      "fullName email"
    );

    return res.status(200).json({ messages: chat?.messages || [] });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};
