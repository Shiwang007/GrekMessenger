import "dotenv/config";
import http from "http";
import app from "./app.js";
import { initSocket } from "./socket/index.js";
import { checkDatabaseConnection, pool } from "./config/database.js";
import { logger } from "./utils/logger.js";

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);
const io = initSocket(httpServer);
app.set("io", io);

httpServer.listen(PORT, async () => {
  logger.info(`Server running on http://localhost:${PORT}`);

  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== "your_supabase_postgres_connection_string") {
    try {
      const result = await checkDatabaseConnection();
      logger.info(`Database connected at ${result.now}`);
    } catch (error) {
      logger.error("Database connection failed:", error);
    }
  } else {
    logger.warn("Database: DATABASE_URL not configured");
  }
});

function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  io.close(() => {
    logger.info("Socket.IO server closed");
  });

  httpServer.close(async () => {
    logger.info("HTTP server closed");
    try {
      await pool.end();
      logger.info("Database pool drained and closed");
      process.exit(0);
    } catch (err) {
      logger.error("Error closing database pool:", err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("Graceful shutdown timed out, force exiting");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
