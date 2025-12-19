import mongoose from "mongoose";

const freeCourseContentSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FreeCourse",
      required: true,
    },
    type: {
      type: String,
      enum: ["video", "document", "link"],
      required: true,
    },
    title: { type: String, required: true },
    url: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("FreeCourseContent", freeCourseContentSchema);
