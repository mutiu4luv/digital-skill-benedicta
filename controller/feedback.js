import Feedback from "../module/feedback.js";
import User from "../module/userModule.js";
import mongoose from "mongoose";

export const submitFeedback = async (req, res) => {
  try {
    const { studentId, coachId, rating, comment } = req.body;

    // ✅ Basic validation
    if (!studentId || !coachId || !rating) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (
      !mongoose.Types.ObjectId.isValid(studentId) ||
      !mongoose.Types.ObjectId.isValid(coachId)
    ) {
      return res.status(400).json({ message: "Invalid studentId or coachId" });
    }

    // ✅ Save feedback
    const feedback = await Feedback.create({
      student: studentId,
      coach: coachId,
      rating,
      comment: comment || "",
    });

    // ✅ Recalculate coach average rating
    const feedbacks = await Feedback.find({ coach: coachId });
    const avgRating =
      feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;

    // ✅ Update coach record with new rating
    await User.findByIdAndUpdate(coachId, { avgRating });

    return res.status(201).json({
      message: "Feedback submitted successfully",
      feedback,
      avgRating,
    });
  } catch (error) {
    console.error("❌ Feedback submission error:", error);
    return res
      .status(500)
      .json({ message: "Error submitting feedback", error: error.message });
  }
};

// export const submitFeedback = async (req, res) => {
//   try {
//     const { studentId, coachId, rating, comment } = req.body;

//     // ✅ Save feedback
//     const feedback = await Feedback.create({
//       student: studentId,
//       coach: coachId,
//       rating,
//       comment,
//     });

//     // ✅ Recalculate coach average rating
//     const feedbacks = await Feedback.find({ coach: coachId });
//     const avgRating =
//       feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;

//     // ✅ Update coach record with new rating
//     await User.findByIdAndUpdate(coachId, { avgRating });

//     res.status(201).json({
//       message: "Feedback submitted successfully",
//       feedback,
//       avgRating,
//     });
//   } catch (error) {
//     console.error("❌ Feedback submission error:", error);
//     res.status(500).json({ message: "Error submitting feedback", error });
//   }
// };

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

export const getCoachMonthlyRatings = async (req, res) => {
  try {
    const coachId = req.user._id; // Extracted from JWT via auth middleware

    const ratings = await Feedback.find({ coach: coachId })
      .select("rating createdAt")
      .sort({ createdAt: 1 });

    return res.json(ratings);
  } catch (error) {
    console.error("❌ Error fetching coach rating history:", error);
    res.status(500).json({
      message: "Error fetching rating history",
      error: error.message,
    });
  }
};
