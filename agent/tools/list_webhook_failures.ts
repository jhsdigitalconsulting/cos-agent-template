import { defineTool } from "eve/tools";
import { z } from "zod";
import { listWebhookFailures } from "../../lib/db/webhook-log";

export default defineTool({
  description:
    "List webhook deliveries that failed while processing, most recent first. Use this to find something worth investigating and repairing; use get_webhook_failure with the id to see the full payload before attempting a fix.",
  inputSchema: z.object({
    provider: z
      .string()
      .optional()
      .describe("Filter to one provider's failures, e.g. 'example'. Omit to list failures across all providers."),
  }),
  outputSchema: z.object({
    failures: z.array(
      z.object({
        id: z.number(),
        provider: z.string(),
        receivedAt: z.string(),
        errorMessage: z.string().nullable(),
      }),
    ),
  }),
  label: {
    start: () => "Reading webhook failures",
    complete: (_input, output) => `Found ${output.failures.length} webhook failure(s)`,
  },
  async execute({ provider }) {
    return { failures: await listWebhookFailures(provider) };
  },
});
