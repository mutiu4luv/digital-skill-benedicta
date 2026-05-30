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
  sendBroadcastEmail,
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

const uploadProfilePhoto = (req, res, next) => {
  upload.single("profilePhoto")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message:
          "Profile image is too large. Maximum allowed size is 5MB. Please compress the image or choose a smaller one.",
        stage: "multer",
        error: "File too large",
      });
    }

    if (err) {
      return res.status(400).json({
        message: "Invalid profile image upload.",
        stage: "multer",
        error: err.message,
      });
    }

    next();
  });
};

router.post("/register", uploadProfilePhoto, registerUser);
router.post("/verify-email", verifyEmail);
router.post("/login", loginUser);

// ✅ PROFILE ROUTES FIRST
router.get("/me", protect, getMyProfile);
router.put("/profile", protect, upload.single("profilePhoto"), updateProfile);

// ✅ OTHER FIXED ROUTES
router.get("/coaches", protect, getAllCoaches);
router.get("/all", protect, authorizeRoles("owner"), getAllUsers);
router.post(
  "/broadcast-email",
  protect,
  authorizeRoles("owner"),
  sendBroadcastEmail
);

router.put("/:id", protect, authorizeRoles("owner"), updateUser);
router.delete("/:id", protect, authorizeRoles("owner"), deleteUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
