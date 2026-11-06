#!/usr/bin/env bash
# Deploys a Worker, then sends 1 cold + N warm requests per config. CPU times come from `wrangler tail`.
#   scripts/measure.sh <wrangler config> <worker url> <warm count> <query>...
set -euo pipefail
cfg=$1 url=$2 warm=$3; shift 3
for q in "$@"; do
	pnpm wrangler deploy -c "$cfg" >/dev/null 2>&1   # new version → fresh isolate for the cold request
	for i in $(seq 0 "$warm"); do
		curl -s -o /dev/null -w "$q #$i %{http_code} wall=%{time_total}s bytes=%{size_download}\n" "$url/top50.png?$q"
	done
done
