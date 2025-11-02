/* eslint-disable */
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { initializeAdmin } from "./config/admin.js";
import { PROJECT_ID, IS_PROD, IS_DEV, NODE_ENV } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./middleware/logger.js";
import userRoutes from "./routes/users.js";

// Initialize Firebase Admin (must be done before importing routes that use it)
initializeAdmin();

const app = express();
const PORT = process.env.PORT || 8080;

// Security: Helmet sets various HTTP headers to help protect the app
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, Cloud Scheduler)
    // In production, restrict this to your Firebase Hosting domains
    if (!origin || process.env.NODE_ENV === "development") {
      callback(null, true);
      return;
    }
    
    // Add your Firebase Hosting domains here
    const allowedOrigins = [
      /^https:\/\/.*\.web\.app$/,
      /^https:\/\/.*\.firebaseapp\.com$/,
      process.env.ALLOWED_ORIGIN, // Custom domain
    ].filter(Boolean);
    
    if (allowedOrigins.some(pattern => {
      if (typeof pattern === "string") return origin === pattern;
      return pattern.test(origin);
    })) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Rate limiting - protect against DDoS and brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again later.",
  // Trust proxy for accurate IP (Cloud Run is behind a proxy)
  trustProxy: true,
});

// Apply rate limiting to all requests except health check
app.use((req, res, next) => {
  // Skip rate limiting for health check endpoint
  if (req.path === "/health") {
    return next();
  }
  // Apply rate limiter
  return limiter(req, res, next);
});

// Body parsing middleware
app.use(express.json({ limit: "10mb" })); // Limit payload size
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware
app.use(logger);

// Health check endpoint (for Cloud Run readiness checks)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use("/api/users", userRoutes);

// 404 handler (must come after all routes)
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handling middleware (must be last, with 4 parameters for Express error handlers)
app.use((err, req, res, next) => {
  errorHandler(err, req, res, next);
});

// Start server
const server = app.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log("Gigin API Server Started");
  console.log("=".repeat(60));
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Project ID: ${PROJECT_ID || "auto-detected"}`);
  console.log(`Mode: ${IS_PROD ? "PRODUCTION" : IS_DEV ? "DEVELOPMENT" : "UNKNOWN"}`);
  console.log("=".repeat(60));
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

export default app;
