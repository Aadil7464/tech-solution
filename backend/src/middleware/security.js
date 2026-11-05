import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { User } from "../models/index.js";
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const validate = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success)
    return res
      .status(422)
      .json({
        error: {
          message: "Please check your input",
          fields: r.error.flatten().fieldErrors,
        },
      });
  req.valid = r.data;
  next();
};
export const auth = (env) => async (req, res, next) => {
  try {
    if (!req.cookies.session) throw new Error();
    const c = jwt.verify(req.cookies.session, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "tech-solution-agency",
      audience: "admin",
    });
    const user = await User.findById(c.sub);
    if (!user || user.sessionVersion !== c.version) throw new Error();
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, "Please sign in to continue"));
  }
};
export const roles =
  (...allowed) =>
  (req, res, next) =>
    allowed.includes(req.user?.role)
      ? next()
      : next(new HttpError(403, "Your role cannot perform this action"));
export const originGuard = (env) => (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (!origin || !env.trustedFrontendOrigins?.includes(origin))
    return next(new HttpError(403, "Request origin is not allowed"));
  next();
};
export const csrf = (req, res, next) => {
  const a = req.cookies.csrf,
    b = req.get("x-csrf-token");
  if (
    !a ||
    !b ||
    a.length !== b.length ||
    !crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  )
    return next(new HttpError(403, "Refresh the page and try again"));
  next();
};
export const cookieOptions = (env) => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
});
