import Feedback from "../module/feedback.js";
import User from "../module/userModule.js";

export const submitFeedback = async (req, res) => {
  try {
    const { studentId, coachId, rating, comment } = req.body;

    // ✅ Save feedback
    const feedback = await Feedback.create({
      student: studentId,
      coach: coachId,
      rating,
      comment,
    });

    // ✅ Recalculate coach average rating
    const feedbacks = await Feedback.find({ coach: coachId });
    const avgRating =
      feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;

    // ✅ Update coach record with new rating
    await User.findByIdAndUpdate(coachId, { avgRating });

    res.status(201).json({
      message: "Feedback submitted successfully",
      feedback,
      avgRating,
    });
  } catch (error) {
    console.error("❌ Feedback submission error:", error);
    res.status(500).json({ message: "Error submitting feedback", error });
  }
};

// 🧠 Get all coaches with ratings (owner only)
export const getCoachesRatings = async (req, res) => {
  try {
    const coaches = await User.find({ role: "coach" })
      .select("fullName email avgRating")
      .sort({ avgRating: -1 });

    res.json(coaches);
  } catch (error) {
    console.error("❌ Error fetching coaches ratings:", error);
    res.status(500).json({ message: "Error fetching coach ratings" });
  }
};
