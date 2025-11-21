import User from "../module/userModule.js";

export const confirmPayment = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.registeredCohort?.cohortId) {
      return res.status(400).json({
        message: "You must register for a cohort before confirming payment",
      });
    }

    if (user.paid) {
      return res
        .status(400)
        .json({ message: "You have already confirmed payment" });
    }

    user.paid = true;
    await user.save();

    return res.status(200).json({
      message: "Payment confirmed. Your registration will be verified shortly.",
    });
  } catch (err) {
    console.error("Payment Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

export const getPaidStudents = async (req, res) => {
  try {
    const students = await User.find({ paid: true }).select(
      "fullName email phoneNumber registeredCohort createdAt"
    );

    return res.status(200).json({ students });
  } catch (err) {
    console.error("Fetch Paid Students Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
