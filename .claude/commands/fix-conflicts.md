---
description: Find open PRs on this repo with merge conflicts against main and resolve them
---

Find every open pull request on this GitHub repo that has a merge conflict against its base branch, and resolve the conflicts one PR at a time. Optional argument: a specific PR number (`/fix-conflicts 12`) to limit the work to just that PR instead of scanning all open PRs.

## 1. Find conflicting PRs

Run:

```
gh pr list --state open --json number,title,headRefName,baseRefName,mergeable,mergeStateStatus
```

A PR needs attention when `mergeable` is `CONFLICTING`. GitHub computes this asynchronously, so if a PR shows `UNKNOWN`, re-fetch that one PR by number after a few seconds before deciding it's clean.

If an argument was given, restrict to that PR number. Otherwise process every conflicting PR, oldest first. Report the full list to the user before starting work (PR number, title, branch) so they know what's about to happen.

## 2. Resolve one PR at a time, in an isolated worktree

For each conflicting PR, do the work in a dedicated git worktree so it never disturbs the current working tree or in-progress branch:

```
git worktree add .claude/worktrees/fix-conflicts-<pr-number> <head-branch>
```

Inside that worktree:

1. `git fetch origin <base-branch>` and merge it in: `git merge origin/<base-branch>`.
2. Read every file git reports as conflicted. Resolve each conflict by understanding the intent of both sides (the PR's change and whatever landed on the base branch since), not by mechanically picking one side — preserve both changes when they're not actually in tension.
3. After resolving, remove all conflict markers, stage the files, and run this project's validation: `pnpm install` if lockfile conflicted, then `pnpm typecheck`, `pnpm test`, and `pnpm build`. Fix anything the merge broke.
4. `git commit` the merge with a plain message like `Merge <base-branch> into <head-branch>` (no attribution lines needed on a merge commit).

## 3. Confirm before pushing

Pushing updates a shared branch other people (and their open PR) depend on. Before pushing, show the user a summary of what was conflicting and how it was resolved for this PR, and get explicit confirmation. Never force-push. On confirmation:

```
git push origin <head-branch>
```

Then remove the worktree: `git worktree remove .claude/worktrees/fix-conflicts-<pr-number>`.

## 4. Move to the next PR

Repeat step 2–3 for each remaining conflicting PR. If a conflict can't be resolved with confidence (semantic conflict, unclear intent, failing tests you can't fix), stop on that PR, leave its worktree in place, and tell the user what's blocking it rather than guessing.

## 5. Summarize

When done, report per PR: resolved-and-pushed, skipped (why), or not actually conflicting after re-check.
