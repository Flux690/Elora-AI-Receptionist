import express from "express";
import adminRouter from "../routes/admin.js";
import healthRouter from "./health.js";

const router = express.Router();

router.use("/admin", adminRouter);
router.use("/health", healthRouter);

export default router;
