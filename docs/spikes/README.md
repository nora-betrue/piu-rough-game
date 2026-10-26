# Spikes

Short, throwaway experiments that answer the questions the architecture depends on, before any
app code exists. Each brief is self-contained, so you can hand it to a fresh Claude Code session.

| # | Spike | Answers | Needs from the owner | Depends on |
|---|---|---|---|---|
| 1 | [Worker → piugame.com TLS](01-worker-tls.md) | Can a Worker reach piugame.com despite the missing intermediate cert? | Cloudflare account (`pnpm wrangler login`) | none |
| 2 | [piugame login from Cloudflare](02-piugame-login.md) | Does the login flow work from Cloudflare, and what do the pages look like? | Cloudflare account, a **dummy** piugame account | Uses #1's result, but can run in parallel (it tests both runtimes) |
| 3 | [Bookmarklet CSP](03-bookmarklet-csp.md) | Can a bookmarklet on piugame.com load our script, read pages and send data out? | The dummy piugame account, plus 5 minutes in a real browser | none |
| 4 | [Export rendering in a Worker](04-export-rendering.md) | Do Satori + resvg + Korean fonts fit in a Worker, and how fast is a top-50 render? | Cloudflare account (for the CPU timings) | none |
| 5 | [PIU Scores API access](05-piu-scores-api.md) | Does a tool key work, what does `official/rankings` return, how complete is the catalog? | A PIU Scores account with Discord linked | none |

## Running them in parallel

Parallel sessions must not share a working directory: each `git checkout` would pull the branch
out from under the others. Give every spike its own **git worktree**:

```sh
cd ~/repos/yet-another-piu-tracker
git worktree add ../rg-spike-01 -b spike/01-worker-tls
git worktree add ../rg-spike-02 -b spike/02-piugame-login
git worktree add ../rg-spike-03 -b spike/03-bookmarklet-csp
git worktree add ../rg-spike-04 -b spike/04-export-rendering
git worktree add ../rg-spike-05 -b spike/05-piu-scores-api
```

Then start one session per folder and prompt it with:

> Read `CLAUDE.md` and `docs/spikes/README.md`, then run the spike in `docs/spikes/0N-….md`.

Cleanup after merging: `git worktree remove ../rg-spike-0N`.

Wrangler's login is stored per machine, so one `pnpm dlx wrangler login` covers every session.

## Rules for every spike

- **Location:** code goes in `spikes/<NN-name>/` as its own small pnpm package (`pnpm init`,
  `pnpm add -D wrangler`, …). It's throwaway: optimise for answering the question, not for code quality.
- **Secrets:** go in `spikes/<NN-name>/.dev.vars` or `pnpm wrangler secret put`, never in code, logs,
  commits or the findings. `.dev.vars` and `.env*` are already git-ignored. Use **only the dummy
  piugame account**, never a real player's.
- **Never disable TLS verification**, not even "just to see".
- **Deployed Workers** are named `rg-spike-<NN>`. Delete them when done (`pnpm wrangler delete`).
- **Be gentle with piugame.com:** sequential requests, at least 250 ms apart, no more than ~50
  requests per run.
- **Report:** fill in the **Findings** section of the brief (what you ran, raw results, the answer,
  the recommendation, follow-ups), then open a PR from the spike branch. If the answer changes the
  plan, say exactly which lines of `ARCHITECTURE.md` / `DATA-SOURCES.md` should change. Don't edit
  them in the spike PR.
- Saved HTML from piugame.com is useful for parser tests. Scrub the account name, game tag and
  avatar URL before committing any of it.
