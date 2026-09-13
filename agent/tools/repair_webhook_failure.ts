import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { requireEnv } from "../../lib/config";

const REPO_PATH = "repo";

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default defineTool({
  description:
    "Prepare a sandbox checkout of this repo on a fresh branch for repairing a failed webhook delivery (see list_webhook_failures / get_webhook_failure) or other broken automation code. Clones the repo if it isn't already checked out in this sandbox session, then creates (or reuses) a branch named agent-repair/webhook-<id> (or agent-repair/<topic>) off the latest main. Does not make any code change itself — after calling this, use the bash and write_file tools to inspect the failure, fix the bug, run `pnpm test`/`pnpm typecheck`, commit, push the branch, and open a PR (the `gh` CLI is not installed in the sandbox image, so open the PR via `curl` against the GitHub REST API using $GH_TOKEN, e.g. `POST https://api.github.com/repos/<owner>/<repo>/pulls`). Never push to main directly.",
  inputSchema: z.object({
    webhookFailureId: z
      .number()
      .optional()
      .describe("The webhook_payloads row id being repaired, from list_webhook_failures"),
    topic: z
      .string()
      .optional()
      .describe(
        "Short description of the repair, used for the branch name when this isn't tied to a webhook failure id (e.g. 'hubspot-deal-sync')",
      ),
  }),
  outputSchema: z.object({
    repoPath: z.string(),
    branch: z.string(),
    repo: z.string(),
  }),
  approval: always(),
  label: {
    start: ({ webhookFailureId, topic }) =>
      `Preparing repair branch for ${webhookFailureId ? `webhook failure ${webhookFailureId}` : (topic ?? "a repair")}`,
    complete: (_input, output) => `Ready on branch ${output.branch} at ${output.repoPath}`,
  },
  async execute({ webhookFailureId, topic }, ctx) {
    // owner/repo of this agent's own repository — set by scripts/setup.ts when
    // the client's GitHub repo is created, or by hand in .env.local.
    const repo = requireEnv("GITHUB_REPO");
    if (webhookFailureId === undefined && !topic) {
      throw new Error("Pass either webhookFailureId or topic so the repair branch can be named");
    }

    const sandbox = await ctx.getSandbox();
    const branch =
      webhookFailureId !== undefined
        ? `agent-repair/webhook-${webhookFailureId}`
        : `agent-repair/${slugify(topic as string)}`;

    const cloned = await sandbox.run({ command: `test -d ${REPO_PATH}/.git` });
    if (cloned.exitCode !== 0) {
      const clone = await sandbox.run({
        command: `git clone https://x-access-token:$GH_TOKEN@github.com/${repo}.git ${REPO_PATH}`,
      });
      if (clone.exitCode !== 0) {
        throw new Error(`git clone failed (exit ${clone.exitCode}): ${clone.stderr || clone.stdout}`);
      }
    }

    const sync = await sandbox.run({
      command: `git -C ${REPO_PATH} fetch origin main && git -C ${REPO_PATH} checkout main && git -C ${REPO_PATH} reset --hard origin/main`,
    });
    if (sync.exitCode !== 0) {
      throw new Error(`syncing main failed (exit ${sync.exitCode}): ${sync.stderr || sync.stdout}`);
    }

    const branchExists = await sandbox.run({ command: `git -C ${REPO_PATH} rev-parse --verify ${branch}` });
    const checkout = await sandbox.run({
      command:
        branchExists.exitCode === 0
          ? `git -C ${REPO_PATH} checkout ${branch}`
          : `git -C ${REPO_PATH} checkout -b ${branch}`,
    });
    if (checkout.exitCode !== 0) {
      throw new Error(`checking out ${branch} failed (exit ${checkout.exitCode}): ${checkout.stderr || checkout.stdout}`);
    }

    return { repoPath: `/workspace/${REPO_PATH}`, branch, repo };
  },
});
