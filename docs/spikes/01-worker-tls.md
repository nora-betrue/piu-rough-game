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

_To be filled in by the spike._
