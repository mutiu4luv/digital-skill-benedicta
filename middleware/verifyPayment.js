import User from "../module/userModule.js";

export const verifyPayment = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { cohortId } = req.params;

    const user = await User.findById(studentId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check payment RECORD for this cohort only
    const record = user.payments?.find(
      (p) => String(p.cohortId) === String(cohortId)
    );

    if (!record || !record.paid || !record.paymentConfirmed) {
      return res.status(403).json({
        message: "You have not paid for this cohort.",
      });
    }

    next();
  } catch (err) {
    console.error("verifyCohortPayment Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
