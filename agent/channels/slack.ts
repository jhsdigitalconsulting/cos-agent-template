import { slackChannel } from "eve/channels/slack";
import { SLACK_CREDENTIALS } from "../../lib/slack-credentials";

/**
 * Vercel Connect owns the Slack app, so every inbound Slack request — events,
 * interactivity, slash commands — arrives at this channel's single trigger
 * destination (`/eve/v1/slack`). Any custom interactive-button handling (e.g.
 * approve/decline buttons on a notification) has to be added to
 * `onInteraction` below, since Slack has nowhere else to post it.
 */
export default slackChannel({
  credentials: SLACK_CREDENTIALS,

  async onInteraction(action, ctx) {
    // Example extension point: handle a button whose actionId you define,
    // e.g. action.actionId.startsWith("approve_").
    void action;
    void ctx;
  },
});
