import { defineTool } from "eve/tools";
import { z } from "zod";
import { getWebhookFailure } from "../../lib/db/webhook-log";

export default defineTool({
  description:
    "Get the full raw payload and headers for one failed webhook delivery, by the id from list_webhook_failures. Use this to understand what actually broke before writing a repair.",
  inputSchema: z.object({
    id: z.number().describe("The webhook_payloads row id, from list_webhook_failures"),
  }),
  outputSchema: z.object({
    failure: z
      .object({
        id: z.number(),
        provider: z.string(),
        receivedAt: z.string(),
        errorMessage: z.string().nullable(),
        headers: z.record(z.string(), z.unknown()),
        body: z.string(),
      })
      .nullable(),
  }),
  label: {
    start: ({ id }) => `Reading webhook failure ${id}`,
    complete: ({ id }) => `Read webhook failure ${id}`,
  },
  async execute({ id }) {
    return { failure: await getWebhookFailure(id) };
  },
});
