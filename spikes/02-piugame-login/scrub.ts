// Scrubs raw piugame pages into parser fixtures. Usage (from this folder):
//   node scrub.ts <RAW_DIR> fixtures/with-game-id
// Reads identifying values out of the raw pages themselves (and the account id from .dev.vars),
// replaces them everywhere (markup, inline JS, hidden inputs, URLs), and refuses to write a
// fixture that still contains any of them. Prints counts only, never the values. The values are
// written to <RAW_DIR>/secrets.json (mode 600) so the repo-wide grep can use them; delete RAW_DIR after.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const [rawDir, outDir] = process.argv.slice(2);
if (!rawDir || !outDir) throw new Error("usage: node scrub.ts <RAW_DIR> <outDir>");
process.loadEnvFile(".dev.vars");
const id = process.env.PIU_ID ?? "";
const files = readdirSync(rawDir).filter((f) => f.endsWith(".html"));
const all = files.map((f) => readFileSync(`${rawDir}/${f}`, "utf8")).join("\n");

const literal = new Set<string>(); // replaced wherever they appear (case-insensitive)
const add = (v: string | undefined) => {
  const t = v?.trim();
  if (t && t.length >= 3) literal.add(t);
};
add(id);
add(id.split("@")[0]);
for (const m of all.matchAll(/Hello!\s*([^<]*?)\s*<\/p>/g)) add(m[1]);
for (const m of all.matchAll(/id="hd_login_msg">\s*([^<]*?)님/g)) add(m[1]);
// Profile names / game IDs: every .t2 inside a .name_w block (main profile, modal, sub-profiles).
for (const block of all.matchAll(/<div class="name_w[^"]*">[\s\S]*?<\/div>/g))
  for (const m of block[0].matchAll(/class="t2[^"]*">\s*([^<]*?)\s*</g)) {
    add(m[1]);
    for (const part of m[1].split("#")) if (!/^\s*\d+\s*$/.test(part)) add(part); // the name on its own; tags handled below
  }
const tags = new Set([...all.matchAll(/#\s?(\d{4})\b/g)].map((m) => m[1]).filter((t) => [...literal].some((l) => l.includes(t))));
const hidden = ["origin_game_id", "user_no", "sub_profile", "game_id", "mb_id", "mb_no"];
for (const name of hidden) {
  // Short numeric ids (sub_profile) are replaced by attribute only: globally they'd hit score digits.
  const addId = (v: string) => (/^\d{1,6}$/.test(v) ? undefined : add(v));
  for (const m of all.matchAll(new RegExp(`name="${name}"[^>]*value="([^"]*)"`, "g"))) addId(m[1]);
  for (const m of all.matchAll(new RegExp(`value="([^"]*)"[^>]*name="${name}"`, "g"))) addId(m[1]);
}
const avatars = new Set([...all.matchAll(/https?:\/\/[^'"\s)]*\/data\/avatar_img2?\/[^'"\s)]+/g)].map((m) => m[0]));

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Longest first, so "NAME #1234" goes before "NAME".
const ordered = [...literal].sort((a, b) => b.length - a.length);

function scrub(html: string): string {
  let out = html;
  for (const a of avatars) out = out.split(a).join("https://piugame.com/data/avatar_img2/scrubbed.png?v=0");
  out = out.replace(/(name="(?:origin_game_id|user_no|sub_profile|mb_id|mb_no)"[^>]*value=")[^"]*/g, "$1SCRUBBED");
  out = out.replace(/(value=")[^"]*("[^>]*name="(?:origin_game_id|user_no|sub_profile|mb_id|mb_no)")/g, "$1SCRUBBED$2");
  // "Last Access Date : …" / "Recently Access Games : …" on the profile cards.
  out = out.replace(/(<i class="tt">\s*(?:Last Access Date|Recently Access Games)\s*:)[^<]*/g, "$1 SCRUBBED");
  for (const v of ordered) out = out.replace(new RegExp(esc(v), "gi"), "SCRUBBED_NAME");
  for (const t of tags) out = out.replace(new RegExp(`#(\\s?)${t}\\b`, "g"), "#$10000");
  return out;
}

mkdirSync(outDir, { recursive: true });
const secrets = [...ordered, ...[...tags].map((t) => `#${t}`), ...avatars];
for (const f of files) {
  if (f === "secrets.json") continue;
  const out = scrub(readFileSync(`${rawDir}/${f}`, "utf8"));
  const lower = out.toLowerCase();
  const left = secrets.filter((s) => lower.includes(s.toLowerCase())).length;
  if (left) throw new Error(`${f}: ${left} identifying value(s) survived scrubbing; not writing it`);
  writeFileSync(`${outDir}/${f}`, out);
  console.log(`${f}: scrubbed (${out.split("SCRUBBED").length - 1} replacements)`);
}
writeFileSync(`${rawDir}/secrets.json`, JSON.stringify({ literals: ordered, tags: [...tags], avatars: [...avatars] }), { mode: 0o600 });
console.log(`identifying values: ${ordered.length} literals, ${tags.size} tags, ${avatars.size} avatar URLs`);
