import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "../../../../lib/config";
import { withWebhookHandler } from "../../../../lib/webhooks/handler";

/**
 * Worked example of `withWebhookHandler`: a fictional provider that signs its
 * payload with HMAC-SHA256 over a shared secret, in an `x-example-signature`
 * header. Copy this route as the starting point for a real provider's
 * webhook — swap the signature scheme and the handler body for the
 * provider's actual event shape.
 */
function verifySignature(rawBody: string, request: Request): boolean {
  const signature = request.headers.get("x-example-signature");
  if (!signature) return false;

  const expected = createHmac("sha256", requireEnv("EXAMPLE_WEBHOOK_SECRET")).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== signatureBuf.length) return false;

  return timingSafeEqual(expectedBuf, signatureBuf);
}

interface ExamplePayload {
  id: string;
  simulateFailure?: boolean;
}

export const POST = withWebhookHandler("example", {
  verifySignature,

  eventKey: (rawBody) => {
    const payload = JSON.parse(rawBody) as ExamplePayload;
    return payload.id;
  },

  handler: async (rawBody) => {
    const payload = JSON.parse(rawBody) as ExamplePayload;

    if (payload.simulateFailure) {
      // Demonstrates the failure path: withWebhookHandler releases this
      // event's claim and calls notify() before returning 503.
      throw new Error("simulated failure for the example webhook");
    }

    return { outcome: "handled", body: { id: payload.id } };
  },
});
