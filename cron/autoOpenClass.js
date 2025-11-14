import cron from "node-cron";
import Registration from "../module/registerCourse.js";

cron.schedule("* * * * *", async () => {
  const now = new Date();

  await Registration.updateMany(
    { classStartTime: { $lte: now }, accessActive: false },
    { $set: { accessActive: true } }
  );

  console.log("Checked for classes to auto-open");
});
