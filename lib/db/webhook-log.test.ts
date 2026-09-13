import { describe, expect, it, vi } from "vitest";
import {
  completeWebhookLogWith,
  getWebhookFailureWith,
  listWebhookFailuresWith,
  logWebhookPayloadWith,
} from "./webhook-log";

describe("logWebhookPayloadWith", () => {
  it("inserts the provider, headers and raw body, and returns the new row id", async () => {
    const query = vi.fn().mockResolvedValue([{ id: 7 }]);
    const headers = new Headers({ "x-example-signature": "abc" });
    const id = await logWebhookPayloadWith(query, "example", headers, '{"id":"evt_1"}');

    const [strings, ...values] = query.mock.calls[0];
    const statement = strings.join("?");
    expect(statement).toContain("INSERT INTO webhook_payloads");
    expect(statement).toContain("RETURNING id");
    expect(values[0]).toBe("example");
    expect(JSON.parse(values[1] as string)).toEqual({ "x-example-signature": "abc" });
    expect(values[2]).toBe('{"id":"evt_1"}');
    expect(id).toBe(7);
  });

  it("never throws when the insert fails, only logs it and returns undefined", async () => {
    const query = vi.fn().mockRejectedValue(new Error("connection refused"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(logWebhookPayloadWith(query, "example", new Headers(), "{}")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("completeWebhookLogWith", () => {
  it("updates outcome, error_message and completed_at for the given id", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await completeWebhookLogWith(query, 42, "error", "boom");

    const [strings, ...values] = query.mock.calls[0];
    const statement = strings.join("?");
    expect(statement).toContain("UPDATE webhook_payloads");
    expect(values).toEqual(["error", "boom", 42]);
  });

  it("never throws when the update fails, only logs it", async () => {
    const query = vi.fn().mockRejectedValue(new Error("connection refused"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(completeWebhookLogWith(query, 1, "handled")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("listWebhookFailuresWith", () => {
  it("maps rows to camelCase summaries", async () => {
    const query = vi.fn().mockResolvedValue([
      { id: 1, provider: "example", received_at: "2026-01-01T00:00:00Z", error_message: "boom" },
    ]);
    expect(await listWebhookFailuresWith(query)).toEqual([
      { id: 1, provider: "example", receivedAt: "2026-01-01T00:00:00Z", errorMessage: "boom" },
    ]);
  });

  it("filters by provider when one is given", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await listWebhookFailuresWith(query, "example");

    const [strings, ...values] = query.mock.calls[0];
    expect(strings.join("?")).toContain("provider =");
    expect(values).toEqual(["example"]);
  });
});

describe("getWebhookFailureWith", () => {
  it("returns null when no row matches", async () => {
    const query = vi.fn().mockResolvedValue([]);
    expect(await getWebhookFailureWith(query, 1)).toBeNull();
  });

  it("maps the row to camelCase, including headers and body", async () => {
    const query = vi.fn().mockResolvedValue([
      {
        id: 1,
        provider: "example",
        received_at: "2026-01-01T00:00:00Z",
        error_message: "boom",
        headers: { "x-foo": "bar" },
        body: "{}",
      },
    ]);
    expect(await getWebhookFailureWith(query, 1)).toEqual({
      id: 1,
      provider: "example",
      receivedAt: "2026-01-01T00:00:00Z",
      errorMessage: "boom",
      headers: { "x-foo": "bar" },
      body: "{}",
    });
  });
});
