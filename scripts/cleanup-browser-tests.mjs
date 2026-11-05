import mongoose from "mongoose";
import { User, Lead, Blog, Activity } from "../backend/src/models/index.js";
await mongoose.connect(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_solution_agency",
);
try {
  const users = await User.find({
    name: "Browser Test",
    email: /^browser-[a-f0-9]{12}@example\.com$/,
  });
  for (const user of users) {
    await Lead.deleteMany({ name: "Browser Test", email: user.email });
    await Activity.deleteMany({ actor: user._id });
    await user.deleteOne();
  }
  await Blog.deleteMany({
    title: "Browser verification article",
    slug: /^browser-check-[a-f0-9]{12}$/,
  });
  console.log("Removed leftover automated browser-test records.");
} finally {
  await mongoose.disconnect();
}
