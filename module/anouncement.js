import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },

    button: {
      type: String,
      enum: ["whatsapp", "telegram", "youtube", null],
      default: null,
    },

    whatsappLink: { type: String },
    telegramLink: { type: String },
    youtubeLink: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Announcement", announcementSchema);
