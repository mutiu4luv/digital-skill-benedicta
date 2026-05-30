import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, required: true, trim: true },
    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    dislikedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

const groupChatSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: ["students", "coaches"],
      unique: true,
      required: true,
    },
    messages: { type: [groupMessageSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("GroupChat", groupChatSchema);
