import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
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
  dueDate: { type: Date, required: true },
  isExpired: { type: Boolean, default: false },
  submissions: [
    {
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      fileUrl: { type: String, required: true },
      submittedAt: { type: Date, default: Date.now },
      grade: { type: Number },
    },
  ],
});

export default mongoose.model("Assignment", assignmentSchema);
