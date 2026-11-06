// Runs PIU Scores' PiuGameApi.cs selectors (ported to cheerio, XPath `contains(@class,…)` as
// `[class*=…]`) against the scrubbed fixtures and reports which still match.
// Usage (from this folder): node check-parsers.ts [fixtures/with-game-id]
// Prints counts and a few parsed rows (song/chart/score data only; fixtures carry no personal data).
import { readFileSync } from "node:fs";
import * as cheerio from "cheerio";

const dir = process.argv[2] ?? "fixtures/with-game-id";
const load = (f: string) => cheerio.load(readFileSync(`${dir}/${f}`, "utf8"));
const checks: { page: string; selector: string; ok: boolean; note: string }[] = [];
const check = (page: string, selector: string, ok: boolean, note = "") => checks.push({ page, selector, ok, note });

// Regexes copied from PiuGameApi.cs.
const LevelRegex = /^https:\/\/(?:phoenix\.)?piugame\.com\/l_img\/(?:p2\/)?stepball\/full\/[a-zA-Z]_num_([0-9])\.png$/;
const TypeRegex = /^https:\/\/(?:phoenix\.)?piugame\.com\/l_img\/(?:p2\/)?stepball\/full\/([a-zA-Z])_text\.png$/;
const ShortTypeRegex = /\/stepball\/full\/([a-zA-Z]+)_bg\.png/;
const ShortLevelRegex = /\/stepball\/full\/[a-zA-Z]+_num_([0-9])\.png/g;
const PlateRegex = /\/plate\/([a-zA-Z]+)\.png/;
const PlateImageRegex = /\/plate\/(?:s_)?([a-zA-Z]+)\.png/;
const GradeImageRegex = /\/grade\/([a-z_]+)\.png/i;
const RecordedAtRegex = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s*\(GMT([+-]\d{1,2})\)/;
const CountRegex = /\d[\d,]*/;
const DecimalRegex = /\d[\d,]*(?:\.\d+)?/;
const PumbilityValueRegex = /class="in score".*?>\s*([0-9,]+)<span class="pumbility-point-sub">\.(\d+)<\/span>/s;
const ImageRegex = /url\('(https:\/\/(?:phoenix\.)?piugame\.com\/data\/(avatar|song)_img2?\/[A-Za-z0-9]+\.[A-Za-z]+\?v=[0-9]+)'\)/;

const chartType = (url: string) => {
  const m = url.match(TypeRegex);
  if (!m) return "SP?"; // PiuGameApi falls back to SinglePerformance when the regex misses
  return ({ c: "CoOp", s: "S", d: "D" } as Record<string, string>)[m[1].toLowerCase()] ?? null;
};
const levelFrom = (urls: string[]) => {
  let level = 0;
  for (const u of urls) {
    level *= 10;
    const m = u.match(LevelRegex);
    if (m) level += Number(m[1]);
  }
  return level === 0 ? 29 : level;
};
const date = (t: string | undefined) => {
  const m = t?.match(RecordedAtRegex);
  return m ? `${m[1]} GMT${m[2]}` : null;
};
type Card = ReturnType<cheerio.CheerioAPI>;
const cardChart = ($: cheerio.CheerioAPI, card: Card) => {
  const typeUrl = card.find("div[class*=stepBall_img_wrap] div[class*=tw] img").first().attr("src") ?? "";
  const levelUrls = card.find("div[class*=stepBall_img_wrap] div[class*=numw] img").map((_, i) => $(i).attr("src") ?? "").get();
  return { typeUrl, type: chartType(typeUrl), typeRegexHit: TypeRegex.test(typeUrl), levelUrls, level: levelFrom(levelUrls) };
};

