import mongoose from "mongoose";

const freeCourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    image: {
      type: String,
      default: "",
    },
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("FreeCourse", freeCourseSchema);
