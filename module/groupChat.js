import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const groupChatSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: ["users", "coaches"],
      unique: true,
      required: true,
    },
    messages: { type: [groupMessageSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("GroupChat", groupChatSchema);
