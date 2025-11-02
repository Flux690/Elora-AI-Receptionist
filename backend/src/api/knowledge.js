import express from "express";
import db from "../database.js";

const router = express.Router();

// GET /api/knowledge
router.get("/", async (req, res) => {
  try {
    const knowledge = await db.getKnowledgeBase();
    res.json(knowledge);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
