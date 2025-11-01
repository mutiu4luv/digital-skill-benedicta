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
const storage = multer.diskStorage({});
const upload = multer({ storage });

router.post("/register", upload.single("profilePhoto"), registerUser);
router.post("/verify-email", verifyEmail);
router.post("/login", loginUser);
router.get("/all", protect, authorizeRoles("owner"), getAllUsers);

export default router;
