import { AccessToken } from "livekit-server-sdk";
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

/** Three digits, or nothing. Anything else is not a US area code. */
const AREA_CODE = /^\d{3}$/;

/**
 * Available numbers, optionally narrowed to one area code.
 *
 * **The area code must be three digits or absent**, and it must be sent as a
 * *string*. Measured against the live API on 2026-09-03:
 *
 *   omitted / ""   200, ten numbers
 *   "484"          200, ten numbers
 *    484           400 malformed — the field is a string, not an int
 *   "4" / "50"     400 invalid_argument, "Failed to search phone numbers"
 *   "999"          200, zero items — a well-formed code with nothing free
 *
 * A partial code is therefore a client mistake that the carrier reports as an
 * opaque failure, so it is caught here instead. A well-formed code with nothing
 * free is an empty list, which callers handle as its own case.
 *
 * Nothing about this survives the move to Twilio, which accepts `InLocality`,
 * `InPostalCode`, `NearLatLong` and a `Contains` pattern — see PLAN.md 2.2.
 */
export async function searchPhoneNumbers(areaCode?: string): Promise<AvailableNumber[]> {
  if (areaCode && !AREA_CODE.test(areaCode)) {
    throw new InvalidAreaCode(areaCode);
  }

  const data = await twirp("SearchPhoneNumbers", {
    country_code: "US",
    ...(areaCode ? { area_code: areaCode } : {}),
    limit: 10,
  });
  return (data.items as AvailableNumber[]) ?? [];
}

/** A bad area code is the caller's mistake, so it gets a 400 and a reason. */
export class InvalidAreaCode extends Error {
  constructor(public readonly given: string) {
    super(`"${given}" is not an area code. Give three digits, or leave it blank.`);
    this.name = "InvalidAreaCode";
  }
}

export async function purchasePhoneNumber(
  phoneNumber: string
): Promise<{ e164_format: string; status: string }> {
  const data = await twirp("PurchasePhoneNumber", { phone_numbers: [phoneNumber] });
  const purchased = (data.phone_numbers as Array<{ e164_format: string; status: string }>)[0];
  return purchased;
}

export async function releasePhoneNumber(phoneNumber: string): Promise<void> {
  // LiveKit requires dissociating from any dispatch rule before releasing.
  // Without this, ReleasePhoneNumbers returns 400 when the rule would become a catch-all.
  await twirp("UpdatePhoneNumber", {
    phone_number: phoneNumber,
    sip_dispatch_rule_id: "",
  });
  await twirp("ReleasePhoneNumbers", { phone_numbers: [phoneNumber] });
}
