import cron from "node-cron";
import Registration from "../module/registerCourse.js";

cron.schedule("* * * * *", async () => {
  const now = new Date();

  await Registration.updateMany(
    { expiresAt: { $lte: now }, accessActive: true },
    { $set: { accessActive: false } }
  );

  console.log("Checked for classes to auto-close");
});
