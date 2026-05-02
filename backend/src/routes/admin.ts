import express from "express";
import { db } from "../db/client.js";
import { calls, escalations as escalationsTable } from "../db/schema.js";
import { and, count, eq } from "drizzle-orm";
import {
  listEscalations,
  resolveEscalation,
  getEscalationById,
} from "../services/escalations.js";
import { createKnowledgeFromEscalation, listKnowledge, deleteKnowledge } from "../services/knowledge.js";
import { listCalls } from "../services/calls.js";
import { getTenantById, updateTenant } from "../services/tenants.js";

const router = express.Router();

// Temporary: single-tenant stub until admin auth is implemented.
// Replace with req.tenantId injected by auth middleware in a future phase.
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

// GET /api/admin/metrics
router.get("/metrics", async (_req, res) => {
  try {
    const tenantId = DEFAULT_TENANT_ID;

    const [[totalCalls], [pendingEscalations]] = await Promise.all([
      db.select({ count: count() }).from(calls).where(eq(calls.tenantId, tenantId)),
      db
        .select({ count: count() })
        .from(escalationsTable)
        .where(and(eq(escalationsTable.tenantId, tenantId), eq(escalationsTable.status, "pending"))),
    ]);

    res.json({
      totalCalls: Number(totalCalls.count),
      pendingEscalations: Number(pendingEscalations.count),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/admin/escalations?status=pending|resolved
router.get("/escalations", async (req, res) => {
  try {
    const tenantId = DEFAULT_TENANT_ID;
    const status = req.query.status === "resolved" ? "resolved" : "pending";
    const rows = await listEscalations(tenantId, status);
    res.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/admin/escalations/:id/resolve
router.post("/escalations/:id/resolve", async (req, res) => {
  try {
    const tenantId = DEFAULT_TENANT_ID;
    const { id } = req.params;
    const { answer } = req.body as { answer?: string };

    if (!answer?.trim()) {
      res.status(400).json({ error: "answer is required" });
      return;
    }

    const escalation = await getEscalationById(id, tenantId);
    if (!escalation) {
      res.status(404).json({ error: "Escalation not found" });
      return;
    }

    // Both operations must succeed — if knowledge creation fails, the client can retry.
    await resolveEscalation(id, tenantId, answer);
    await createKnowledgeFromEscalation(escalation, answer);

    // TODO Phase 5: send SMS to escalation.callerPhone

    res.json({ id, status: "resolved" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/admin/knowledge
router.get("/knowledge", async (_req, res) => {
  try {
    const rows = await listKnowledge(DEFAULT_TENANT_ID);
    res.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// DELETE /api/admin/knowledge/:id
router.delete("/knowledge/:id", async (req, res) => {
  try {
    await deleteKnowledge(req.params.id, DEFAULT_TENANT_ID);
    res.json({ id: req.params.id, deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/admin/calls
router.get("/calls", async (_req, res) => {
  try {
    const rows = await listCalls(DEFAULT_TENANT_ID);
    res.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/admin/settings
router.get("/settings", async (_req, res) => {
  try {
    const tenant = await getTenantById(DEFAULT_TENANT_ID);
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    res.json({
      name: tenant.name,
      timezone: tenant.timezone,
      systemPrompt: tenant.systemPrompt,
      businessProfile: tenant.businessProfile,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// PATCH /api/admin/settings
router.patch("/settings", async (req, res) => {
  try {
    const { name, timezone, systemPrompt, businessProfile } = req.body as {
      name?: string;
      timezone?: string;
      systemPrompt?: string;
      businessProfile?: Record<string, unknown>;
    };

    await updateTenant(DEFAULT_TENANT_ID, { name, timezone, systemPrompt, businessProfile });
    res.json({ updated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
