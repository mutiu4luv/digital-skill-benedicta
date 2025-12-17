import mongoose from "mongoose";

const contentSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SelfLearningCourse",
      required: true,
    },
    type: {
      type: String,
      enum: ["video", "document"],
      required: true,
    },
    title: String,
    url: String, // video link or document link
  },
  { timestamps: true }
);

export default mongoose.model("SelfLearningContent", contentSchema);
