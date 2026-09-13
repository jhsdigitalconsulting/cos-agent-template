import type { NotificationChannel, NotificationEvent } from "./types";

function formatMessage(event: NotificationEvent): string {
  const heading = event.level === "error" ? "Automation failure" : "Automation notice";
  const body = event.detail ? `\n\n\`\`\`\n${event.detail}\n\`\`\`` : "";
  return `**${heading}** — ${event.context}${body}`;
}

/**
 * Posts to a Teams "incoming webhook" connector URL. Teams reports delivery
 * failures as a non-2xx HTTP status (unlike Slack's 200-with-ok:false), so a
 * thrown fetch or a non-ok response are both treated as failure.
 */
async function postTeams(text: string): Promise<void> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Teams webhook post failed: ${response.status} ${response.statusText}`);
  }
}

export const TeamsNotifier: NotificationChannel = {
  async send(event) {
    try {
      await postTeams(formatMessage(event));
    } catch (error) {
      console.error("failed to post Teams notification", error);
    }
  },
};
