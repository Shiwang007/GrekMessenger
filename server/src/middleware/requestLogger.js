import { performance } from "perf_hooks";
import { logger } from "../utils/logger.js";

/**
 * Express middleware to record and log HTTP requests with status codes and response duration.
 */
export function requestLogger(req, res, next) {
  const start = performance.now();

  res.on("finish", () => {
    const duration = (performance.now() - start).toFixed(1);
    const path = req.originalUrl || req.url;
    const details = res.locals.logDetails || "";

    logger.http(req.method, path, res.statusCode, duration, details);
  });

  next();
}

export default requestLogger;
