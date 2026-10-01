// ANSI color codes for terminal formatting
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

function formatTimestamp() {
  const now = new Date();
  const pad = (n, s = 2) => String(n).padStart(s, "0");
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
  return `${colors.gray}[${time}]${colors.reset}`;
}

function colorizeStatus(status) {
  if (status >= 500) return `${colors.red}${colors.bold}${status}${colors.reset}`;
  if (status >= 400) return `${colors.yellow}${colors.bold}${status}${colors.reset}`;
  if (status >= 300) return `${colors.cyan}${status}${colors.reset}`;
  return `${colors.green}${colors.bold}${status}${colors.reset}`;
}

function colorizeMethod(method) {
  const m = method.toUpperCase().padEnd(6);
  switch (m.trim()) {
    case "GET":
      return `${colors.cyan}${m}${colors.reset}`;
    case "POST":
      return `${colors.green}${m}${colors.reset}`;
    case "PUT":
    case "PATCH":
      return `${colors.yellow}${m}${colors.reset}`;
    case "DELETE":
      return `${colors.red}${m}${colors.reset}`;
    default:
      return `${colors.magenta}${m}${colors.reset}`;
  }
}

export const logger = {
  info(message, ...args) {
    console.log(
      `${formatTimestamp()} ${colors.cyan}[INFO]${colors.reset}  ${message}`,
      ...args
    );
  },

  warn(message, ...args) {
    console.warn(
      `${formatTimestamp()} ${colors.yellow}[WARN]${colors.reset}  ${message}`,
      ...args
    );
  },

  error(message, errorOrMeta) {
    const prefix = `${formatTimestamp()} ${colors.red}[ERROR]${colors.reset} ${message}`;
    if (errorOrMeta instanceof Error) {
      console.error(`${prefix} ${colors.red}${errorOrMeta.message}${colors.reset}`);
      if (errorOrMeta.stack) {
        console.error(`${colors.dim}${errorOrMeta.stack}${colors.reset}`);
      }
    } else if (errorOrMeta !== undefined) {
      console.error(prefix, errorOrMeta);
    } else {
      console.error(prefix);
    }
  },

  http(method, path, status, durationMs, details = "") {
    const statusStr = colorizeStatus(status);
    const methodStr = colorizeMethod(method);
    const durationStr = `${colors.gray}${durationMs}ms${colors.reset}`;
    const detailStr = details ? ` - ${colors.dim}${details}${colors.reset}` : "";

    console.log(
      `${formatTimestamp()} ${colors.magenta}[HTTP]${colors.reset}  ${methodStr} ${path} ${statusStr} ${durationStr}${detailStr}`
    );
  },

  debug(message, ...args) {
    if (process.env.NODE_ENV !== "production" || process.env.DEBUG) {
      console.log(
        `${formatTimestamp()} ${colors.gray}[DEBUG] ${message}${colors.reset}`,
        ...args
      );
    }
  },
};

export default logger;
