import { describe, expect, it, vi } from "vitest";
import { logWebhookPayloadWith } from "./webhook-log";

describe("logWebhookPayloadWith", () => {
  it("inserts the provider, headers and raw body", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const headers = new Headers({ "calendly-webhook-signature": "t=1,v1=abc" });
    await logWebhookPayloadWith(query, "calendly", headers, '{"event":"invitee.created"}');

    const [strings, ...values] = query.mock.calls[0];
    const statement = strings.join("?");
    expect(statement).toContain("INSERT INTO webhook_payloads");
    expect(values[0]).toBe("calendly");
    expect(JSON.parse(values[1] as string)).toEqual({
      "calendly-webhook-signature": "t=1,v1=abc",
    });
    expect(values[2]).toBe('{"event":"invitee.created"}');
  });

  it("never throws when the insert fails, only logs it", async () => {
    const query = vi.fn().mockRejectedValue(new Error("connection refused"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      logWebhookPayloadWith(query, "shopify", new Headers(), "{}"),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
