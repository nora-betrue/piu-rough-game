# Spike 1: Worker → piugame.com TLS

## Question

piugame.com serves only its leaf certificate and leaves out the *Sectigo Public Server
Authentication CA DV R36* intermediate (`DATA-SOURCES.md` §1). Node and curl reject it, while browsers
fetch the missing cert themselves. A Worker's `fetch()` can't be given extra CA certs.
**Does `fetch()` from a deployed Cloudflare Worker succeed against piugame.com anyway?**

If not, the scraper needs another runtime: most likely a Cloudflare Container running Node with
`NODE_EXTRA_CA_CERTS`.

## Background

- Missing intermediate: `http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt` (DER),
  SHA-256 `8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0`.
- Hosts involved in an import: `https://piugame.com` (Phoenix 2), `https://am-pass.net` (SSO).
  `https://phoenix.piugame.com` (Phoenix 1) is useful as a comparison.
- `wrangler dev` runs workerd **locally**, and its TLS behaviour may differ from Cloudflare's edge. Only
  a **deployed** Worker (or `wrangler dev --remote`) answers the question.

## Steps

1. `spikes/01-worker-tls/`: a minimal Worker (`rg-spike-01`) whose `GET /` fetches each host with
   `redirect: "manual"` and returns JSON: `{url, ok, status, location?, error?: {name, message}}`.
   Catch and report every error; don't let it throw.
2. Run it with `pnpm wrangler dev` (local) **and** deployed (`pnpm wrangler deploy`, then curl the
   `workers.dev` URL). Record both.
3. Also fetch a static asset (`https://piugame.com/l_img/p2/grade/sss_p.png`) and report its
   `content-type` and byte length. The asset-sync job needs this.
4. Repeat the deployed check 3 times a few minutes apart, to rule out a flaky edge.
5. **If the deployed Worker fails:**
   1. Check whether Cloudflare Containers are available on the account and what they cost.
   2. Build the smallest container (Node 22, the intermediate PEM, `NODE_EXTRA_CA_CERTS`)
      that fetches the same URLs, and call it from a Worker.
   3. Record the deploy steps, cold start, and the per-request latency added.
   4. If Containers aren't viable, list the alternatives with costs (a small VPS, Fly.io, etc.).
6. Delete the Worker (and container) afterwards.

## Done when

You can state with evidence: "A Worker **can / cannot** fetch piugame.com and am-pass.net", plus
the recommended scraper runtime and its cost.

## Findings

Checked 2026-10-26. Code: `spikes/01-worker-tls/`. Raw JSON: `spikes/01-worker-tls/results/`.

### Answer

**A deployed Worker can fetch piugame.com, phoenix.piugame.com and am-pass.net**, and it still
verifies certificates. The Cloudflare edge completes the missing Sectigo DV R36 intermediate itself,
as a browser does. **Local `wrangler dev` cannot**: workerd on this machine rejects the chain. No
container is needed, so step 5 (Containers) was skipped.

### What I ran

