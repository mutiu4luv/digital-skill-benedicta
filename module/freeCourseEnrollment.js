import mongoose from "mongoose";

const freeEnrollmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FreeCourse",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("FreeCourseEnrollment", freeEnrollmentSchema);
