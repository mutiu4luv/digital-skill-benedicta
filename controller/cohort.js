import mongoose from "mongoose";
import Cohort from "..//module/cohort.js";
import Course from "../module/course.js";
import userModule from "../module/userModule.js";
import coachUpload from "../module/coachUpload.js";
import User from "../module/userModule.js";
import cloudinary from "../config/cloudnary.js";

//CREATE COHORT
function convertDurationStringToDays(duration) {
  if (!duration) return null;

  const [num, unit] = duration.split("-");

  const n = parseInt(num);

  if (unit === "months" || unit === "month") {
    return n * 30;
  }

  if (unit === "year") {
    return n * 365;
  }

  return null;
}
export const createCohort = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { name, courses, studentIds } = req.body;

    if (!name || !ownerId) {
      return res
        .status(400)
        .json({ message: "Name and ownerId are required." });
    }

    if (!Array.isArray(courses) || courses.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one course is required." });
    }

    const validatedCourses = [];

    for (const course of courses) {
      const { courseId, coachId } = course;

      if (!courseId || !coachId) {
        return res.status(400).json({
          message: "Each course must include courseId and coachId",
        });
      }

      // Confirm the course exists
      const courseDoc = await Course.findById(courseId);
      if (!courseDoc) {
        return res
          .status(404)
          .json({ message: `Course not found: ${courseId}` });
      }

      // Convert "3-months" → 90 days
      const durationInDays = convertDurationStringToDays(courseDoc.duration);

      validatedCourses.push({
        courseId,
        coachId,
        durationInDays,
        status: "not_started",
        startDate: null,
        endDate: null,
        classDay: null,
        classTime: null,
        classStartTime: null,
        classEndTime: null,
      });
    }

    const newCohort = new Cohort({
      name,
      ownerId,
      courses: validatedCourses,
      studentIds: studentIds || [],
    });

    await newCohort.save();

    return res.status(201).json({
      message: "Cohort created successfully",
      cohort: newCohort.toObject(),
    });
  } catch (error) {
    console.error("Create cohort error:", error);
    return res.status(500).json({
      message: "Server error while creating cohort",
      error: error.message,
    });
  }
};

//REGISTER STUDENT TO COHORT

