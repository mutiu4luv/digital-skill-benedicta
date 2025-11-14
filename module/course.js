import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String },
  description: { type: String },
  coach: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  duration: {
    type: String,
    enum: ["1-month", "3-months", "6-months"], // duration dropdown
    required: true,
  },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  classDay: { type: String },
  classTime: { type: String },
  classStartTime: { type: Date },
  classEndTime: { type: Date },
  isClassOpen: { type: Boolean, default: false },
});

export default mongoose.model("Course", courseSchema);
