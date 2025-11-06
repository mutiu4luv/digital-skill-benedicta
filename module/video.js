// models/Video.js
import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Video title is required"],
      trim: true,
    },
    videoUrl: {
      type: String,
      required: [true, "Video URL is required"],
    },
    publicId: {
      type: String,
      required: [true, "Cloudinary public ID is required"],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Video", videoSchema);
