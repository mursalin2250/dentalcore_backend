import app from "./app.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { SHUTDOWN_TIMEOUT_MS } from "./constants/api.js";
import { MESSAGES } from "./constants/messages.js";

async function start() {
  await connectDb();
  const server = app.listen(env.PORT, () => console.log(MESSAGES.SERVER.LISTENING(env.PORT)));

  // Finish in-flight requests, close the DB, then exit.
  const shutdown = (reason, exitCode = 0) => {
    console.log(MESSAGES.SERVER.SHUTTING_DOWN(reason));
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
    server.close(async () => {
      await disconnectDb();
      process.exit(exitCode);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    console.error(reason);
    shutdown("unhandledRejection", 1);
  });
}

start().catch((error) => {
  console.error(MESSAGES.SERVER.STARTUP_FAILED, error.message);
  process.exit(1);
});
