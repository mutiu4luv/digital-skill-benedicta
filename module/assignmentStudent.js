import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  submittedAt: { type: Date, default: Date.now },
  grade: { type: Number },
});

export default mongoose.model("Assignment", assignmentSchema);
