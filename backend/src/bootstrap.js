/** @format */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { parseEnv } from "./config/env.js";
import { adminBootstrapSchema } from "./config/bootstrap.js";
import { User } from "./models/index.js";

const env = parseEnv(process.env);
const args = adminBootstrapSchema.parse(process.env);
try {
  await mongoose.connect(env.MONGODB_URI);
  const user = new User({
    email: args.ADMIN_EMAIL.toLowerCase(),
    name: args.ADMIN_NAME,
    role: args.ADMIN_ROLE,
    passwordHash: await bcrypt.hash(args.ADMIN_PASSWORD, 12),
  });
  await user.save();
  console.log(
    "Account created. Remove bootstrap credentials from the environment.",
  );
} finally {
  await mongoose.disconnect();
}
