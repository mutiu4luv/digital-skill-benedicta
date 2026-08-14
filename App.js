import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import "./utilitis/classSchedular.js";
import userRoutes from "./routes/userRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";
import barChartAnalysisRoutes from "./routes/barChartAnalysis.js";
import analyticsRoutes from "./routes/analysis.js";
import feedback from "./routes/feedback.js";
import coachUploadRoute from "./routes/coachUpload.js";
import courseRoute from "./routes/corse.js";
import registrationRoutes from "./routes/registrationCourse.js";
import payment from "./routes/payment.js";
import cohort from "./routes/cohort.js";
import "./cron/autoOpenClass.js";
import "./cron/autoCloseClass.js";
import assignmentStudent from "./routes/assignment.js";
import announcementRoutes from "./routes/anouncement.js";
import http from "http";
import { Server } from "socket.io";
import chatRoute from "./routes/chat.js";
import liveVideoRoutes from "./routes/liveVideo.js";
import selfLearningRoutes from "./routes/selfLearning.js";
import freeCourseRoute from "./routes/freeCourse.js";
import directChatRoutes from "./routes/directChat.js";
import groupChatRoutes from "./routes/groupChat.js";
import jwt from "jsonwebtoken";
import User from "./module/userModule.js";
import Cohort from "./module/cohort.js";

dotenv.config();

const app = express();
// Create HTTP server from Express app
const server = http.createServer(app);

// ✅ 1. Enable CORS before everything else
// const allowedOrigins = [
//   "http://localhost:5173",
//   "https://hgsccdigitalskills.vercel.app",
// ];
const allowedOrigins = [
  "https://hgsccdigitalskills.com.ng",
  "https://www.hgsccdigitalskills.com.ng",
  "http://hgsccdigitalskills.com.ng",
  "http://www.hgsccdigitalskills.com.ng",
  "http://localhost:5173",
  "https://hgsccdigitalskills.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // mobile apps, Postman
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// Attach Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

const normalizeGroupChannel = (value) => {
  const channel = String(value || "").toLowerCase();
  if (channel === "users" || channel === "user") return "students";
  return channel;
};

const canAccessGroupChannel = (role, channel) => {
  if (channel === "students") {
    return ["student", "coach", "owner", "admin"].includes(role);
  }
  if (channel === "coaches") {
    return ["coach", "owner", "admin"].includes(role);
  }
  return false;
};

const canJoinCohortRoom = async ({ user, cohortId, courseId }) => {
  if (!user || !cohortId || !courseId) return false;

  const cohort = await Cohort.findById(cohortId).lean();
  if (!cohort) return false;

  const userId = String(user._id || user.id);
  const role = user.role;

  if (["owner", "admin"].includes(role)) return true;

  const course = Array.isArray(cohort.courses)
    ? cohort.courses.find((entry) => String(entry.courseId) === String(courseId))
    : null;

  if (!course) return false;

  if (role === "coach") {
    return String(course.coachId) === userId;
  }

  if (role === "student") {
    const studentEntry = Array.isArray(cohort.studentIds)
      ? cohort.studentIds.find((entry) => String(entry.studentId) === userId)
      : null;

    return Boolean(
      studentEntry &&
        Array.isArray(studentEntry.enrollments) &&
        studentEntry.enrollments.some(
          (enrollment) =>
            String(enrollment.courseId) === String(courseId) &&
            enrollment.hasAccess === true
        )
    );
  }

  return false;
};

io.use(async (socket, next) => {
  try {
    const rawToken =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

    if (!rawToken) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id fullName role").lean();

    if (!user) {
      return next(new Error("Authenticated user not found"));
    }

    socket.data.user = user;
    next();
  } catch (error) {
    next(new Error("Invalid socket token"));
  }
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id, socket.data.user?.role || "unknown");

  socket.on("joinCohort", async (payload = {}) => {
    try {
      const { cohortId, courseId, room } = payload;
      const resolvedRoom =
        room || (cohortId && courseId ? `${cohortId}:${courseId}` : null);

      if (!resolvedRoom || !cohortId || !courseId) {
        console.warn("joinCohort called without valid room payload:", payload);
        socket.emit("socketError", {
          type: "joinCohort",
          message: "A valid cohort room is required.",
        });
        return;
      }

      const allowed = await canJoinCohortRoom({
        user: socket.data.user,
        cohortId,
        courseId,
      });

      if (!allowed) {
        socket.emit("socketError", {
          type: "joinCohort",
          message: "You are not allowed to join this class room.",
        });
        return;
      }

      const roomName = String(resolvedRoom);
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined ${roomName}`);
    } catch (error) {
      console.error("joinCohort socket error:", error);
      socket.emit("socketError", {
        type: "joinCohort",
        message: "Failed to join the class room.",
      });
    }
  });

  socket.on("joinGroupChat", (payload = {}) => {
    const channel = normalizeGroupChannel(payload.channel);
    const role = socket.data.user?.role;
    if (!["students", "coaches"].includes(channel) || !canAccessGroupChannel(role, channel)) {
      socket.emit("socketError", {
        type: "joinGroupChat",
        message: "You are not allowed to join this group chat.",
      });
      return;
    }

    const roomName = `group-chat:${channel}`;
    socket.join(roomName);
    console.log(`Socket ${socket.id} joined ${roomName}`);
  });

  socket.on("groupChatTyping", (payload = {}) => {
    const channel = normalizeGroupChannel(payload.channel);
    const role = socket.data.user?.role;
    if (!["students", "coaches"].includes(channel) || !canAccessGroupChannel(role, channel)) {
      return;
    }

    const roomName = `group-chat:${channel}`;
    socket.to(roomName).emit("groupChatTyping", {
      channel,
      userId: socket.data.user?._id || "",
      firstName: payload.firstName || socket.data.user?.fullName || "User",
      isTyping: Boolean(payload.isTyping),
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});
// ✅ 2. JSON parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
app.use("/api/payment", payment);
app.use("/api/assignment", assignmentStudent);
app.use("/api/announcement", announcementRoutes);
app.use("/api/cohort-chat", chatRoute);
app.use("/api/live", liveVideoRoutes);
app.use("/api/self-learning", selfLearningRoutes);
app.use("/api/free-learning", freeCourseRoute);
app.use("/api/direct-chat", directChatRoutes);
app.use("/api/group-chat", groupChatRoutes);

// ✅ 5. MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => console.error("❌ MongoDB connection failed:", err));
