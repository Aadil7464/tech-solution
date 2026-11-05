import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import mongoose from "mongoose";
import { apiRouter } from "./routes/api.js";
import { originGuard } from "./middleware/security.js";
import { trustedFrontendOrigins } from "./config/env.js";
export function createApp(env, dependencies = {}) {
  const resolvedEnv = {
    ...env,
    trustedFrontendOrigins: trustedFrontendOrigins(env),
  };
  const app = express();
  app.disable("x-powered-by");
  app.use(
    pinoHttp({
      level: resolvedEnv.NODE_ENV === "test" ? "silent" : "info",
      redact: [
        "req.headers.cookie",
        "req.headers.authorization",
        'res.headers["set-cookie"]',
      ],
    }),
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || resolvedEnv.trustedFrontendOrigins.includes(origin))
          return callback(null, true);
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "150kb" }));
  app.use(cookieParser());
  app.use(originGuard(resolvedEnv));
  app.use("/api", (_, res, next) => {
    res.set("X-Robots-Tag", "noindex, nofollow");
    next();
  });
  app.get("/health", (_, res) =>
    res
      .status(mongoose.connection.readyState === 1 ? 200 : 503)
      .json({
        data: {
          database:
            mongoose.connection.readyState === 1 ? "connected" : "unavailable",
        },
      }),
  );
  app.use(
    "/uploads",
    express.static(path.resolve(resolvedEnv.UPLOAD_DIR), {
      dotfiles: "deny",
      maxAge: 0,
      etag: true,
    }),
  );
  app.use(
    "/api/v1",
    apiRouter(resolvedEnv, dependencies.passwordResetTransport),
  );
  app.use((req, res) =>
    res.status(404).json({ error: { message: "Endpoint not found" } }),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    req.log.error({ err }, "Request failed");
    const status =
      err.code === 11000
        ? 409
        : err.code === "LIMIT_FILE_SIZE"
          ? 413
          : err.status || 500;
    const message =
      err.code === 11000
        ? "This slug or email is already in use"
        : err.code === "LIMIT_FILE_SIZE"
          ? "Image must be under 5 MB"
          : status >= 500
            ? "Something went wrong. Please try again."
            : err.message;
    res.status(status).json({ error: { message } });
  });
  return app;
}
