import Registration from "../module/registerCourse.js";
import User from "../module/userModule.js";
import Course from "../module/course.js";
export const registerCourse = async (req, res) => {
  try {
    const { studentId, courseId, duration, classStartTime } = req.body;

    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Check duplicate registration
    const exists = await Registration.findOne({
      student: studentId,
      course: courseId,
    });
    if (exists) {
      return res
        .status(400)
        .json({ message: "Already registered for this course" });
    }

    // ❗ FIXED — do not convert date before saving
    const start = new Date(classStartTime);
    if (isNaN(start)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);

    // Create registration
    const newReg = await Registration.create({
      student: studentId,
      course: courseId,
      duration,
      classStartTime: start,
      classEndTime: end,
      expiresAt: end,
    });

    // Add student to course
    course.students.push(studentId);
    await course.save();

    // Add course to student
    student.courses.push(courseId);
    await student.save();

    // Nigeria time formatter
    const formatNigeriaTime = (date) =>
      new Date(date).toLocaleString("en-NG", {
        timeZone: "Africa/Lagos",
        hour12: true,
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

    return res.status(201).json({
      message: "Course registration successful!",
      registration: {
        ...newReg._doc,
        classStartTime: formatNigeriaTime(start),
        classEndTime: formatNigeriaTime(end),
        expiresAt: formatNigeriaTime(end),
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getStudentsUnderCoach = async (req, res) => {
  try {
    const coachId = req.user.id;

    const courses = await Course.find({ coach: coachId }).populate(
      "students",
      "fullName email phoneNumber"
    );

    let allStudents = [];

    courses.forEach((course) => {
      allStudents.push(...course.students);
    });

    // Remove duplicates
    const uniqueStudents = [
      ...new Set(allStudents.map((s) => s._id.toString())),
    ].map((id) => allStudents.find((s) => s._id.toString() === id));

    res.json({
      coach: coachId,
      totalStudents: uniqueStudents.length,
      students: uniqueStudents,
    });
  } catch (error) {
    console.error("Error loading coach students:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getCoursesWithStudents = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate("students", "fullName email")
      .populate("coach", "fullName email");

    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch course details" });
  }
};
export const getAllRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find()
      .populate("student", "fullName email phoneNumber")
      .populate("course", "title description duration");

    res.status(200).json({
      count: registrations.length,
      registrations,
    });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
