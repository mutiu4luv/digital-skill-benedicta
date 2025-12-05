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
