import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchPhoneNumbers, InvalidAreaCode } from "./telephony.js";

/**
 * The area code rule, measured against the live API on 2026-09-03:
 *
 *   omitted / ""   200, ten numbers
 *   "484"          200, ten numbers
 *    484           400 malformed — the field is a string, not an int
 *   "4" / "50"     400 invalid_argument, "Failed to search phone numbers"
 *   "999"          200, zero items
 *
 * A partial code is therefore a client mistake that LiveKit reports as an opaque
 * carrier failure, which is why the length is checked here rather than left to
 * surface as an unhandled 500 with nothing on screen.
 */
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ items: [] }),
    text: async () => "{}",
  });
});

const sentBody = () => JSON.parse(fetchMock.mock.calls[0]![1].body as string);

describe("searchPhoneNumbers", () => {
  it("rejects a one- or two-digit code before it reaches the carrier", async () => {
    for (const bad of ["4", "50"]) {
      await expect(searchPhoneNumbers(bad)).rejects.toThrow(InvalidAreaCode);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects anything that is not three digits", async () => {
    for (const bad of ["abc", "5035", "50a", "+503"]) {
      await expect(searchPhoneNumbers(bad)).rejects.toThrow(InvalidAreaCode);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says what to do instead", async () => {
    // The message reaches the owner, so it has to be an instruction.
    await expect(searchPhoneNumbers("50")).rejects.toThrow(
      /three digits, or leave it blank/i
    );
  });

  it("sends a three-digit code through as a string", async () => {
    // Sending it as a number gets `malformed` back — the field is a string.
    await searchPhoneNumbers("503");
    expect(sentBody().area_code).toBe("503");
    expect(typeof sentBody().area_code).toBe("string");
  });

  it("omits the field entirely when no code was given", async () => {
    await searchPhoneNumbers();
    expect(sentBody()).not.toHaveProperty("area_code");
  });

  it("treats an empty string as no code rather than an invalid one", async () => {
    // The field starts empty and the button stays enabled, so this is the
    // ordinary first load, not a mistake.
    await searchPhoneNumbers("");
    expect(sentBody()).not.toHaveProperty("area_code");
  });
});
