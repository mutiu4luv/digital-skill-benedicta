import mongoose from "mongoose";

const cohortSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // The creator of the cohort

    courses: [
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
        durationInDays: {
          type: Number,
          required: true,
          min: [1, "Duration must be at least 1 day"],
        },
      },
    ],

    startDate: { type: Date },
    endDate: { type: Date },

    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },

    studentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Cohort", cohortSchema);
