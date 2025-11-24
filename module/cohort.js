import mongoose from "mongoose";

const courseSubSchema = new mongoose.Schema(
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
    },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  { _id: true, minimize: false }
);

const cohortSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    courses: {
      type: [courseSubSchema],
      default: [],
    },

    studentIds: [
      {
        studentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        enrollments: [
          {
            courseId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Course",
              required: true,
            },
            paid: { type: Boolean, default: false },
            paymentConfirmed: { type: Boolean, default: false },
            hasAccess: { type: Boolean, default: false },
            paidAt: { type: Date, default: null },
          },
        ],
      },
    ],
  },
  { timestamps: true, minimize: false }
);

export default mongoose.model("Cohort", cohortSchema); // <-- use `export default`