export const registerStudentToCohort = async (req, res) => {
  const { cohortId } = req.params;
  const studentId = req.user?.id;
  const courseId = req.body?.courseId;

  if (!studentId) {
    return res
      .status(401)
      .json({ message: "You must be logged in to register" });
  }

  if (!courseId) {
    return res.status(400).json({ message: "Course ID is required" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "Proof of payment is required" });
  }

  try {
    // 1️⃣ Upload proof to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: "payment_proofs",
      resource_type: "auto",
    });

    // 2️⃣ Validate student
    const student = await userModule.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    // 3️⃣ Validate cohort
    const cohort = await Cohort.findById(cohortId);
    if (!cohort) return res.status(404).json({ message: "Cohort not found" });

    // 4️⃣ Validate course belongs to cohort
    const selectedCourse = cohort.courses.find(
      (c) =>
        c.courseId &&
        (c.courseId.toString() === courseId ||
          c.courseId?._id?.toString() === courseId)
    );

    if (!selectedCourse)
      return res
        .status(400)
        .json({ message: "Selected course does not belong to this cohort" });

    // 5️⃣ Normalize studentIds
    if (!Array.isArray(cohort.studentIds)) cohort.studentIds = [];

    let studentEntry = cohort.studentIds.find(
      (s) => s.studentId.toString() === studentId.toString()
    );

    if (!studentEntry) {
      studentEntry = { studentId, enrollments: [] };
      cohort.studentIds.push(studentEntry);
    }

    const alreadyRegistered = studentEntry.enrollments.some(
      (e) => e.courseId.toString() === courseId.toString()
    );

    if (alreadyRegistered)
      return res
        .status(400)
        .json({ message: "You already registered for this course" });

    // 6️⃣ Save enrollment with proof of payment
    studentEntry.enrollments.push({
      courseId,
      paid: true,
      paymentConfirmed: false,
      hasAccess: false,
      paidAt: new Date(),
      registeredAt: new Date(), // optional, track registration date
      proofOfPayment: {
        url: uploadResult.secure_url || "",
        publicId: uploadResult.public_id || "",
      },
    });

    await cohort.save();

    return res.status(200).json({
      message: "Registration submitted. Awaiting payment confirmation.",
      proofOfPayment: uploadResult.secure_url, // optional: return URL
    });
  } catch (err) {
    console.error("Registration Error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// export const registerStudentToCohort = async (req, res) => {
//   const { cohortId } = req.params;
//   const studentId = req.user?.id;

//   // ✅ SAFE access (multer-compatible)
//   const courseId = req.body?.courseId;

//   if (!studentId) {
//     return res.status(401).json({
//       message: "You must be logged in to register",
//     });
//   }

//   if (!courseId) {
//     return res.status(400).json({
//       message: "Course ID is required",
//     });
//   }

//   if (!req.file) {
//     return res.status(400).json({
//       message: "Proof of payment is required",
//     });
//   }

//   try {
//     // 1️⃣ Upload proof to Cloudinary
//     const uploadResult = await cloudinary.uploader.upload(req.file.path, {
//       folder: "payment_proofs",
//       resource_type: "auto",
//     });

//     // 2️⃣ Validate student
//     const student = await userModule.findById(studentId);
//     if (!student) {
//       return res.status(404).json({ message: "Student not found" });
//     }

//     // 3️⃣ Validate cohort
//     const cohort = await Cohort.findById(cohortId);
//     if (!cohort) {
//       return res.status(404).json({ message: "Cohort not found" });
//     }

//     // 4️⃣ Validate course belongs to cohort
//     const selectedCourse = cohort.courses.find(
//       (c) =>
//         c.courseId &&
//         (c.courseId.toString() === courseId ||
//           c.courseId?._id?.toString() === courseId)
//     );

//     if (!selectedCourse) {
//       return res.status(400).json({
//         message: "Selected course does not belong to this cohort",
//       });
//     }

//     // 5️⃣ Normalize studentIds
//     if (!Array.isArray(cohort.studentIds)) {
//       cohort.studentIds = [];
//     }

//     let studentEntry = cohort.studentIds.find(
//       (s) => s.studentId.toString() === studentId.toString()
//     );

//     if (!studentEntry) {
//       studentEntry = {
//         studentId,
//         enrollments: [],
//       };
//       cohort.studentIds.push(studentEntry);
//     }

//     const alreadyRegistered = studentEntry.enrollments.some(
//       (e) => e.courseId.toString() === courseId.toString()
//     );

//     if (alreadyRegistered) {
//       return res.status(400).json({
//         message: "You already registered for this course",
//       });
//     }

//     // 6️⃣ Save enrollment
//     studentEntry.enrollments.push({
//       courseId,
//       paid: true,
//       paymentConfirmed: false,
//       hasAccess: false,
//       paidAt: new Date(),
//       proofOfPayment: {
//         url: uploadResult.secure_url,
//         publicId: uploadResult.public_id,
//       },
//     });

//     await cohort.save();

//     return res.status(200).json({
//       message: "Registration submitted. Awaiting payment confirmation.",
//     });
//   } catch (err) {
//     console.error("Registration Error:", err);
//     return res.status(500).json({
//       message: "Server error",
//       error: err.message,
//     });
//   }
// };

//GET STUDENTS IN A COHORT
export const getCohortStudents = async (req, res) => {
  try {
    const cohort = await Cohort.findById(req.params.cohortId).populate(
      "studentIds",
      "name email"
    );
    if (!cohort) return res.status(404).json({ message: "Cohort not found" });

    res.status(200).json({ students: cohort.studentIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// controllers/cohortController.js

export const startCohortByCourse = async (req, res) => {
  const { cohortCourseId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  if (!mongoose.Types.ObjectId.isValid(cohortCourseId)) {
    return res.status(400).json({ message: "Invalid course ID" });
  }

  try {
    // Allow owner to start any course, or coach to start their own course
    let cohort;

    if (userRole === "owner") {
      cohort = await Cohort.findOne({ "courses._id": cohortCourseId });
    } else if (userRole === "coach") {
      cohort = await Cohort.findOne({
        "courses._id": cohortCourseId,
        "courses.coachId": userId,
      });
    }

    if (!cohort) {
      return res.status(404).json({ message: "Course not found in cohort" });
    }

    const courseItem = cohort.courses.id(cohortCourseId);

    if (courseItem.status === "in_progress") {
      return res.status(400).json({ message: "Course already started" });
    }

    if (courseItem.status === "completed") {
      return res.status(400).json({ message: "Course already completed" });
    }

    // Start the course
    courseItem.status = "in_progress";
    courseItem.startDate = new Date();

    await cohort.save();

    const updated = await Cohort.findById(cohort._id).populate(
      "courses.courseId"
    );

    return res.json({
      message: "Course started successfully",
      course: {
        _id: courseItem._id,
        courseId: courseItem.courseId,
        coachId: courseItem.coachId,
        durationInDays: courseItem.durationInDays,
        status: courseItem.status,
        startDate: courseItem.startDate,
        endDate: courseItem.endDate,
      },
    });
  } catch (error) {
    console.error("Start cohort error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
// Undo start of a cohort course
export const undoStartCohortCourse = async (req, res) => {
  const { cohortCourseId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(cohortCourseId)) {
    return res.status(400).json({ message: "Invalid course ID" });
  }

  try {
    const cohort = await Cohort.findOne({ "courses._id": cohortCourseId });

    if (!cohort) {
      return res.status(404).json({ message: "Course not found in cohort" });
    }

    const courseItem = cohort.courses.id(cohortCourseId);

    if (!courseItem) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (courseItem.status !== "in_progress") {
      return res.status(400).json({
        message: "Only started courses can be undone",
      });
    }

    // ✅ Undo start
    courseItem.status = "pending";
    courseItem.startDate = null;

    await cohort.save();

    res.json({
      message: "Course start undone successfully",
      course: courseItem,
    });
  } catch (error) {
    console.error("Undo start cohort error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Undo end of a cohort course
export const undoEndCohortCourse = async (req, res) => {
  const { cohortCourseId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(cohortCourseId)) {
    return res.status(400).json({ message: "Invalid course ID" });
  }

  try {
    const cohort = await Cohort.findOne({ "courses._id": cohortCourseId });

    if (!cohort) {
      return res.status(404).json({ message: "Course not found in cohort" });
    }

    const courseItem = cohort.courses.id(cohortCourseId);

    if (!courseItem) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (courseItem.status !== "completed") {
      return res.status(400).json({
        message: "Only completed courses can be undone",
      });
    }

    // ✅ Undo end
    courseItem.status = "in_progress";
    courseItem.endDate = null;

    await cohort.save();

    res.json({
      message: "Course completion undone successfully",
      course: courseItem,
    });
  } catch (error) {
    console.error("Undo end cohort error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const endCohortByCourse = async (req, res) => {
  const { cohortCourseId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  if (!mongoose.Types.ObjectId.isValid(cohortCourseId)) {
    return res.status(400).json({ message: "Invalid course ID" });
  }

  try {
    // Find cohort: owner can end any course, coach can only end their own
    let cohort;
    if (userRole === "owner") {
      cohort = await Cohort.findOne({ "courses._id": cohortCourseId });
    } else if (userRole === "coach") {
      cohort = await Cohort.findOne({
        "courses._id": cohortCourseId,
        "courses.coachId": userId,
      });
    }

    if (!cohort) {
      return res
        .status(404)
        .json({ message: "Course not found or you don't have permission" });
    }

    const courseItem = cohort.courses.id(cohortCourseId);

    if (!courseItem) {
      return res.status(404).json({ message: "Course not found in cohort" });
    }

    if (courseItem.status !== "in_progress") {
      return res.status(400).json({ message: "Course is not in progress" });
    }

    // End the course
    courseItem.status = "completed";
    courseItem.endDate = new Date();

    await cohort.save();

    res.json({
      message: "Course completed successfully",
      course: {
        _id: courseItem._id,
        courseId: courseItem.courseId,
        coachId: courseItem.coachId,
        durationInDays: courseItem.durationInDays,
        status: courseItem.status,
        startDate: courseItem.startDate,
        endDate: courseItem.endDate,
      },
    });
  } catch (err) {
    console.error("End cohort error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllCohorts = async (req, res) => {
  try {
    const cohorts = await Cohort.find()
      .populate("courses.courseId", "name duration")
      .populate("courses.coachId", "fullName email")
      .populate("ownerId", "fullName email");

    res.json(cohorts);
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

export const deleteCohort = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { cohortId } = req.params;
    if (!cohortId) {
      return res.status(400).json({ message: "Cohort ID is required" });
    }

    const cohort = await Cohort.findById(cohortId);
    if (!cohort) {
      return res.status(404).json({ message: "Cohort not found" });
    }

    // Only owner can delete
    if (cohort.ownerId.toString() !== ownerId.toString()) {
      return res.status(403).json({
        message: "You are not authorized to delete this cohort",
      });
    }

    await Cohort.findByIdAndDelete(cohortId);

    res.json({ message: "Cohort deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Server error while deleting cohort",
      error: error.message,
    });
  }
};

export const getActiveCohorts = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1️⃣ Find all cohorts where student is enrolled
    const cohorts = await Cohort.find({
      "studentIds.studentId": userId,
    })
      .populate("courses.courseId")
      .populate("courses.coachId");

    if (!cohorts || cohorts.length === 0) {
      return res.status(200).json({ cohorts: [] });
    }

    // 2️⃣ Map cohorts to only include in-progress courses
    const activeCohorts = cohorts.map((cohort) => {
      // Courses that are "in_progress"
      const inProgressCourses = cohort.courses
        .filter((c) => c.status === "in_progress")
        .map((c) => {
          // Check if student is enrolled in this course
          const studentEntry = cohort.studentIds.find(
            (s) => s.studentId.toString() === userId.toString()
          );

          const enrollment = studentEntry?.enrollments.find(
            (e) => e.courseId.toString() === c.courseId._id.toString()
          );

          return {
            courseId: c.courseId._id,
            name: c.courseId.name,
            category: c.courseId.category,
            duration: c.durationInDays + " days",
            coachId: c.coachId._id,
            coachName: c.coachId.fullName,
            coachEmail: c.coachId.email,
            coachPhone: c.coachId.phoneNumber,
            status: c.status,
            startDate: c.startDate,
            endDate: c.endDate,
            enrolled: enrollment ? true : false,
            paymentConfirmed: enrollment?.paymentConfirmed || false,
          };
        });

      return {
        cohortId: cohort._id,
        cohortName: cohort.name,
        startDate: cohort.startDate,
        endDate: cohort.endDate,
        courses: inProgressCourses,
      };
    });

    return res.status(200).json({ cohorts: activeCohorts });
  } catch (err) {
    console.error("getActiveCohorts Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
// Get cohorts with not started courses for students to register in cohort

export const getNotActiveCohort = async (req, res) => {
  try {
    // Fetch all cohorts with at least one not-started course
    const cohorts = await Cohort.find({
      "courses.status": "not_started",
    })
      .populate({
        path: "courses.courseId",
        select: "_id name image category description durationInDays",
      })
      .populate({
        path: "courses.coachId",
        select: "_id fullName profilePhoto avgRating",
      });

    if (!cohorts || cohorts.length === 0) {
      return res
        .status(404)
        .json({ message: "❌ No not-started cohort available" });
    }

    const formatted = cohorts.map((cohort) => {
      const notStartedCourses = cohort.courses
        .filter((c) => c.status === "not_started")
        .map((course) => {
          const courseData = course.courseId || {}; // prevent undefined
          const coachData = course.coachId || {};

          return {
            _id: courseData._id || null,
            name: courseData.name || "Untitled Course",
            image: courseData.image || "",
            category: courseData.category || "",
            description: courseData.description || "",
            durationInDays:
              course.durationInDays || courseData.durationInDays || 0,
            status: course.status,
            nextClass: course.nextClass || {},
            coach: {
              _id: coachData._id || null,
              fullName: coachData.fullName || "",
              profilePhoto: coachData.profilePhoto || "",
              avgRating: coachData.avgRating || 0,
            },
          };
        });

      return {
        cohortName: cohort.cohortName || cohort.name || "Unnamed Cohort",
        cohortId: cohort._id,
        courses: notStartedCourses,
      };
    });

    return res.status(200).json({ cohorts: formatted });
  } catch (err) {
    console.error("Error fetching not-started cohorts:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

//✅ Get all coaches assigned to students

export const getCoachesAssignedToStudents = async (req, res) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({ message: "Unauthorized: No student ID" });
    }

    // Load only cohorts containing this student
    const cohorts = await Cohort.find({
      "studentIds.studentId": studentId,
    })
      .populate({
        path: "courses.courseId",
        select: "name duration category",
      })
      .populate({
        path: "courses.coachId",
        select: "fullName email profilePhoto avgRating",
      })
      .populate({
        path: "studentIds.studentId",
        select: "fullName email profilePhoto",
      });

    let assignedCoaches = [];

    for (const cohort of cohorts) {
      const studentEntry = cohort.studentIds.find(
        (s) => s.studentId && s.studentId._id.toString() === studentId
      );

      if (!studentEntry) continue;

      for (const enroll of studentEntry.enrollments) {
        if (!enroll.paid || !enroll.paymentConfirmed) continue;

        const courseMatch = cohort.courses.find(
          (c) =>
            c.courseId &&
            c.courseId._id.toString() === enroll.courseId.toString()
        );

        if (!courseMatch) continue;
        if (courseMatch.status !== "in_progress") continue;

        assignedCoaches.push({
          courseId: courseMatch.courseId._id,
          courseName: courseMatch.courseId.name,
          courseCategory: courseMatch.courseId.category,
          coachId: courseMatch.coachId?._id,
          coachName: courseMatch.coachId?.fullName,
          coachEmail: courseMatch.coachId?.email,
          coachPhoto: courseMatch.coachId?.profilePhoto,
          courseStatus: courseMatch.status,
        });
      }
    }

    return res.status(200).json({
      message: "Assigned coaches fetched successfully",
      studentId,
      coaches: assignedCoaches,
    });
  } catch (error) {
    console.error("❌ Error fetching coaches for student:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

//  get available cohorts with not started courses for students to register

export const getAvailableCohorts = async (req, res) => {
  try {
    // 1️⃣ Fetch all cohorts that have at least ONE course not started
    const cohorts = await Cohort.find({
      "courses.status": "not_started",
    })
      .populate("courses.courseId")
      .populate("courses.coachId")
      .select("name startDate endDate courses");

    if (!cohorts || cohorts.length === 0) {
      return res.status(200).json({ cohorts: [] });
    }

    // 2️⃣ Format clean response (NULL-SAFE)
    const availableCohorts = cohorts.map((cohort) => {
      const notStartedCourses = cohort.courses
        .filter((c) => c.status === "not_started")
        .map((c) => {
          const courseData = c.courseId || {};
          const coachData = c.coachId || {};

          return {
            courseId: courseData._id || null,
            name: courseData.name || "",
            category: courseData.category || "",
            duration: (c.durationInDays || 0) + " days",
            coachId: coachData._id || null,
            coachName: coachData.fullName || "",
            coachEmail: coachData.email || "",
            coachPhone: coachData.phoneNumber || "",
            status: c.status,
            startDate: c.startDate,
            endDate: c.endDate,
          };
        });

      return {
        cohortId: cohort._id,
        cohortName: cohort.name,
        startDate: cohort.startDate,
        endDate: cohort.endDate,
        courses: notStartedCourses,
      };
    });

    return res.status(200).json({ cohorts: availableCohorts });
  } catch (err) {
    console.error("getAvailableCohorts Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getCohortCourses = async (req, res) => {
  try {
    const cohort = await Cohort.findById(req.params.id)
      .populate("courses.courseId")
      .populate("courses.coachId");

    if (!cohort) {
      return res.status(404).json({ message: "Cohort not found" });
    }

    return res.json({ courses: cohort.courses });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
// get cohorts assigned to a coach
export const getCoachAssignedCohorts = async (req, res) => {
  try {
    const coachId = req.user.id;

    // Fetch cohorts where this coach is assigned
    const cohorts = await Cohort.find({
      "courses.coachId": coachId,
    })
      .populate("courses.courseId")
      .populate("courses.coachId");

    if (!cohorts || cohorts.length === 0) {
      return res.status(201).json({ cohorts: [], coursesByCohort: {} });
    }

    // Map cohorts to include only coach's courses
    // const assigned = cohorts.map((cohort) => {
    //   const coachCourses = cohort.courses
    //     .filter((c) => c.coachId._id.toString() === coachId)
    //     .map((c) => ({
    //       cohortCourseId: c._id,
    //       courseId: c.courseId._id,
    //       name: c.courseId.name,
    //       category: c.courseId.category,
    //       duration: c.durationInDays
    //         ? c.durationInDays + " days"
    //         : c.courseId.duration,
    //       status: c.status,
    //       startDate: c.startDate,
    //       endDate: c.endDate,
    //     }));

    const assigned = cohorts.map((cohort) => {
      const coachCourses = cohort.courses
        .filter(
          (c) =>
            (c.coachId &&
              c.coachId._id &&
              c.coachId._id.toString() === coachId) ||
            (c.coachId && c.coachId.toString() === coachId)
        )
        .map((c) => ({
          cohortCourseId: c._id,
          courseId: c.courseId._id,
          name: c.courseId.name,
          category: c.courseId.category,
          duration: c.durationInDays
            ? c.durationInDays + " days"
            : c.courseId.duration,
          status: c.status,
          startDate: c.startDate,
          endDate: c.endDate,
        }));

      return {
        cohortId: cohort._id,
        cohortName: cohort.name,
        courses: coachCourses,
      };
    });
    // return {
    //   cohortId: cohort._id,
    //   cohortName: cohort.name,
    //   courses: coachCourses,
    // };
    // });

    // Create a grouped object for frontend convenience
    const coursesByCohort = {};
    assigned.forEach((cohort) => {
      coursesByCohort[cohort.cohortName] = cohort.courses;
    });

    return res.status(200).json({ cohorts: assigned, coursesByCohort });
  } catch (err) {
    console.error("getCoachAssignedCohorts Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
// get students under a coach
export const getStudentsUnderCoach = async (req, res) => {
  try {
    const coachId = req.user.id;

    /**
     * 1️⃣ Fetch all cohorts where this coach teaches
     *    We only need minimal fields for performance
     */
    const cohorts = await Cohort.find({
      "courses.coachId": coachId,
    })
      .select("name courses studentIds")
      .populate("studentIds.studentId", "fullName email phoneNumber");

    /**
     * 2️⃣ Collect all courseIds taught by this coach
     */
    const coachCourseIds = new Set();

    cohorts.forEach((cohort) => {
      cohort.courses.forEach((course) => {
        if (course.coachId.toString() === coachId) {
          coachCourseIds.add(course.courseId.toString());
        }
      });
    });

    if (coachCourseIds.size === 0) {
      return res.status(200).json({ count: 0, students: [] });
    }

    /**
     * 3️⃣ Build students map (deduplicated)
     */
    const studentsMap = new Map();

    cohorts.forEach((cohort) => {
      cohort.studentIds.forEach((studentEntry) => {
        // ❗ Student user may have been deleted
        if (!studentEntry.studentId) return;

        /**
         * 4️⃣ Filter enrollments to ONLY coach’s courses
         */
        const relevantEnrollments = studentEntry.enrollments.filter(
          (enrollment) =>
            enrollment.courseId &&
            coachCourseIds.has(enrollment.courseId.toString())
        );

        if (relevantEnrollments.length === 0) return;

        const studentId = studentEntry.studentId._id.toString();

        /**
         * 5️⃣ Initialize student record if not exists
         */
        if (!studentsMap.has(studentId)) {
          studentsMap.set(studentId, {
            studentId: studentEntry.studentId._id,
            fullName: studentEntry.studentId.fullName,
            email: studentEntry.studentId.email,
            phoneNumber: studentEntry.studentId.phoneNumber || null,
            cohorts: new Set([cohort.name]),
            enrollments: [],
          });
        }

        const student = studentsMap.get(studentId);

        /**
         * 6️⃣ Append enrollments (avoid duplicates)
         */
        relevantEnrollments.forEach((enr) => {
          const exists = student.enrollments.some(
            (e) => e.courseId.toString() === enr.courseId.toString()
          );

          if (!exists) {
            student.enrollments.push({
              courseId: enr.courseId,
              paid: enr.paid,
              paymentConfirmed: enr.paymentConfirmed,
              hasAccess: enr.hasAccess,
              paidAt: enr.paidAt,
              registeredAt: enr.registeredAt,
            });
          }
        });

        student.cohorts.add(cohort.name);
      });
    });

    /**
     * 7️⃣ Normalize Sets → Arrays for JSON
     */
    const students = Array.from(studentsMap.values()).map((s) => ({
      ...s,
      cohorts: Array.from(s.cohorts),
    }));

    return res.status(200).json({
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("❌ Get students under coach error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// export const getStudentsUnderCoach = async (req, res) => {
//   try {
//     const coachId = req.user.id;

//     // Find all cohorts where this coach teaches at least one course
//     const cohorts = await Cohort.find({
//       "courses.coachId": coachId,
//     }).populate("studentIds.studentId", "fullName email");

//     const studentsMap = new Map();

//     cohorts.forEach((cohort) => {
//       cohort.studentIds.forEach((s) => {
//         // Filter only enrollments where the course is taught by this coach
//         const filteredEnrollments = s.enrollments.filter((enr) =>
//           cohort.courses.some(
//             (c) =>
//               c.coachId.toString() === coachId &&
//               c.courseId.equals(enr.courseId)
//           )
//         );

//         // ❗ If the student did NOT enroll in any course taught by this coach → skip
//         if (filteredEnrollments.length === 0) return;

//         const studentId = s.studentId._id.toString();

//         if (!studentsMap.has(studentId)) {
//           // Add the student with filtered enrollments
//           studentsMap.set(studentId, {
//             studentId: s.studentId._id,
//             fullName: s.studentId.fullName,
//             email: s.studentId.email,
//             cohorts: [cohort.name],
//             enrollments: filteredEnrollments.map((enr) => ({
//               courseId: enr.courseId,
//               paid: enr.paid,
//               paymentConfirmed: enr.paymentConfirmed,
//               hasAccess: enr.hasAccess,
//               paidAt: enr.paidAt,
//               registeredAt: enr.registeredAt,
//             })),
//           });
//         } else {
//           // Student already exists → just add cohort name (avoid duplicates)
//           const existing = studentsMap.get(studentId);
//           if (!existing.cohorts.includes(cohort.name)) {
//             existing.cohorts.push(cohort.name);
//           }
//         }
//       });
//     });

//     const students = Array.from(studentsMap.values());

//     return res.status(200).json({ count: students.length, students });
//   } catch (err) {
//     console.error("Get students under coach error:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// get upcoming class for student

export const getUpcomingClass = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Convert studentId to ObjectId safely
    let studentObjectId;
    try {
      studentObjectId = new mongoose.Types.ObjectId(studentId);
    } catch {
      studentObjectId = null;
    }

    // Fetch cohorts where the student is enrolled
    const cohorts = await Cohort.find({
      $or: [
        { "studentIds.studentId": studentId },
        ...(studentObjectId
          ? [{ "studentIds.studentId": studentObjectId }]
          : []),
      ],
    });

    if (!cohorts || cohorts.length === 0) {
      return res.status(404).json({ message: "Cohort not assigned" });
    }

    let nextClassData = null;

    for (const cohort of cohorts) {
      // Find the student object in this cohort
      const studentData = cohort.studentIds.find(
        (s) =>
          s.studentId.toString() === studentId.toString() ||
          s.studentId === studentId
      );

      if (!studentData || !Array.isArray(studentData.enrollments)) continue;

      // Loop through enrollments to find courses with confirmed payment
      for (const enrollment of studentData.enrollments) {
        if (!enrollment.paymentConfirmed) continue;

        // Find the course in the cohort that matches the enrollment
        const courseInCohort = cohort.courses.find(
          (c) => c.courseId.toString() === enrollment.courseId.toString()
        );

        if (!courseInCohort || !courseInCohort.nextClass?.date) continue;

        const { date, time } = courseInCohort.nextClass;
        const classDateTime = new Date(`${date} ${time}`);
        const now = new Date();

        const hasAccess =
          enrollment.paymentConfirmed === true && now >= classDateTime;

        // Fetch videos/documents for this course & cohort
        const videos = await coachUpload.find({
          cohortId: cohort._id,
          courseId: courseInCohort.courseId,
          type: "video",
        });

        const documents = await coachUpload.find({
          cohortId: cohort._id,
          courseId: courseInCohort.courseId,
          type: "document",
        });

        // Keep the earliest upcoming class
        if (
          !nextClassData ||
          classDateTime < new Date(nextClassData.classDateTime)
        ) {
          nextClassData = {
            cohortId: cohort._id,
            courseId: courseInCohort.courseId,
            classDateTime,
            hasAccess,
            videos,
            documents,
          };
        }
      }
    }

    if (!nextClassData) {
      return res.json({
        hasClass: false,
        message: "No upcoming classes fixed by your coach.",
      });
    }

    return res.json({
      hasClass: true,
      ...nextClassData,
    });
  } catch (err) {
    console.error("Upcoming Class Error:", err);
    return res
      .status(500)
      .json({ message: "Server Error", error: err.message });
  }
};
export const setClassSchedule = async (req, res) => {
  const { courseId } = req.params;
  const { classDay, classTime } = req.body;
  const coachId = req.user.id;

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: "Course not found" });

  if (!course.coach || !course.coach.equals(coachId)) {
    return res.status(403).json({ message: "Not your course" });
  }

  // Create class start & end time
  const [hour, minute] = classTime.split(":");
  const now = new Date();
  const classStart = new Date(now);
  classStart.setHours(hour, minute, 0, 0);
  const classEnd = new Date(classStart.getTime() + 3 * 60 * 60 * 1000);

  // Update the course itself
  course.classDay = classDay;
  course.classTime = classTime;
  course.classStartTime = classStart;
  course.classEndTime = classEnd;
  course.isClassOpen = false;

  await course.save();

  // ✅ Update all cohorts that include this course
  await Cohort.updateMany(
    { "courses.courseId": courseId },
    {
      $set: {
        "courses.$.status": "in_progress",
        "courses.$.classDay": classDay,
        "courses.$.classTime": classTime,
        "courses.$.classStartTime": classStart,
        "courses.$.classEndTime": classEnd,
        "courses.$.startDate": classStart,
      },
    }
  );

  res.json({
    message: `Class scheduled for ${classDay} at ${classTime}`,
    course,
  });
};
