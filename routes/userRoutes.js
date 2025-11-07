import express from "express";
import multer from "multer";
import {
  registerUser,
  verifyEmail,
  loginUser,
  getAllUsers,
  deleteUser,
  updateUser,
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
router.delete("/:id", protect, authorizeRoles("owner"), deleteUser);
router.put("/:id", protect, authorizeRoles("owner"), updateUser);

export default router;
