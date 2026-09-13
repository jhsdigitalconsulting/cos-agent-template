import { callSlackApi } from "eve/channels/slack";
import { requireEnv } from "../config";
import { SLACK_CREDENTIALS } from "../slack-credentials";
import type { NotificationChannel, NotificationEvent } from "./types";

function formatMessage(event: NotificationEvent): string {
  const icon = event.level === "error" ? ":rotating_light:" : ":information_source:";
  const heading = event.level === "error" ? "Automation failure" : "Automation notice";
  const body = event.detail ? `\n\`\`\`${event.detail}\`\`\`` : "";
  return `${icon} *${heading}* — ${event.context}${body}`;
}

/**
 * callSlackApi is a raw passthrough: it throws only on a non-2xx HTTP status.
 * Slack reports channel_not_found, not_in_channel and invalid_auth as HTTP 200
 * with `ok: false`, so an unchecked call fails silently.
 */
async function postSlack(text: string): Promise<void> {
  const operation = "chat.postMessage";
  const response = await callSlackApi({
    botToken: SLACK_CREDENTIALS.botToken,
    operation,
    body: { channel: requireEnv("SLACK_OPS_CHANNEL"), text },
  });

  if (response.ok !== true) {
    throw new Error(`Slack ${operation} failed: ${response.error}`);
  }
}

export const SlackNotifier: NotificationChannel = {
  async send(event) {
    try {
      await postSlack(formatMessage(event));
    } catch (error) {
      console.error("failed to post Slack notification", error);
    }
  },
};
