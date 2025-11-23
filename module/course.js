// import mongoose from "mongoose";

// const courseSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   category: { type: String },
//   description: { type: String },
//   coach: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//   duration: {
//     type: String,
//     enum: ["1-month", "3-months", "6-months"], // duration dropdown
//     required: true,
//   },
//   students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
//   classDay: { type: String },
//   classTime: { type: String },
//   classStartTime: { type: Date },
//   classEndTime: { type: Date },
//   isClassOpen: { type: Boolean, default: false },
// });

// export default mongoose.model("Course", courseSchema);

import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Course name is required"],
      trim: true,
    },
    image: { type: String, default: "" }, // URL from Cloudinary

    category: {
      type: String,
      required: [true, "Category is required"],
    },
    description: {
      type: String,
      default: "",
    },
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // duration: {
    //   type: String,
    //   required: [true, "Duration is required"],
    //   validate: {
    //     validator: function (v) {
    //       // Allow "1-month" as well now
    //       return /^(?:1|[3-9]|1[0-2])-months$|^[1-9]-year$/.test(v);
    //     },
    //     message: (props) =>
    //       `${props.value} is not a valid duration! Use "1-month", "3-months", "6-months", or "1-year"`,
    //   },
    // },
    duration: {
      type: String,
      required: [true, "Duration is required"],
      enum: ["1-month", "3-months", "6-months", "1-year"],
    },

    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isClassOpen: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Course = mongoose.model("Course", courseSchema);

export default Course;