1. **Baseline from this machine** (curl, system CA store). `piugame.com` and `phoenix.piugame.com`
   fail with `(60) unable to get local issuer certificate`. `openssl s_client` shows a single cert
   (`*.piugame.com`, issuer `Sectigo Public Server Authentication CA DV R36`). `am-pass.net` is
   correctly chained (Let's Encrypt `YR1` → `Root YR` → ISRG Root X1) and returns a verified `302`.
   The piugame hosts resolve to AWS addresses (99.83.255.217, 3.35.110.110), not Cloudflare.
2. **Worker `rg-spike-01`**: `GET /` fetches each URL in sequence (300 ms apart, `redirect: "manual"`)
   and reports `{url, ok, status, location, contentType, ms, error?}`. The asset is also read and
   hashed. Controls: `example.com` (good chain), `incomplete-chain.badssl.com` (same problem as
   piugame), and four **negative controls** that must fail: `self-signed`, `untrusted-root`,
   `expired` and `wrong.host` on badssl.com. The negative controls were added after run 1 so that
   "the edge completes the chain" can be told apart from "the edge doesn't verify at all".
3. Local `pnpm wrangler dev` once (wrangler 4.152.0, workerd 1.20261019.1), then
   `pnpm wrangler deploy` and 4 deployed runs from colo FRA over ~9 minutes
   (20:24, 20:25, 20:29, 20:33 UTC).

About 20 requests to piugame hosts in total.

### Raw results

| URL | `wrangler dev` (local) | Deployed, runs 1–4 |
|---|---|---|
| `https://piugame.com/` | ❌ `TLS handshake failed: invalid peer certificate: UnknownIssuer` | ✅ `302` → `api.am-pass.net/sso?referer=…` (1.1–2.3 s) |
| `https://am-pass.net/` | ✅ `302` | ✅ `302` → `api.am-pass.net/sso?referer=…` (2.0–2.7 s) |
| `https://phoenix.piugame.com/` | ❌ `UnknownIssuer` | ✅ `302` → `api.am-pass.net/sso?referer=…` (1.3–2.2 s) |
| `https://example.com/` | ✅ `200` | ✅ `200` |
| `https://incomplete-chain.badssl.com/` | ❌ `UnknownIssuer` | ✅ `200` |
| `self-signed` / `untrusted-root` / `expired` / `wrong.host` badssl | not run | ✅ rejected: `526` on all four, runs 2–4 |
| `https://piugame.com/l_img/p2/grade/sss_p.png` | ❌ `UnknownIssuer` | ✅ `200`, `content-type: image/png`, **28,815 bytes**, SHA-256 `65baa9f2…bd98994`, identical in all 4 runs |

In the local run, `fetch()` throws `Error: internal error; reference = …`. The real reason
(`UnknownIssuer`) appears only in the wrangler log.

### Things the scraper must know

- **A failed certificate check comes back as an HTTP `526` response, not a thrown error.** On the
  edge, `fetch()` resolves normally. The scraper must treat `525`/`526` as a TLS failure (fail the
  job loudly, never retry as if it were a transient 5xx, and never parse the body as a page).
- **Local dev can't reach piugame.com.** Use `wrangler dev --remote` for live checks. Otherwise
  test against saved HTML fixtures (spike 2 produces these). Don't "fix" local dev by disabling
  verification.
- **Static assets are edge-cached.** The PNG took 1.8 s on run 1 and 5–16 ms afterwards. That's
  good for the asset-sync job, but it should send `cache: "no-store"` (or a cache-busting check)
  when it needs to detect changed art.
- The edge's chain completion is **observed behaviour**. I didn't find it documented, and Cloudflare
  could change it. It's also why `incomplete-chain.badssl.com` passes, so the same behaviour covers
  any similar host.

### Recommendation

- **Scraper runtime: a plain Worker** (the jobs Worker queue consumer), on Workers Paid at **$5/month,
  already budgeted**. No Container, VPS or extra cost.
- Keep the Container plan only as a documented fallback. Don't build it.
- Add a cheap canary: the daily auto-scan cron does one `GET https://piugame.com/` first. If it gets
  `526`/`525`, it pauses imports and alerts, so a Cloudflare change shows up as a clear error, not as
  broken imports.

### Doc changes this implies (not made in this PR)

- `ARCHITECTURE.md` line 32: `piugame scraper (or Container, see Spikes)` → `piugame scraper`.
- `ARCHITECTURE.md` lines 36–37: drop "(and Containers only if the TLS spike needs them)".
- `ARCHITECTURE.md` lines 282–284 (Spikes §1): mark it answered. The Worker works because the edge
  completes the chain; local `wrangler dev` doesn't.
- `ARCHITECTURE.md` line 297: remove the Containers cost row. The total becomes ~$5–7.
- `DATA-SOURCES.md` lines 78–81 ("Open risk for Cloudflare Workers"): replace it with the result
  (deployed Workers complete the chain and still verify; local workerd rejects it; edge TLS errors
  arrive as `526`). Keep lines 63–76: the PEM / `NODE_EXTRA_CA_CERTS` fix is still right for Node
  scripts and tests.
- `CLAUDE.md` lines 54–55: say that the `NODE_EXTRA_CA_CERTS` fix applies to Node tooling only, and
  that deployed Workers need nothing extra.

### Follow-ups

- Spike 2 should run its login flow on the deployed Worker, since TLS is no longer a blocker there.
- Implement the canary and the `526` handling when the scraper is built.
- Optional: rerun from another colo. All 4 runs here hit FRA. The production canary covers this
  over time anyway.
