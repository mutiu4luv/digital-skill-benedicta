import express from "express";
import multer from "multer";
import {
  registerUser,
  verifyEmail,
  loginUser,
  getAllUsers,
  deleteUser,
  updateUser,
  getAllCoaches,
  updateProfile,
  getMyProfile,
  forgotPassword,
  resetPassword,
} from "../controller/userController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/register", upload.single("profilePhoto"), registerUser);
router.post("/verify-email", verifyEmail);
router.post("/login", loginUser);

// ✅ PROFILE ROUTES FIRST
router.get("/me", protect, getMyProfile);
router.put("/profile", protect, upload.single("profilePhoto"), updateProfile);

// ✅ OTHER FIXED ROUTES
router.get("/coaches", protect, getAllCoaches);
router.get("/all", protect, authorizeRoles("owner"), getAllUsers);

router.put("/:id", protect, authorizeRoles("owner"), updateUser);
router.delete("/:id", protect, authorizeRoles("owner"), deleteUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
