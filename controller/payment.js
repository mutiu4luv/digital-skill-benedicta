import User from "../module/userModule.js";

// paymentController.js
export const confirmPayment = async (req, res) => {
  try {
    const { studentId, courseId } = req.body;

    const user = await User.findByIdAndUpdate(
      studentId,
      {
        paid: true,
        paymentConfirmed: true,
        registeredCohort: {
          courseId,
          registeredAt: new Date(),
        },
      },
      { new: true }
    );

    return res.status(200).json({
      message: "Payment confirmed",
      user,
    });
  } catch (err) {
    console.error("Confirm Payment Error:", err);
    return res.status(500).json({ message: "Server error" });
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
