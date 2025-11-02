/* eslint-disable */
import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = express.Router();

// Placeholder route - will be populated in Phase 1.4
router.get("/", asyncHandler(async (req, res) => {
  res.json({
    message: "Users API endpoint",
    status: "ready",
  });
}));

export default router;
