import { describe, expect, it, vi } from "vitest";
import { attachRunWith, claimEventWith, isUniqueViolation, releaseClaimWith } from "./ledger";

describe("isUniqueViolation", () => {
  it("recognises Postgres error code 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("rejects other errors", () => {
    expect(isUniqueViolation({ code: "42P01" })).toBe(false);
    expect(isUniqueViolation(new Error("network"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("claimEventWith", () => {
  it("claims when the insert succeeds", async () => {
    const query = vi.fn().mockResolvedValue([]);
    expect(await claimEventWith(query, "shopify", "order-1")).toEqual({ claimed: true });
    expect(query).toHaveBeenCalledOnce();
  });

  it("reports the existing run id when the key is already claimed", async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce({ code: "23505" })
      .mockResolvedValueOnce([{ run_id: "wrun_abc" }]);
    expect(await claimEventWith(query, "shopify", "order-1")).toEqual({
      claimed: false,
      runId: "wrun_abc",
    });
  });

  it("reports a null run id when the claim exists but has not started a run", async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce({ code: "23505" })
      .mockResolvedValueOnce([{ run_id: null }]);
    expect(await claimEventWith(query, "shopify", "order-1")).toEqual({
      claimed: false,
      runId: null,
    });
  });

  it("rethrows errors that are not unique violations", async () => {
    const query = vi.fn().mockRejectedValue(new Error("connection refused"));
    await expect(claimEventWith(query, "shopify", "order-1")).rejects.toThrow("connection refused");
  });
});

describe("attachRunWith", () => {
  it("resolves when the update matched the claim", async () => {
    const query = vi.fn().mockResolvedValue([{ run_id: "wrun_abc" }]);
    await expect(attachRunWith(query, "shopify", "order-1", "wrun_abc")).resolves.toBeUndefined();
  });

  it("throws when no ledger row matched, so a lost run id is never silent", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await expect(attachRunWith(query, "shopify", "order-1", "wrun_abc")).rejects.toThrow(
      /no ledger row to attach run wrun_abc/,
    );
  });
});

describe("releaseClaimWith", () => {
  it("deletes only a claim that never started a run", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await releaseClaimWith(query, "shopify", "order-1");
    const [strings, ...values] = query.mock.calls[0];
    const statement = strings.join("?");
    expect(statement).toContain("DELETE FROM event_ledger");
    expect(statement).toContain("run_id IS NULL");
    expect(values).toEqual(["shopify", "order-1"]);
  });
});
