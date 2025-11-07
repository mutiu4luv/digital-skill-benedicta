import mongoose from "mongoose";

const barChartAnalysisSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g., 'student', 'assignment', 'coachingSession'
  count: { type: Number, required: true },
  month: { type: String, required: true }, // e.g., 'Jan', 'Feb', etc.
  year: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const BarChartAnalysis = mongoose.model("BarChartAnalysis", barChartAnalysisSchema);
export default BarChartAnalysis;
