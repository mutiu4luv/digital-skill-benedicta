import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    cohortId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cohort",
      required: true,
    },
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
    dueDate: { type: Date },
    studentDueDateOverrides: [
      {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        dueDate: { type: Date, required: true },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    submissions: [
      {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        file: { type: String },
        files: [{ type: String }],
        submittedAt: { type: Date, default: Date.now },
        grade: { type: Number },
        feedback: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.CohortAssignment ||
  mongoose.model("CohortAssignment", assignmentSchema);
