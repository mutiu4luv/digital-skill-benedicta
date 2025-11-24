import User from "../module/userModule.js";

export const verifyPayment = async (req, res, next) => {
  try {
    const studentId = req.user.id; // Assuming JWT auth

    const user = await User.findById(studentId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Only allow if both paid and paymentConfirmed are true
    if (!user.paid || !user.paymentConfirmed) {
      return res.status(403).json({
        message: "Access denied. Payment required to access the class.",
      });
    }

    next(); // User can access the route
  } catch (err) {
    console.error("Verify Payment Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
