import mongoose from "mongoose";

const coachingSessionSchema = new mongoose.Schema({
  coach: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  attended: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // students who attended
  date: { type: Date, required: true },
  feedbacks: [
    {
      student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("CoachingSession", coachingSessionSchema);
