/* eslint-disable */
import express from "express";
import { db } from "../config/admin.js";
import { queueMail } from "../lib/queueMail.js";
import {
  accessRequestLimiter,
  handleAccessRequest,
  notifyAddress,
} from "../lib/accessRequest.js";

const router = express.Router();

router.post("/", accessRequestLimiter(), handleAccessRequest({
  save: (record) => db.collection("accessRequests").add(record),
  send: queueMail,
  notifyTo: () => notifyAddress(),
  now: () => new Date().toISOString(),
}));

export default router;
