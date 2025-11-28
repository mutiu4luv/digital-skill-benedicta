import express from "express";

import { authorizeRoles, protect } from "../middleware/authMiddleware.js";
import {
  createAnnouncement,
  getAnnouncements,
} from "../controller/anouncement.js";

const router = express.Router();

// CEO creates announcement
router.post("/", protect, authorizeRoles("owner"), createAnnouncement);

// All users can view announcements
router.get("/", protect, getAnnouncements);

export default router;
