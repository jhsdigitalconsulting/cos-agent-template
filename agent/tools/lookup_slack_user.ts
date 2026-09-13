import { defineTool } from "eve/tools";
import { callSlackApi } from "eve/channels/slack";
import { z } from "zod";
import { SLACK_CREDENTIALS } from "@/lib/slack-credentials";

/**
 * Inbound Slack messages carry the speaker's user id, not their name, so the
 * agent has no way to address someone correctly without asking Slack. Requires
 * the `users:read` scope on the Connect-owned Slack app.
 */
export default defineTool({
  description:
    "Look up who a Slack user id belongs to. Inbound Slack messages are attributed by user id (U…), so use this before addressing someone by name.",
  inputSchema: z.object({
    userId: z.string().describe("Slack user id, e.g. U012ABCDEF"),
  }),
  label: {
    start: () => "Looking up the Slack user",
    complete: () => "Looked up the Slack user",
  },
  async execute({ userId }) {
    const operation = "users.info";
    const response = await callSlackApi({
      botToken: SLACK_CREDENTIALS.botToken,
      operation,
      body: { user: userId },
    });

    if (response.ok !== true) {
      throw new Error(`Slack ${operation} failed: ${response.error}`);
    }

    const user = response.user as {
      name?: string;
      real_name?: string;
      is_bot?: boolean;
      profile?: { display_name?: string; real_name?: string; first_name?: string; email?: string };
    };

    return {
      userId,
      displayName: user.profile?.display_name || user.profile?.real_name || user.real_name || user.name,
      firstName: user.profile?.first_name,
      email: user.profile?.email,
      isBot: user.is_bot === true,
    };
  },
});
