// Node runner. Usage (from this folder):
//   NODE_EXTRA_CA_CERTS=certs/sectigo-dv-r36.pem node node.ts login           # full flow, saves sid state
//   NODE_EXTRA_CA_CERTS=certs/sectigo-dv-r36.pem node node.ts reuse <label>   # re-use the saved sid only
//   NODE_EXTRA_CA_CERTS=certs/sectigo-dv-r36.pem node node.ts wrong-password  # once only
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
