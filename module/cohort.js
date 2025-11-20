const mongoose = require("mongoose");

const cohortSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

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
        status: {
          type: String,
          enum: ["not_started", "in_progress", "completed"],
          default: "not_started",
        },

        // Default null makes your response show undefined fields automatically
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
      },
    ],

    studentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true, minimize: false }
);

module.exports = mongoose.model("Cohort", cohortSchema);
