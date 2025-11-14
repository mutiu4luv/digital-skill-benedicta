// utils/classScheduler.js
import cron from "node-cron";
import Course from "../module/course.js";
import fetch from "node-fetch";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_SENDER = process.env.EMAIL_SENDER;

// 🔥 Send Brevo Email Function
const sendBrevoEmail = async (to, subject, message) => {
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { email: EMAIL_SENDER, name: "HGSC² Digital Skills" },
        to: [{ email: to }],
        subject,
        htmlContent: `<p>${message}</p>`,
      }),
    });

    const data = await response.json();
    console.log("📨 Reminder email sent:", data);
  } catch (err) {
    console.error("❌ Error sending reminder email:", err);
  }
};

// 🔔 CRON Runs Every Minute
cron.schedule("* * * * *", async () => {
  const now = new Date();
  const today = now.toLocaleString("en-US", { weekday: "long" });

  const courses = await Course.find({ classDay: today }).populate(
    "students",
    "fullName email"
  );

  for (const course of courses) {
    if (!course.classTime) continue;

    const [hour, minute] = course.classTime.split(":");

    const classStart = new Date();
    classStart.setHours(hour, minute, 0, 0);

    const classEnd = new Date(classStart.getTime() + 3 * 60 * 60 * 1000);

    // ⏰ Reminder (30 mins before class)
    const reminderTime = new Date(classStart.getTime() - 30 * 60 * 1000);
    if (now >= reminderTime && now <= classStart && !course.reminderSent) {
      for (const student of course.students) {
        await sendBrevoEmail(
          student.email,
          `Class Reminder: ${course.name}`,
          `Hello ${student.fullName},<br><br>Your class <strong>${course.name}</strong> starts in <b>30 minutes</b>.<br><br>Be prepared.`
        );
      }

      course.reminderSent = true;
      await course.save();

      console.log(`📬 Reminder sent for class: ${course.name}`);
    }

    // 🔓 Open class
    if (now >= classStart && now <= classEnd && !course.isClassOpen) {
      course.isClassOpen = true;
      course.classStartTime = classStart;
      course.classEndTime = classEnd;
      course.reminderSent = false; // reset for next day
      await course.save();
      console.log(`🟢 Class "${course.name}" is now OPEN`);
    }

    // 🔐 Close class
    if (now > classEnd && course.isClassOpen) {
      course.isClassOpen = false;
      await course.save();
      console.log(`🔴 Class "${course.name}" is now CLOSED`);
    }
  }
});
