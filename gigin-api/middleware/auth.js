/* eslint-disable */
import { admin } from "../config/admin.js";

/**
 * Middleware to verify Firebase ID tokens from Authorization header.
 * 
 * Usage:
 * - Public endpoint: Don't use this middleware
 * - Optional auth: Use `optionalAuth` - sets req.auth if token valid, but doesn't require it
 * - Required auth: Use `requireAuth` - returns 401 if no valid token
 * 
 * Token format: Authorization: Bearer <firebase-id-token>
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // No token provided, continue without auth
    req.auth = null;
    return next();
  }

  const idToken = authHeader.split("Bearer ")[1];

  admin
    .auth()
    .verifyIdToken(idToken)
    .then((decodedToken) => {
      // Attach decoded token to request (matching Cloud Functions pattern)
      req.auth = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        ...decodedToken,
      };
      next();
    })
    .catch((error) => {
      // Invalid token, but since this is optional auth, continue without auth
      console.warn("Invalid token in optional auth:", error.message);
      req.auth = null;
      next();
    });
}

/**
 * Middleware that requires valid Firebase ID token.
 * Returns 401 Unauthorized if token is missing or invalid.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "UNAUTHENTICATED",
      message: "Missing or invalid Authorization header. Expected: Bearer <token>",
    });
  }

  const idToken = authHeader.split("Bearer ")[1];

  admin
    .auth()
    .verifyIdToken(idToken)
    .then((decodedToken) => {
      // Attach decoded token to request (matching Cloud Functions pattern)
      req.auth = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        ...decodedToken,
      };
      next();
    })
    .catch((error) => {
      console.warn("Invalid token:", error.message);
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: "Invalid or expired token",
      });
    });
}
