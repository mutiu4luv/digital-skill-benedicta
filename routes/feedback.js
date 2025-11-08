import express from "express";
import { submitFeedback } from "../controller/feedback.js";

const router = express.Router();
router.post("/", submitFeedback);

export default router;
