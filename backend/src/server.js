import mongoose from "mongoose";
import pino from "pino";
import { parseEnv } from "./config/env.js";
import { createApp } from "./app.js";
const log = pino();
try {
  const env = parseEnv(process.env);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const server = createApp(env).listen(env.PORT, () =>
    log.info({ port: env.PORT }, "API listening"),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () =>
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      }),
    );
} catch (err) {
  log.fatal({ err }, "API failed to start");
  process.exit(1);
}
