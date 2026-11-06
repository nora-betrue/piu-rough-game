// Node runner. Usage (from this folder):
//   NODE_EXTRA_CA_CERTS=certs/sectigo-dv-r36.pem node node.ts login           # full flow, saves sid state
//   NODE_EXTRA_CA_CERTS=certs/sectigo-dv-r36.pem node node.ts reuse <label>   # re-use the saved sid only
//   NODE_EXTRA_CA_CERTS=certs/sectigo-dv-r36.pem node node.ts wrong-password  # once only
//   RAW_DIR=… NODE_EXTRA_CA_CERTS=… node node.ts capture          # 1 login + read-only score pages
//   RAW_DIR=… NODE_EXTRA_CA_CERTS=… node node.ts capture-rest [n] # rest of the pages on capture's sid, no login
// Raw (unscrubbed) HTML goes to $RAW_DIR, which must be outside the repo. Results go to results/.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { BASE, PoliteClient, fetchPages, login, summarise, type Hop } from "./login.ts";

const SID_STATE = ".sid-state.json"; // git-ignored, mode 600
const mode = process.argv[2];
process.loadEnvFile(".dev.vars");
const { PIU_ID, PIU_PASSWORD } = process.env;
if (!PIU_ID || !PIU_PASSWORD) throw new Error("PIU_ID / PIU_PASSWORD missing from .dev.vars");

const printHop = (h: Hop) =>
  console.log(
    `#${h.n} [${h.step}] ${h.method} ${h.url} -> ${h.status ?? "ERR"} ${h.ms}ms` +
      (h.location ? ` location=${h.location}` : "") +
      (h.setCookies.length ? ` set-cookie=[${h.setCookies.join(", ")}]` : "") +
      (h.error ? ` error=${h.error}` : ""),
  );

function save(name: string, data: unknown) {
  mkdirSync("results", { recursive: true });
  const json = JSON.stringify(data, null, 2);
  const local = PIU_ID!.split("@")[0];
  if (json.includes(PIU_ID!) || json.includes(PIU_PASSWORD!) || json.includes(local)) throw new Error(`refusing to save ${name}: contains a credential`);
  writeFileSync(`results/${name}.json`, json + "\n");
}

/** Like PIU Scores' ClientForSid: a fresh client that holds only the sid cookie. */
function clientFromSavedSid() {
  const state = JSON.parse(readFileSync(SID_STATE, "utf8")) as { name: string; value: string; obtainedAt: string };
  const client = new PoliteClient(printHop);
  client.jar.cookies.push({ name: state.name, value: state.value, domain: "piugame.com", hostOnly: true });
  return { client, obtainedAt: state.obtainedAt };
}

const started = new Date().toISOString();

