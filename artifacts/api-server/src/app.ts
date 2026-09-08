import seoRouter from "./routes/seo";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import accountsRouter from "./routes/accounts";
import registrationRouter from "./routes/registration";
import viewerRouter from "./routes/viewers";
import { logger } from "./lib/logger";
import { createHash, timingSafeEqual } from "node:crypto";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use("/api", (req, res, next) => {
  const secret = process.env.API_PROXY_SECRET;
  if (req.path === "/healthz" || !secret) return next();
  const supplied = req.get("x-api-proxy-secret") || "";
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(secret), hash(supplied))) {
    res.status(403).json({ message: "Access this API through the website." });
    return;
  }
  next();
});
app.use(
  ["/api/registrations", "/api/registration/profile"],
  express.json({ limit: "12mb" }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", viewerRouter);
app.use("/api", router);
app.use("/api", registrationRouter);
app.use("/api", accountsRouter);
app.use("/api", seoRouter);
app.use("/api", (_req, res) => {
  res.status(404).json({ message: "This API endpoint is unavailable. Please update and restart the API server." });
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status = (error as { status?: number }).status;
    if (status === 413) {
      res
        .status(413)
        .json({
          message:
            "The uploaded photos are too large. Please use smaller images.",
        });
      return;
    }
    if (status === 400) {
      res.status(400).json({ message: "Invalid request." });
      return;
    }
    logger.error(
      "API request failed. Check service and database availability.",
    );
    res
      .status(500)
      .json({
        message: "The service is temporarily unavailable. Please try again.",
      });
  },
);

export default app;
