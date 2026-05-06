import { AccessToken, SipClient } from "livekit-server-sdk";
import { RoomConfiguration, RoomAgentDispatch } from "@livekit/protocol";
import { env } from "../env.js";

const LIVEKIT_HTTP = env.LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://");

async function makeSipAdminToken(): Promise<string> {
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  at.addSIPGrant({ admin: true });
  return await at.toJwt();
}

async function twirp(method: string, body: object): Promise<Record<string, unknown>> {
  const res = await fetch(`${LIVEKIT_HTTP}/twirp/livekit.PhoneNumberService/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await makeSipAdminToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LiveKit PhoneNumberService/${method} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export interface AvailableNumber {
  id: string;
  e164_format: string;
  locality: string;
  region: string;
}

export async function searchPhoneNumbers(areaCode: string): Promise<AvailableNumber[]> {
  const data = await twirp("SearchPhoneNumbers", {
    country_code: "US",
    area_code: areaCode,
    limit: 10,
  });
  return (data.items as AvailableNumber[]) ?? [];
}

export async function purchasePhoneNumber(
  phoneNumber: string,
  sipDispatchRuleId: string
): Promise<{ e164_format: string; status: string }> {
  const data = await twirp("PurchasePhoneNumber", {
    phone_numbers: [phoneNumber],
    sip_dispatch_rule_id: sipDispatchRuleId,
  });
  const purchased = (data.phone_numbers as Array<{ e164_format: string; status: string }>)[0];
  return purchased;
}

export async function releasePhoneNumber(phoneNumber: string): Promise<void> {
  await twirp("ReleasePhoneNumbers", { phone_numbers: [phoneNumber] });
}

const sipClient = new SipClient(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

export async function createSipDispatchRule(tenantId: string): Promise<string> {
  const rule = await sipClient.createSipDispatchRule(
    { type: "individual", roomPrefix: "call-" },
    {
      name: `tenant-${tenantId}`,
      metadata: JSON.stringify({ tenantId }),
      roomConfig: new RoomConfiguration({
        agents: [
          new RoomAgentDispatch({
            agentName: "receptionist",
            metadata: JSON.stringify({ tenantId }),
          }),
        ],
      }),
    }
  );
  return rule.sipDispatchRuleId!;
}

export async function deleteSipDispatchRule(sipDispatchRuleId: string): Promise<void> {
  await sipClient.deleteSipDispatchRule(sipDispatchRuleId);
}
