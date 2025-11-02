import express from "express";
import requestsRouter from "./requests.js";
import knowledgeRouter from "./knowledge.js";
import livekitRouter from "./livekit.js";

const router = express.Router();

router.use("/requests", requestsRouter);
router.use("/knowledge", knowledgeRouter);
router.use("/livekit", livekitRouter);

export default router;
