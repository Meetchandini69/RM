import app from "./app";
import { logger } from "./lib/logger";
import { initializeRegistrationStorage, pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (
  process.env.NODE_ENV === "production" &&
  (process.env.API_PROXY_SECRET?.length || 0) < 32
) {
  throw new Error(
    "Set API_PROXY_SECRET to a shared secret of at least 32 characters on Railway and Cloudflare Pages.",
  );
}

await initializeRegistrationStorage().catch(() => {
  logger.error(
    "Database initialization failed. Check DATABASE_URL and database permissions.",
  );
  process.exit(1);
});

const server = app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

process.on("SIGTERM", () => {
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
});
