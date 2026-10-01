import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { requestLogger } from "./middleware/requestLogger.js";
import { logger } from "./utils/logger.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import messageRoutes from "./routes/message.routes.js";

const app = express();

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((s) => s.trim())
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*") || process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/conversations", messageRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Chat API is running",
  });
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  // Pass short error message to response listener for HTTP log line
  res.locals.logDetails = error.message;

  if (isClientError) {
    // Clean operational error warning without noisy stack trace
    logger.warn(
      `API [${req.method} ${req.originalUrl || req.url}] ${statusCode} - ${error.message}${error.code ? ` (${error.code})` : ""}`
    );
  } else {
    // 500 or uncaught errors: log full details and stack trace
    logger.error(`API [${req.method} ${req.originalUrl || req.url}] 500 Internal Error:`, error);
  }

  res.status(statusCode).json({
    message:
      statusCode === 500
        ? "Internal server error"
        : error.message,
    code: error.code,
  });
});

export default app;
