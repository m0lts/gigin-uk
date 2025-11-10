/* eslint-disable */
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { initializeAdmin } from "./config/admin.js";
import { PROJECT_ID, IS_PROD, IS_DEV, NODE_ENV } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./middleware/logger.js";
import userRoutes from "./routes/users.js";
import messageRoutes from "./routes/messages.js";
import venueRoutes from "./routes/venues.js";
import conversationRoutes from "./routes/conversations.js";
import gigsRoutes from "./routes/gigs.js";
import musiciansRoutes from "./routes/musicians.js";
import reviewsRoutes from "./routes/reviews.js";
import tasksRoutes from "./routes/tasks.js";
import billingRoutes from "./routes/billing.js";
import bandsRoutes from "./routes/bands.js";
// Initialize Firebase Admin (must be done before importing routes that use it)
initializeAdmin();

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy - required for Cloud Run (behind Google's load balancer)
// Cloud Run is behind 1 proxy (Google's load balancer), so we trust 1 hop
// This allows Express to correctly handle X-Forwarded-For headers for rate limiting
// Using a number instead of true prevents IP spoofing attacks
app.set('trust proxy', 1);

// Security: Helmet sets various HTTP headers to help protect the app
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, Cloud Scheduler)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Always allow Firebase Hosting domains (dev and prod)
    const firebaseHostingPatterns = [
      /^https:\/\/.*\.web\.app$/,
      /^https:\/\/.*\.firebaseapp\.com$/,
    ];
    
    // Check if origin matches Firebase Hosting patterns
    const matchesFirebaseHosting = firebaseHostingPatterns.some(pattern => {
      const matches = pattern.test(origin);
      if (IS_PROD && matches) {
        console.log(`CORS: Allowing Firebase Hosting origin: ${origin}`);
      }
      return matches;
    });
    
    if (matchesFirebaseHosting) {
      callback(null, true);
      return;
    }

    // In development, allow localhost and all origins
    if (NODE_ENV === "development" || IS_DEV) {
      // Allow all localhost ports for development
      if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
        callback(null, true);
        return;
      }
      // Also allow all origins in development for flexibility
      callback(null, true);
      return;
    }
    
    // Production: restrict to Firebase Hosting domains
    const allowedOrigins = [
      /^https:\/\/.*\.web\.app$/,
      /^https:\/\/.*\.firebaseapp\.com$/,
      process.env.ALLOWED_ORIGIN, // Custom domain
    ].filter(Boolean);
    
    const isAllowed = allowedOrigins.some(pattern => {
      if (typeof pattern === "string") return origin === pattern;
      return pattern.test(origin);
    });
    
    if (isAllowed) {
      console.log(`CORS: Allowing origin: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked origin: ${origin} (IS_PROD: ${IS_PROD}, NODE_ENV: ${NODE_ENV})`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: [],
  maxAge: 86400, // 24 hours for preflight cache
}));

// Rate limiting - protect against DDoS and brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again later.",
  // Trust 1 proxy (Google's load balancer) for accurate IP
  // This matches the Express trust proxy setting
  trustProxy: 1,
});

// Apply rate limiting to all requests except health check and OPTIONS (preflight)
app.use((req, res, next) => {
  // Skip rate limiting for health check endpoint
  if (req.path === "/health") {
    return next();
  }
  // Skip rate limiting for OPTIONS (preflight requests)
  if (req.method === "OPTIONS") {
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
app.use("/api/messages", messageRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/gigs", gigsRoutes);
app.use("/api/musicians", musiciansRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/bands", bandsRoutes);

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