// ---------- my_best_score.php ----------
for (const f of ["best-p1.html", "best-p2.html", "best-lv20-p1.html"]) {
  const $ = load(f);
  const classic = $("ul[class*=my_best_scoreList]").length > 0;
  const cards = $("ul[class*=recently_playeList] > li");
  check(f, "ul.my_best_scoreList (classic)", classic, classic ? "" : "absent: page uses the redesign");
  check(f, "ul.recently_playeList > li (redesign cards)", cards.length > 0, `${cards.length} cards`);
  const total = $("[class*=total_wrap]").first().text().match(CountRegex)?.[0];
  check(f, ".total_wrap → Total", !!total, `Total=${total}`);
  const onclick = $("i[class*=last]").first().parent().attr("onclick") ?? "";
  const maxPage = onclick ? Number(onclick.split("=").at(-1)!.replace(/'+$/, "")) : NaN;
  check(f, "i.last parent onclick → max page", Number.isFinite(maxPage), `maxPage=${maxPage}`);
  const rows = cards.map((_, el) => {
    const card = $(el);
    const c = cardChart($, card);
    const scoreText = card.find("div[class*=li_in][class*=ac] > i[class*=tx]").first().text();
    const plate = card.find("div[class*=li_in] > img").map((_, i) => $(i).attr("src") ?? "").get().map((s) => s.match(PlateRegex)?.[1]).find(Boolean);
    const grade = card.find("div[class*=li_in] > img").map((_, i) => $(i).attr("src") ?? "").get().map((s) => s.match(GradeImageRegex)?.[1]).find(Boolean);
    return {
      song: card.find("div[class*=song_name] > p").first().text(),
      ucs: c.typeUrl.toLowerCase().includes("u_text"),
      type: c.type, typeRegexHit: c.typeRegexHit, level: c.level, levelImgs: c.levelUrls.length,
      score: scoreText ? Number(scoreText.replace(/,/g, "")) : null,
      grade: grade ?? null, plate: plate ?? null, broken: !plate,
      date: date(card.find("p[class*=recently_date_tt]").first().text()),
    };
  }).get();
  const n = rows.length;
  check(f, "div.song_name > p", rows.every((r) => r.song), `${rows.filter((r) => r.song).length}/${n}`);
  check(f, ".tw img src ~ TypeRegex", rows.every((r) => r.typeRegexHit || r.ucs), `${rows.filter((r) => r.typeRegexHit).length}/${n}`);
  check(f, ".numw img src ~ LevelRegex", rows.every((r) => r.levelImgs > 0), `levels ${[...new Set(rows.map((r) => r.level))].join(",")}`);
  check(f, "div.li_in.ac > i.tx → score", rows.every((r) => Number.isFinite(r.score)), `${rows.filter((r) => Number.isFinite(r.score)).length}/${n}`);
  check(f, "div.li_in > img ~ PlateRegex", rows.some((r) => r.plate), `${rows.filter((r) => r.plate).length}/${n} with plate`);
  check(f, "p.recently_date_tt ~ RecordedAtRegex", rows.every((r) => r.date), `${rows.filter((r) => r.date).length}/${n}`);
  console.log(`\n${f}: layout=${classic ? "classic" : "redesign"} cards=${n} Total=${total} maxPage=${maxPage}`);
  console.table(rows.slice(0, 4));
}

// ---------- recently_played.php ----------
{
  const f = "recently_played.html";
  const $ = load(f);
  const cards = $("ul[class*=recently_playeList] > li");
  check(f, "ul.recently_playeList > li", cards.length > 0, `${cards.length} cards`);
  let stageBreaks = 0;
  const rows: Record<string, unknown>[] = [];
  cards.each((_, el) => {
    const card = $(el);
    const txs = card.find("div[class*=li_in] > i[class*=tx]").map((_, i) => $(i).text()).get();
    if (txs.some((t) => t === "STAGE BREAK")) { stageBreaks++; return; }
    const c = cardChart($, card);
    const imgs = card.find("div[class*=li_in] > img").map((_, i) => $(i).attr("src") ?? "").get();
    const j = (k: string) => {
      const t = card.find(`td[data-th*=${k}] > div`).first().text();
      return t === "" ? null : Number(t.replace(/,/g, ""));
    };
    rows.push({
      song: card.find("div[class*=song_name] > p").first().text(),
      type: c.type, level: c.level,
      score: Number((txs[0] ?? "").replace(/,/g, "")),
      broken: !imgs.some((s) => s.includes("/plate/")),
      plateImg: imgs.map((s) => s.match(PlateRegex)?.[1]).find(Boolean) ?? null,
      P: j("PERFECT"), Gr: j("GREAT"), Go: j("GOOD"), B: j("BAD"), M: j("MISS"),
      date: date(card.find("p[class*=recently_date_tt]").first().text()),
    });
  });
  const ok = (k: string) => rows.filter((r) => Number.isFinite(r[k] as number)).length;
  check(f, "STAGE BREAK text in div.li_in > i.tx", true, `${stageBreaks} stage breaks skipped`);
  check(f, "td[data-th=PERFECT|GREAT|GOOD|BAD|MISS] > div", ["P", "Gr", "Go", "B", "M"].every((k) => ok(k) === rows.length), `${ok("P")}/${rows.length}`);
  check(f, "broken = no /plate/ img in div.li_in", true, `${rows.filter((r) => r.broken).length} broken, ${rows.filter((r) => !r.broken).length} passed`);
  check(f, "div.li_in.ac > i.tx → score (first li_in i.tx)", rows.every((r) => Number.isFinite(r.score as number)), `${rows.filter((r) => Number.isFinite(r.score as number)).length}/${rows.length}`);
  check(f, "p.recently_date_tt ~ RecordedAtRegex", rows.every((r) => r.date), `${rows.filter((r) => r.date).length}/${rows.length}`);
  check(f, "plate image on recent cards (PiuGameApi derives it instead)", rows.some((r) => r.plateImg), `${rows.filter((r) => r.plateImg).length}/${rows.length} cards carry a plate image`);
  console.log(`\n${f}: cards=${cards.length} parsed=${rows.length} stageBreaks=${stageBreaks}`);
  console.table(rows.slice(0, 5));
}

// ---------- pumbility.php ----------
{
  const f = "pumbility.html";
  const html = readFileSync(`${dir}/${f}`, "utf8");
  const $ = cheerio.load(html);
  const totalText = $("div[class*=pumbility_total_wrap]").first().text();
  const total = totalText.match(DecimalRegex)?.[0];
  check(f, "div.pumbility_total_wrap → total", !!total, `total=${total} (text: ${totalText.replace(/\s+/g, " ").trim().slice(0, 60)})`);
  const cards = $("li").filter((_, el) => $(el).children("div[class*=top-wrap]").length > 0);
  const rowsFallback = $("div[class*=pumblitiySt] ul[class*=list] > li");
  check(f, "li[div.top-wrap] (Phoenix 2 cards)", cards.length > 0, `${cards.length} cards; classic rows fallback: ${rowsFallback.length}`);
  const rows = cards.map((_, el) => {
    const inner = $(el).html() ?? "";
    const value = inner.match(PumbilityValueRegex);
    const label = $(el).find("div[class*=mid-wrap]").first().text().trim().replace(/\s+/g, " ");
    const sep = label.lastIndexOf(" - ");
    return {
      song: sep <= 0 ? label : label.slice(0, sep).trim(),
      type: inner.match(ShortTypeRegex)?.[1] ?? null,
      level: (() => { const d = [...inner.matchAll(ShortLevelRegex)].map((m) => m[1]).join(""); return d ? Number(d) : 29; })(),
      grade: inner.match(GradeImageRegex)?.[1] ?? null,
      plate: inner.match(PlateImageRegex)?.[1] ?? null,
      value: value ? Number(value[1].replace(/,/g, "") + "." + value[2]) : null,
    };
  }).get();
  check(f, "PumbilityValueRegex (in score … pumbility-point-sub)", rows.every((r) => r.value !== null), `${rows.filter((r) => r.value !== null).length}/${rows.length}`);
  check(f, "ShortTypeRegex (_bg.png)", rows.every((r) => r.type), `${rows.filter((r) => r.type).length}/${rows.length}`);
  check(f, "div.mid-wrap → song", rows.every((r) => r.song), `${rows.filter((r) => r.song).length}/${rows.length}`);
  check(f, "GradeImageRegex / PlateImageRegex", rows.every((r) => r.grade && r.plate), `grade ${rows.filter((r) => r.grade).length}, plate ${rows.filter((r) => r.plate).length} of ${rows.length}`);
  const sum = rows.reduce((a, r) => a + (r.value ?? 0), 0);
  console.log(`\n${f}: total=${total} cards=${rows.length} sum(values)=${sum.toFixed(2)}`);
  console.table(rows.slice(0, 5));
}

// ---------- play_data.php ----------
{
  const f = "play_data.html";
  const $ = load(f);
  const tiles = $("a[class*=play_log_btn]").filter((_, el) => $(el).find("i[class*=t_num]").length > 0);
  const parsed = tiles.map((_, el) => ({
    type: $(el).attr("data-type") ?? "", division: $(el).attr("data-division") ?? "(none)",
    text: $(el).find("i[class*=t_num]").first().text().trim(),
  })).get();
  check(f, "a.play_log_btn[.//i.t_num] tiles", tiles.length > 0, `${tiles.length} tiles (${parsed.filter((p) => p.division === "grade").length} grade, ${parsed.filter((p) => p.division !== "grade").length} plate)`);
  const clear = $("div[class*=clear_w] div[class*=t1]").first().text().replace(/\s+/g, " ").trim();
  check(f, "div.clear_w div.t1 (Phoenix headline)", !!clear, clear || "absent (expected on Phoenix 2)");
  const select = $("select").filter((_, el) => ($(el).attr("onchange") ?? "").toLowerCase().includes("lv="));
  const buckets = select.first().find("option").map((_, o) => $(o).attr("value") ?? "").get();
  check(f, "select[onchange*=lv=] options → buckets", buckets.length > 0, buckets.join(","));
  console.log(`\n${f}:`);
  console.table(parsed.slice(0, 8));
}

// ---------- title.php ----------
{
  const f = "title.html";
  const $ = load(f);
  const lis = $("ul[class*=data_titleList2] > li");
  const titles = lis.map((_, el) => ({
    name: $(el).attr("data-name") ?? "",
    have: $(el).attr("class") === "have",
    col: ($(el).find("p").first().attr("class") ?? "").split(" ").find((c) => c.startsWith("col")) ?? "",
  })).get();
  check(f, "ul.data_titleList2 > li", lis.length > 0, `${lis.length} titles, ${titles.filter((t) => t.have).length} owned`);
  check(f, "li[data-name], li.have, p.col*", titles.every((t) => t.name) && titles.some((t) => t.col), "");
  const accountName = $("div[class*=name_w] > p[class*=t2]").first().text();
  check(f, "div.name_w > p.t2 → account name", !!accountName, accountName === "SCRUBBED_NAME" ? "matches (value scrubbed)" : `matched something else: "${accountName.slice(0, 20)}"`);
  const style = $("div[class*=profile_img] > div > div").first().attr("style") ?? "";
  check(f, "div.profile_img/div/div style ~ ImageRegex (avatar)", ImageRegex.test(style), "avatar URL scrubbed to a placeholder of the same shape");
  check(f, "div.login_wrap (RequiresLogin check)", false, `present ${$("div[class*=login_wrap]").length}x on a logged-in page: unusable as a login marker`);
  console.log(`\n${f}: titles=${titles.length}`);
  console.table(titles.slice(0, 5));
}

console.log("\nSelector checks:");
console.table(checks.map((c) => ({ page: c.page, selector: c.selector, result: c.ok ? "MATCH" : "NO MATCH", note: c.note })));
