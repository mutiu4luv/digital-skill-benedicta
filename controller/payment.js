import User from "../module/userModule.js";

export const confirmPayment = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.registeredCohorts || user.registeredCohorts.length === 0) {
      return res
        .status(400)
        .json({ message: "You have no pending registrations" });
    }

    // get last registration
    const lastReg = user.registeredCohorts[user.registeredCohorts.length - 1];

    if (lastReg.paid) {
      return res.status(400).json({ message: "Payment already confirmed" });
    }

    lastReg.paid = true;

    await user.save();

    return res.status(200).json({
      message: "Payment confirmed for your most recent course.",
      course: lastReg.courseId,
      cohort: lastReg.cohortId,
    });
  } catch (err) {
    console.error(err);
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

// ADMIN: Confirm Payment for a Student
export const adminConfirmPayment = async (req, res) => {
  try {
    const userId = req.params.id; // student id
    const { courseId } = req.body; // course inside array

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // find course record inside user.courses array
    const courseRecord = user.courses.find(
      (c) => c._id.toString() === courseId
    );

    if (!courseRecord) {
      return res
        .status(404)
        .json({ message: "Course not found for this user" });
    }

    courseRecord.paid = true;
    courseRecord.paymentConfirmed = true;

    await user.save();

    return res.status(200).json({
      message: "Payment successfully confirmed",
      userId,
      courseId,
    });
  } catch (err) {
    console.error("Admin Confirm Payment Error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// GET /api/payment/pending-confirmation
export const getPendingConfirmationStudents = async (req, res) => {
  try {
    const students = await User.find({
      role: "student",
      $or: [{ paid: false }, { paymentConfirmed: false }],
    }).select(
      "fullName email phoneNumber registeredCohort paid paymentConfirmed"
    );

    return res.status(200).json({ students });
  } catch (err) {
    console.error("Fetch Pending Payments Error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
