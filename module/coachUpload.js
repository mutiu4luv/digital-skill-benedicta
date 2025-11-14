import mongoose from "mongoose";

const materialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["video", "document"],
      required: true,
    },
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    unlockAt: { type: Date, default: Date.now }, // time when material becomes visible
    createdAt: { type: Date, default: Date.now },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" }, // new
  },

  { timestamps: true }
);

export default mongoose.model("CoachUpload", materialSchema);
