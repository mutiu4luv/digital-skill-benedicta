import Feedback from "../module/feedback.js";

export const submitFeedback = async (req, res) => {
  try {
    const { studentId, coachId, rating, comment } = req.body;

    const feedback = await Feedback.create({
      student: studentId,
      coach: coachId,
      rating,
      comment,
    });

    res
      .status(201)
      .json({ message: "Feedback submitted successfully", feedback });
  } catch (error) {
    console.error("❌ Feedback submission error:", error);
    res.status(500).json({ message: "Error submitting feedback", error });
  }
};
