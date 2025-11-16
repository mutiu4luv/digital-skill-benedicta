import mongoose from "mongoose";

const cohortSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // the creator
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },
    studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    durationInDays: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Cohort", cohortSchema);
