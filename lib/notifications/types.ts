export interface NotificationEvent {
  level: "info" | "error";
  /** Short label for what happened, e.g. "shopify webhook: orphaned claim". */
  context: string;
  /** Optional longer detail — an error message, a stack trace, a payload summary. */
  detail?: string;
}

export interface NotificationChannel {
  /**
   * Must never throw: a notifier failing to deliver must not be the reason a
   * webhook or workflow run fails. Implementations should catch and
   * console.error internally.
   */
  send(event: NotificationEvent): Promise<void>;
}
