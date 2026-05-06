import { Hono } from "hono";
import { Webhook } from "svix";
import { env } from "../env.js";
import { db } from "../db/client.js";
import { tenants } from "../db/schema.js";

const webhooksRouter = new Hono();

webhooksRouter.post("/clerk", async (c) => {
  const payload = await c.req.text();
  const headers = c.req.header();

  const svix_id = headers["svix-id"];
  const svix_timestamp = headers["svix-timestamp"];
  const svix_signature = headers["svix-signature"];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return c.json({ error: "Missing svix headers" }, 400);
  }

  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);

  let evt: any;
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return c.json({ error: "Invalid signature" }, 400);
  }

  const { id } = evt.data;
  const eventType = evt.type;

  if (eventType === "user.created") {
    console.log(`[Webhook] User created: ${id}. Inserting default tenant row.`);
    try {
      await db.insert(tenants).values({
        clerkUserId: id,
        name: "",
        vertical: "salon",
        timezone: "UTC",
        additionalInstructions: "",
        businessProfile: {},
      });
      console.log(`[Webhook] Successfully created tenant for ${id}`);
    } catch (err) {
      console.error("[Webhook] Error inserting tenant row:", err);
    }
  }

  return c.json({ success: true }, 200);
});

export default webhooksRouter;
