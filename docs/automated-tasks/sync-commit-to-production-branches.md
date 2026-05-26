# Sync commit(s) to all production branches

Copy everything below the line into a new chat (or append your commit SHAs at the end). The agent runs this workflow on your behalf using git in the terminal—not a script.

---

## Task: Cherry-pick shared commit(s) to all production portals

You are syncing work from the integration branch to four separate production branches. Each branch deploys a different portal instance; only **shared application code** should be propagated. Do not merge entire branches.

### Repository context

| Role | Branch |
|------|--------|
| Where features are built first | `multiple-login-demo` |
| Production (sync targets, in this order) | `allstaff-production` → `canhire-production` → `godspeed-production` → `hdgroup-production` |

Remote: `origin`. Workspace: `godspeed-ops-portal`.

### Input from me

I will provide one or more commit SHAs (full or short). Apply them **oldest first** if I give multiple. If order is unclear, use `git log --oneline` on `multiple-login-demo` to sort.

**Commit(s) to sync:** _(I fill in below)_

```
<PASTE COMMIT SHA(s) HERE>
```

Optional flags I may add:

- `no-push` — do **not** push to `origin` (default is to push when there are no conflicts; see §4)
- `no-pull` — skip `git pull` before cherry-pick (default is to pull each production branch first)

---

## What you must do

### 0. Preconditions

1. Confirm the working tree is clean (`git status`). If dirty, stop and tell me what is uncommitted—do not stash or discard without asking.
2. Record current branch so you can return to it at the end (usually `multiple-login-demo`).
3. Verify each commit exists and inspect it: `git show --stat <sha>`. Summarize in one line what the commit touches. If it clearly contains portal-only config (`.env`, branding-only assets, single-tenant secrets), **stop** and warn me before proceeding.

### 1. For each commit SHA (in order)

For each production branch in order: **allstaff-production** → **canhire-production** → **godspeed-production** → **hdgroup-production**:

1. `git fetch origin` (once per session is enough).
2. `git checkout <production-branch>`
3. Unless I said `no-pull`: `git pull origin <production-branch>`
4. `git cherry-pick -x <sha>`
   - `-x` appends “cherry picked from …” for traceability.

### 2. On success for all four branches (one commit)

- Briefly note: branch name, new cherry-pick commit hash if useful.
- Continue to the next commit SHA if I gave more than one.

### 3. On cherry-pick conflict — STOP and engage

**Do not** force-push, `git cherry-pick --skip`, or `git reset --hard` without my explicit approval.

1. Leave the repo in conflict state on the failing branch.
2. Report clearly:
   - Which **commit SHA**
   - Which **production branch**
   - Which **files** conflict (`git status`, `git diff --name-only --diff-filter=U`)
3. Attempt resolution **only if** the conflict is obviously the same logical change across portals (e.g. identical shared component). Safe reuse:
   - After resolving on the first production branch that conflicted, on the next branches you may try:  
     `git checkout <first-resolved-branch> -- <path>`  
     then `git add` and `git cherry-pick --continue`
4. If resolution is ambiguous, portal-specific, or touches env/tenant config: **stop**, show me the conflict hunks, and ask how to proceed.
5. After I confirm or you resolve with high confidence: `git cherry-pick --continue`, then resume the loop on the **remaining** production branches for that same SHA, then any remaining SHAs.

### 4. After all requested commits are applied to all four branches

1. `git checkout` back to the branch I started on (usually `multiple-login-demo`).
2. Give a **summary table**:

   | Commit | allstaff | canhire | godspeed | hdgroup | Notes |
   |--------|----------|---------|----------|---------|-------|
   | `<short-sha>` | ok / conflict / skipped | … | … | … | |

3. **Push (default)** — unless I said `no-push`:
   - If **every** cherry-pick for **every** requested commit succeeded on **all four** branches with **no unresolved conflicts**, push all four production branches to `origin`:
     - `git push origin allstaff-production canhire-production godspeed-production hdgroup-production`
     - Or push each branch individually if a single combined push fails.
   - Report the pushed ref ranges (e.g. `4192d5e..73a0f65`).
   - If **any** cherry-pick hit a conflict and was not fully completed on all four branches: **do not push** anything. Tell me which branches are ahead locally and wait for my direction.
   - If some branches succeeded and others conflicted mid-run: push **only** branches that fully completed all requested cherry-picks for this session, and say explicitly which were not pushed.

### 5. Safety rules (non-negotiable)

- Never `git push --force` to any `*-production` branch.
- Never merge `multiple-login-demo` into production wholesale.
- Never amend or rewrite commits on production unless I explicitly ask.
- Never update git config.
- Do not commit unrelated fixes while resolving conflicts—only what is required for the cherry-pick.
- If cherry-pick is in a bad state and we need to abort: `git cherry-pick --abort` only after telling me.

---

## How I invoke this

Minimal message in chat (cherry-pick + push on success):

```text
Run docs/automated-tasks/sync-commit-to-production-branches.md

Commits:
03fa4fa
b534379
```

Skip push (local cherry-picks only):

```text
Run docs/automated-tasks/sync-commit-to-production-branches.md no-push

Commits:
03fa4fa
```

---

## Success criteria

- Each given commit exists on all four production branches (new cherry-pick commits with `-x` metadata), **and** those branches are pushed to `origin` (unless `no-push` or a conflict stopped the run), **or**
- You stopped on the first conflict with a clear report, **did not push** (unless some branches fully completed—in that case only those are pushed), and the repo is in a recoverable state (`cherry-pick --continue` or `--abort` documented).
