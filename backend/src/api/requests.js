import express from "express";
import db from "../database.js";

const router = express.Router();

router.get("/pending", async (_, res) => {
  try {
    const requests = await db.getPendingRequests();
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/unresolved", async (_, res) => {
  try {
    const requests = await db.getUnresolvedRequests();
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/resolved", async (_, res) => {
  try {
    const requests = await db.getResolvedRequests();
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/resolve", async (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;
    if (!answer) return res.status(400).json({ error: "Answer is required" });

    const result = await db.resolveRequest(id, answer);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
