import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },

    duration: {
      type: String,
      enum: ["1-month", "3-months", "6-months"],
      required: true,
    },

    // class schedule
    classStartTime: { type: Date, required: false },
    classEndTime: { type: Date },
    duration: { type: String, required: true }, // take from course.duration

    // system control
    expiresAt: { type: Date }, // class access expires after 3 hours
    accessActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Registration", registrationSchema);
