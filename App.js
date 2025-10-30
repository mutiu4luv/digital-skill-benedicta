import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";

dotenv.config();

const app = express();

// ✅ Configure CORS properly
app.use(
  cors({
    origin: [
      "https://hgsccdigitalskills.vercel.app", // your frontend domain
      "http://localhost:3000", // for local testing
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true, // allows cookies or auth headers if needed
  })
);

app.use(express.json());

// ✅ Routes
app.use("/api/users", userRoutes);

app.get("/", (req, res) => {
  res.send("HGSC² Digital Skills API is running...");
});

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => console.error("❌ MongoDB connection failed:", err));
