import { describe, expect, it, vi } from "vitest";
import { getCursorWith, setCursorWith } from "./cursor";

describe("getCursorWith", () => {
  it("returns the stored cursor value", async () => {
    const query = vi.fn().mockResolvedValue([{ cursor_value: "2026-09-01T00:00:00Z" }]);
    expect(await getCursorWith(query, "qbo-paid-invoices")).toBe("2026-09-01T00:00:00Z");
  });

  it("returns null when no cursor has been set yet", async () => {
    const query = vi.fn().mockResolvedValue([]);
    expect(await getCursorWith(query, "qbo-paid-invoices")).toBeNull();
  });
});

describe("setCursorWith", () => {
  it("upserts the cursor value", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await setCursorWith(query, "qbo-paid-invoices", "2026-09-02T00:00:00Z");
    expect(query).toHaveBeenCalledOnce();
  });
});
