import { SlackNotifier } from "./slack";
import { TeamsNotifier } from "./teams";
import type { NotificationChannel, NotificationEvent } from "./types";

export type { NotificationChannel, NotificationEvent } from "./types";

const CHANNELS: Record<string, NotificationChannel> = {
  slack: SlackNotifier,
  teams: TeamsNotifier,
};

function configuredChannels(): NotificationChannel[] {
  const names = (process.env.NOTIFICATION_CHANNELS ?? "slack")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return names.map((name) => CHANNELS[name]).filter((channel): channel is NotificationChannel => channel !== undefined);
}

/**
 * Fans an event out to every channel named in NOTIFICATION_CHANNELS (comma
 * list, e.g. "slack,teams"; defaults to "slack"). Each channel already
 * swallows its own delivery errors, so this never throws.
 */
export async function notify(event: NotificationEvent): Promise<void> {
  await Promise.all(configuredChannels().map((channel) => channel.send(event)));
}
