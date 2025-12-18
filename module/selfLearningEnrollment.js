import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SelfLearningCourse",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active"],
      default: "pending",
    },

    paid: { type: Boolean, default: false },
    paymentConfirmed: { type: Boolean, default: false },
    paidAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("SelfLearningEnrollment", enrollmentSchema);
