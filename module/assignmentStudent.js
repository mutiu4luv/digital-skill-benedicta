// import mongoose from "mongoose";

// const assignmentSchema = new mongoose.Schema(
//   {
//     title: { type: String, required: true },
//     description: { type: String },

//     cohortId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Cohort",
//       required: true,
//     },

//     courseId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Course",
//       required: true,
//     },

//     coachId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },

//     dueDate: { type: Date, required: true },
//     isExpired: { type: Boolean, default: false },

//     submissions: [
//       {
//         studentId: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: "User",
//           required: true,
//         },

//         file: { type: String, required: true },
//         submittedAt: { type: Date, default: Date.now },

//         grade: { type: Number, default: null },
//         feedback: { type: String, default: "" },
//       },
//     ],
//   },
//   { timestamps: true }
// );

// export default mongoose.model("Assignment", assignmentSchema);

import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },

    cohortId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cohort",
      required: true,
    },

    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },

    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    dueDate: { type: Date, required: true },

    submissions: [
      {
        studentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        file: { type: String, required: true },
        files: [{ type: String }],
        submittedAt: { type: Date, default: Date.now },
        grade: { type: Number, default: null },
        feedback: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Assignment", assignmentSchema);
