import { z } from "zod";

const serviceItemSchema = z.object({
  name: z.string().min(1),
  price: z.string(),
  description: z.string().optional(),
});

const agentProfileSchema = z.object({
  name: z.string(),
  greeting: z.string(),
  farewell: z.string(),
  fallback: z.string(),
  holdPhrase: z.string(),
});

export const updateSettingsSchema = z.object({
  business: z
    .object({
      name: z.string().optional(),
      industry: z.string().optional(),
      timezone: z.string().optional(),
      description: z.string().optional(),
      services: z.array(serviceItemSchema).optional(),
      googleCalendarId: z.string().nullable().optional(),
    })
    .optional(),
  agent: agentProfileSchema.partial().optional(),
});

export const onboardingCreateSchema = z.object({
  name: z.string().min(1),
  industry: z.string(),
  description: z.string().default(""),
  services: z.array(serviceItemSchema).default([]),
  timezone: z.string().default("UTC"),
  agentProfile: agentProfileSchema.optional(),
});

export const escalationResolveSchema = z.object({
  answer: z.string().min(1, "answer is required"),
});

export const phoneProvisionSchema = z.object({
  phoneNumber: z.string().min(1, "phoneNumber is required"),
});
