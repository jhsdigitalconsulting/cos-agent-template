import { connectSlackCredentials } from "@vercel/connect/eve";
import type { SlackChannelCredentials } from "eve/channels/slack";

/**
 * The Vercel Connect connector holding the Slack app install. Connect owns the
 * bot token (rotating it server-side, so `botToken` is a function invoked per
 * call rather than a string) and authenticates inbound webhooks out-of-band via
 * `webhookVerifier`. Nothing here reads a Slack secret from the environment.
 *
 * `agent/channels/slack.ts` names the same connector for eve's own Slack
 * channel; this module is the automation side of the same install.
 *
 * Replace "slack/{{CLIENT_SLUG}}" with this client's actual Vercel Connect
 * connector slug (set by `scripts/init-client.ts` or by hand).
 */
export const SLACK_CREDENTIALS: SlackChannelCredentials = connectSlackCredentials(
  process.env.SLACK_CONNECT_SLUG ?? "slack/{{CLIENT_SLUG}}",
);
