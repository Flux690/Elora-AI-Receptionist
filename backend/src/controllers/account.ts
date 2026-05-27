import { getAuth } from "@clerk/hono";
import { createClerkClient } from "@clerk/backend";
import type { AppContext } from "../types.js";
import { getTenantById, deleteTenant } from "../services/tenants.js";
import { getCallIdsWithRecordings } from "../services/calls.js";
import { releasePhoneNumber } from "../services/telephony.js";
import { deleteRecording } from "../services/storage.js";
import { env } from "../env.js";

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export async function deleteAccount(c: AppContext) {
  const auth = getAuth(c);
  const tenantId = c.get("tenantId");

  const tenant = await getTenantById(tenantId);

  // 1. Collect all recording keys BEFORE the cascade fires and wipes the calls rows.
  //    After deleteTenant() below, these rows no longer exist so there's no second chance.
  const callIds = await getCallIdsWithRecordings(tenantId);

  // 2. Delete all R2 recordings in parallel. A failed delete is logged but does NOT
  //    abort the account deletion — orphaned objects in R2 are recoverable manually,
  //    but blocking account deletion on a storage error is not acceptable UX.
  if (callIds.length > 0) {
    await Promise.all(
      callIds.map((id) =>
        deleteRecording(id).catch((err: unknown) =>
          console.error(`[account] failed to delete recording for call ${id}:`, err)
        )
      )
    );
    console.log(`[account] deleted ${callIds.length} recording(s) from R2 for tenant ${tenantId}`);
  }

  // 3. Release the LiveKit phone number (dissociate from dispatch rule, then return to pool).
  if (tenant?.phoneNumber) {
    await releasePhoneNumber(tenant.phoneNumber).catch((err: unknown) =>
      console.error("[account] phone number release failed:", err)
    );
  }

  // 4. Delete the tenant row — cascades to clients, calls, escalations,
  //    knowledge_items, and appointments automatically.
  await deleteTenant(tenantId);

  // 5. Delete the Clerk user — must come last so the auth context remains
  //    valid for all steps above.
  await clerkClient.users.deleteUser(auth!.userId!);

  return c.json({ ok: true });
}
