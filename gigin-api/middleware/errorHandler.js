/* eslint-disable */
/**
 * Centralized error handling middleware.
 * Catches all errors and returns appropriate HTTP responses.
 * Must be used with 4 parameters (err, req, res, next) for Express to recognize it as an error handler.
 */
export function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }
  // Log error details for debugging
  console.error("Error:", {
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Handle known error types
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation Error",
      message: err.message,
    });
  }

  if (err.name === "UnauthorizedError" || err.message === "UNAUTHENTICATED") {
    return res.status(401).json({
      error: "UNAUTHENTICATED",
      message: err.message || "Authentication required",
    });
  }

  // Default to 500 Internal Server Error
  // Don't leak sensitive error details in production
  const isDevelopment = process.env.NODE_ENV === "development";
  
  res.status(err.statusCode || 500).json({
    error: err.message || "Internal Server Error",
    ...(isDevelopment && { stack: err.stack }),
  });
}

/**
 * Async error wrapper for route handlers.
 * Wraps async route handlers to catch errors and pass them to errorHandler.
 * 
 * Usage:
 *   router.post("/endpoint", asyncHandler(async (req, res) => {
 *     // Your async code
 *   }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