if (mode === "login") {
  const rawDir = process.env.RAW_DIR;
  if (!rawDir) throw new Error("set RAW_DIR to a folder outside the repo");
  mkdirSync(rawDir, { recursive: true });
  const client = new PoliteClient(printHop);
  const result = await login(client, PIU_ID, PIU_PASSWORD);
  console.log("login:", result);
  const sid = client.jar.find("sid");
  if (sid && !result.rejected) {
    writeFileSync(SID_STATE, JSON.stringify({ name: sid.name, value: sid.value, obtainedAt: started }));
    chmodSync(SID_STATE, 0o600);
  }
  const pages = await fetchPages(client);
  pages.forEach((p, i) => writeFileSync(`${rawDir}/${i + 1}-${p.summary.path.split("/")[2].split(".")[0]}.html`, p.html));
  console.table(pages.map((p) => p.summary));
  save("node-login", { runtime: `node ${process.version}`, started, requests: client.requests, result, pages: pages.map((p) => p.summary), hops: client.hops });
} else if (mode === "capture") {
  // One login on an account WITH a game card, read-only GETs only, raw HTML to RAW_DIR (outside
  // the repo). Never touches .sid-state.json (that holds the dummy account's sid for the 1 h / 24 h
  // checks). The sid is kept in RAW_DIR only, so the secret grep can look for it; delete RAW_DIR after.
  const rawDir = process.env.RAW_DIR;
  if (!rawDir) throw new Error("set RAW_DIR to a folder outside the repo");
  mkdirSync(rawDir, { recursive: true, mode: 0o700 });
  const client = new PoliteClient(printHop, 20);
  const result = await login(client, PIU_ID, PIU_PASSWORD);
  console.log("login: rejected=%s postStatus=%s hint=%s", result.rejected, result.postStatus, result.postBodyHint);
  const pages: { summary: ReturnType<typeof summarise>; file: string }[] = [];
  const get = async (path: string, file: string) => {
    const r = await client.request(`5 ${path}`, "GET", `${BASE}${path}`);
    writeFileSync(`${rawDir}/${file}.html`, r.html, { mode: 0o600 });
    const summary = summarise(path, r);
    pages.push({ summary, file });
    console.log(file, JSON.stringify({ status: summary.status, isMember: summary.isMember, loginForm: summary.loginForm, alert: summary.alert, layout: summary.bestScoreLayout }));
    return r.html;
  };
  if (!result.rejected) {
    const best1 = await get("/my_page/my_best_score.php?&&page=1", "best-p1");
    const first = pages[0].summary;
    if (first.isMember && !first.loginForm && !first.alert) {
      // Max page: the onclick of i.last's parent (PiuGameApi.cs ParseBestScoresMaxPage).
      const maxPage = Number(best1.match(/onclick="[^"]*page=(\d+)[^"]*"[^>]*>\s*<i[^>]*class="[^"]*\blast\b/)?.[1] ?? 0)
        || Math.max(1, ...[...best1.matchAll(/page=(\d+)/g)].map((m) => Number(m[1])));
      const buckets = [...(best1.match(/<select[^>]*onchange="[^"]*lv=[\s\S]*?<\/select>/)?.[0] ?? "").matchAll(/<option[^>]*value="([^"]*)"/g)]
        .map((m) => m[1]).filter(Boolean);
      console.log("best list: maxPage=%d lv buckets=%j", maxPage, buckets);
      if (maxPage >= 2) await get("/my_page/my_best_score.php?&&page=2", "best-p2");
      const lv = buckets.find((b) => b === "20") ?? buckets[Math.floor(buckets.length / 2)];
      if (lv) await get(`/my_page/my_best_score.php?lv=${encodeURIComponent(lv)}&&page=1`, `best-lv${lv}-p1`);
      await get("/my_page/recently_played.php", "recently_played");
      await get("/my_page/play_data.php", "play_data");
      await get("/my_page/pumbility.php", "pumbility");
      await get("/my_page/title.php", "title");
    }
    const sid = client.jar.cookies.find((c) => c.name === "sid" && c.domain === "piugame.com");
    if (sid) writeFileSync(`${rawDir}/real-sid-state.json`, JSON.stringify({ value: sid.value }), { mode: 0o600 });
  }
  save("node-capture", { runtime: `node ${process.version}`, started, requests: client.requests, result, pages: pages.map((p) => ({ file: p.file, ...p.summary })), hops: client.hops });
  console.log("requests:", client.requests);
} else if (mode === "capture-rest") {
  // Continuation of "capture" WITHOUT a new login: reuses the sid saved in RAW_DIR (the first run
  // stopped after page 1 because an inline alert() was misread as an error page).
  const rawDir = process.env.RAW_DIR;
  if (!rawDir) throw new Error("set RAW_DIR");
  const budget = Number(process.argv[3] ?? 7);
  const client = new PoliteClient(printHop, budget);
  const { value } = JSON.parse(readFileSync(`${rawDir}/real-sid-state.json`, "utf8"));
  client.jar.cookies.push({ name: "sid", value, domain: "piugame.com", hostOnly: true });
  const best1 = readFileSync(`${rawDir}/best-p1.html`, "utf8");
  const maxPage = Number(best1.match(/onclick="[^"]*page=(\d+)[^"]*"[^>]*>\s*<i[^>]*class="[^"]*\blast\b/)?.[1] ?? 0)
    || Math.max(1, ...[...best1.matchAll(/page=(\d+)/g)].map((m) => Number(m[1])));
  const buckets = [...(best1.match(/<select[^>]*onchange="[^"]*lv=[\s\S]*?<\/select>/)?.[0] ?? "").matchAll(/<option[^>]*value="([^"]*)"/g)]
    .map((m) => m[1]).filter(Boolean);
  console.log("best list: maxPage=%d lv buckets=%j", maxPage, buckets);
  const pages: Record<string, unknown>[] = [{ file: "best-p1", ...summarise("/my_page/my_best_score.php?&&page=1", { status: 200, finalUrl: `${BASE}/my_page/my_best_score.php?&&page=1`, html: best1 }) }];
  const get = async (path: string, file: string) => {
    const r = await client.request(`5 ${path}`, "GET", `${BASE}${path}`);
    writeFileSync(`${rawDir}/${file}.html`, r.html, { mode: 0o600 });
    const summary = summarise(path, r);
    pages.push({ file, ...summary });
    console.log(file, JSON.stringify({ status: summary.status, isMember: summary.isMember, loginForm: summary.loginForm, alert: summary.alert, layout: summary.bestScoreLayout }));
    if (summary.loginPage || summary.alert) throw new Error(`stopping: ${file} is not a data page`);
  };
  try {
    if (maxPage >= 2) await get("/my_page/my_best_score.php?&&page=2", "best-p2");
    const lv = buckets.find((b) => b === "20") ?? buckets[Math.floor(buckets.length / 2)];
    if (lv) await get(`/my_page/my_best_score.php?lv=${encodeURIComponent(lv)}&&page=1`, `best-lv${lv}-p1`);
    await get("/my_page/recently_played.php", "recently_played");
    await get("/my_page/play_data.php", "play_data");
    await get("/my_page/pumbility.php", "pumbility");
    await get("/my_page/title.php", "title");
  } finally {
    save("node-capture-rest", { runtime: `node ${process.version}`, started, requests: client.requests, maxPage, buckets, pages, hops: client.hops });
    console.log("requests:", client.requests);
  }
} else if (mode === "reuse") {
  const label = process.argv[3] ?? "adhoc";
  if (!existsSync(SID_STATE)) throw new Error(`no ${SID_STATE}: run "login" first`);
  const { client, obtainedAt } = clientFromSavedSid();
  const ageMinutes = Math.round((Date.now() - Date.parse(obtainedAt)) / 60000);
  const pages = await fetchPages(client, ["/my_page/title.php"]);
  const summary = pages[0].summary;
  // The dummy account has no Game ID yet, so title.php is gnuboard's "No registered Game ID found."
  // error page. g5_is_member="1" on it still proves the sid is a logged-in session.
  const valid = !summary.loginPage && summary.status === 200;
  console.log(`sid age ${ageMinutes} min -> ${valid ? "VALID" : "NOT VALID"}`, summary);
  save(`node-reuse-${label}`, { runtime: `node ${process.version}`, started, obtainedAt, ageMinutes, valid, cookieNamesAfter: client.jar.names(), page: summary, hops: client.hops });
} else if (mode === "wrong-password") {
  const marker = "results/.wrong-password-attempted";
  if (existsSync(marker)) throw new Error("already ran once; not repeating (account lockout risk)");
  mkdirSync("results", { recursive: true });
  writeFileSync(marker, started + "\n");
  const client = new PoliteClient(printHop);
  const wrong = `rg-spike-02-wrong-${Math.random().toString(36).slice(2)}`;
  const result = await login(client, PIU_ID, wrong);
  console.log("login:", result);
  const r = await client.request("5 /my_page/title.php", "GET", `${BASE}/my_page/title.php`);
  const page = summarise("/my_page/title.php", r);
  console.log(page);
  save("node-wrong-password", { runtime: `node ${process.version}`, started, requests: client.requests, result, page, hops: client.hops });
} else {
  console.error("usage: node node.ts login | reuse <label> | wrong-password");
  process.exit(2);
}
