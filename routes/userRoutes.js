import express from "express";
import multer from "multer";
import {
  registerUser,
  verifyEmail,
  loginUser,
  getAllUsers,
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
router.get("/all", protect, authorizeRoles("owner"), getAllUsers);

export default router;
