import { Hono } from "hono";
import type { AppEnv } from "../../types.js";
import {
  getAgentById,
  updateAgent,
  listPhoneNumbers,
} from "@receptionist/core/repositories/agents.js";
import { listServices } from "@receptionist/core/repositories/services.js";
import { storageConfigured } from "@receptionist/core/providers/storage.js";
import { updateSettingsSchema } from "../../schemas.js";

export const settings = new Hono<AppEnv>()
  .get("/", async (c) => {
    const agentId = c.get("agentId");
    const [agent, services, numbers] = await Promise.all([
      getAgentById(agentId),
      listServices(agentId),
      listPhoneNumbers(agentId),
    ]);
    if (!agent) return c.json({ error: "Agent not found" }, 404);

    return c.json({
      business: {
        name: agent.businessName,
        industry: agent.industry,
        timezone: agent.timezone,
        description: agent.description,
        services,
        businessHours: agent.businessHours,
        bookingPolicy: {
          minNoticeMinutes: agent.minNoticeMinutes,
          maxAdvanceDays: agent.maxAdvanceDays,
        },
        recordCalls: agent.recordCalls,
        storageConfigured,
        phoneNumber: numbers[0]?.e164 ?? null,
        calendarProvider: agent.calendarProvider ?? null,
        calendarExternalId: agent.calendarExternalId ?? null,
        calendarPayload: agent.calendarPayload ?? null,
      },
      agent: {
        name: agent.personaName,
        greeting: agent.greeting,
        farewell: agent.farewell,
        fallback: agent.fallback,
      },
      setup: {
        checklistDismissed: agent.checklistDismissed,
        hoursSeen: agent.hoursSeen,
      },
    });
  })
  .patch("/", async (c) => {
    const parsed = updateSettingsSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const body = parsed.data;

    const patch: Parameters<typeof updateAgent>[1] = {};

    if (body.business) {
      const b = body.business;
      if (b.name !== undefined) patch.businessName = b.name;
      if (b.industry !== undefined) patch.industry = b.industry;
      if (b.timezone !== undefined) patch.timezone = b.timezone;
      if (b.description !== undefined) patch.description = b.description;
      if (b.businessHours !== undefined) patch.businessHours = b.businessHours;
      if (b.bookingPolicy !== undefined) {
        patch.minNoticeMinutes = b.bookingPolicy.minNoticeMinutes;
        patch.maxAdvanceDays = b.bookingPolicy.maxAdvanceDays;
      }
      if (b.recordCalls !== undefined) patch.recordCalls = b.recordCalls;
    }

    if (body.agent) {
      const a = body.agent;
      if (a.name !== undefined) patch.personaName = a.name;
      if (a.greeting !== undefined) patch.greeting = a.greeting;
      if (a.farewell !== undefined) patch.farewell = a.farewell;
      if (a.fallback !== undefined) patch.fallback = a.fallback;
    }

    if (body.setup) {
      const { checklistDismissed, hoursSeen } = body.setup;
      if (checklistDismissed !== undefined) patch.checklistDismissed = checklistDismissed;
      if (hoursSeen !== undefined) patch.hoursSeen = hoursSeen;
    }

    await updateAgent(c.get("agentId"), patch);
    return c.json({ updated: true });
  });
