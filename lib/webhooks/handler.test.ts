import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLogWebhookPayload = vi.fn();
const mockCompleteWebhookLog = vi.fn();
const mockClaimEvent = vi.fn();
const mockReleaseClaim = vi.fn();
const mockNotify = vi.fn();

vi.mock("../db/webhook-log", () => ({
  logWebhookPayload: (...args: unknown[]) => mockLogWebhookPayload(...args),
  completeWebhookLog: (...args: unknown[]) => mockCompleteWebhookLog(...args),
}));

vi.mock("../db/ledger", () => ({
  claimEvent: (...args: unknown[]) => mockClaimEvent(...args),
  releaseClaim: (...args: unknown[]) => mockReleaseClaim(...args),
}));

vi.mock("../notifications", () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
}));

import { withWebhookHandler } from "./handler";

function request(body = "{}"): Request {
  return new Request("https://example.com/api/hooks/test", { method: "POST", body });
}

function config(overrides: Record<string, unknown> = {}) {
  return { eventKey: () => "evt_1", handler: vi.fn().mockResolvedValue({ outcome: "handled" }), ...overrides } as never;
}

describe("withWebhookHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogWebhookPayload.mockResolvedValue(1);
    mockClaimEvent.mockResolvedValue({ claimed: true });
    mockReleaseClaim.mockResolvedValue(undefined);
    mockNotify.mockResolvedValue(undefined);
  });

  it("logs the payload before verifying the signature", async () => {
    const verifySignature = vi.fn().mockResolvedValue(true);
    const route = withWebhookHandler("test", config({ verifySignature }));
    await route(request());

    expect(mockLogWebhookPayload).toHaveBeenCalledWith("test", expect.any(Request), "{}");
    expect(verifySignature).toHaveBeenCalled();
  });

  it("returns 401 and records an error outcome on invalid signature, without calling the handler", async () => {
    const handler = vi.fn();
    const route = withWebhookHandler("test", config({ verifySignature: () => false, handler }));
    const response = await route(request());

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(mockCompleteWebhookLog).toHaveBeenCalledWith(1, "error", "invalid signature");
  });

  it("records a skipped outcome when the event was already claimed", async () => {
    mockClaimEvent.mockResolvedValue({ claimed: false });
    const handler = vi.fn();
    const route = withWebhookHandler("test", config({ handler }));
    const response = await route(request());

    expect(response.status).toBe(200);
    expect(handler).not.toHaveBeenCalled();
    expect(mockCompleteWebhookLog).toHaveBeenCalledWith(1, "skipped", "already claimed");
  });

  it("records a handled outcome on success", async () => {
    const handler = vi.fn().mockResolvedValue({ outcome: "handled", body: { id: "evt_1" } });
    const route = withWebhookHandler("test", config({ handler }));
    const response = await route(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "handled", id: "evt_1" });
    expect(mockCompleteWebhookLog).toHaveBeenCalledWith(1, "handled");
  });

  it("records an ignored delivery as skipped, not as an error", async () => {
    const handler = vi.fn().mockResolvedValue({ outcome: "ignored", reason: "wrong event type" });
    const route = withWebhookHandler("test", config({ handler }));
    const response = await route(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "ignored", reason: "wrong event type" });
    expect(mockCompleteWebhookLog).toHaveBeenCalledWith(1, "skipped", "wrong event type");
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("records the error message, releases the claim, notifies and returns 503 when the handler throws", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("boom"));
    const route = withWebhookHandler("test", config({ handler }));
    const response = await route(request());

    expect(response.status).toBe(503);
    expect(mockReleaseClaim).toHaveBeenCalledWith("test", "evt_1");
    expect(mockCompleteWebhookLog).toHaveBeenCalledWith(1, "error", "boom");
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ level: "error" }));
  });

  it("skips completing the log when logging itself failed to produce an id", async () => {
    mockLogWebhookPayload.mockResolvedValue(undefined);
    const route = withWebhookHandler("test", config());
    await route(request());

    expect(mockCompleteWebhookLog).not.toHaveBeenCalled();
  });
});
