import mongoose from "mongoose";

const groupChatReadStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    channel: {
      type: String,
      enum: ["students", "coaches"],
      required: true,
    },
    lastReadAt: {
      type: Date,
      default: new Date(0),
    },
  },
  { timestamps: true }
);

groupChatReadStateSchema.index({ userId: 1, channel: 1 }, { unique: true });

export default mongoose.model("GroupChatReadState", groupChatReadStateSchema);
