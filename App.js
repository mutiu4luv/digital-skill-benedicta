import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import "./utilitis/classSchedular.js";
import userRoutes from "./routes/userRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";
import barChartAnalysisRoutes from "./routes/barChartAnalysis.js";
import analyticsRoutes from "./routes/analysis.js";
import feedback from "./routes/feedback.js";
import coachUploadRoute from "./routes/coachUpload.js";
import courseRoute from "./routes/corse.js";
import registrationRoutes from "./routes/registrationCourse.js";
import cohort from "./routes/cohort.js";
import "./cron/autoOpenClass.js";
import "./cron/autoCloseClass.js";

dotenv.config();

const app = express();

// ✅ 1. Enable CORS before everything else
// const allowedOrigins = [
//   "http://localhost:5173",
//   "https://hgsccdigitalskills.vercel.app",
// ];

// app.use(
//   cors({
//     origin: (origin, callback) => {
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         callback(new Error("Not allowed by CORS"));
//       }
//     },
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//     credentials: true,
//   })
// );

const allowedOrigins = [
  "http://localhost:5173",
  "https://hgsccdigitalskills.vercel.app",
];

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// ✅ 2. JSON parser
app.use(express.json());

// ✅ 3. Test route
app.get("/", (req, res) => {
  res.send("HGSC² Digital Skills API is running...");
});

// ✅ 4. Routes
app.use("/api/users", userRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/analytics", barChartAnalysisRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/feedbacks", feedback);
app.use("/api/coach", coachUploadRoute);
app.use("/api/course", courseRoute);
app.use("/api", registrationRoutes);
app.use("/api/cohort", cohort);

// ✅ 5. MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => console.error("❌ MongoDB connection failed:", err));
