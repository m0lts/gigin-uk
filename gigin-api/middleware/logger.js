/* eslint-disable */
/**
 * Request logging middleware.
 * Logs all incoming requests with method, path, status code, and response time.
 */
export function logger(req, res, next) {
  const start = Date.now();
  const originalSend = res.send;

  // Override res.send to capture response time
  res.send = function (body) {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
      ...(req.auth?.uid && { userId: req.auth.uid }),
    };

    // Use appropriate log level
    if (res.statusCode >= 500) {
      console.error("Request:", logData);
    } else if (res.statusCode >= 400) {
      console.warn("Request:", logData);
    } else {
      console.log("Request:", logData);
    }

    return originalSend.call(this, body);
  };

  next();
}
