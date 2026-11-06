// Spike 2: piugame.com login flow, runnable in Node (>= 22.18, type stripping) and in a Worker.
// No cookie jar exists in either runtime's fetch, so this keeps its own and follows redirects by hand.
// Logs cookie NAMES only. Never log cookie values, the sid, or credentials.

export const BASE = "https://piugame.com";
export const AM_PASS = "https://am-pass.net";
export const MIN_GAP_MS = 250;
export const MAX_REQUESTS = 50;
const MAX_REDIRECTS = 10;
const USER_AGENT = "RoughGame-spike/0.2 (+https://roughgame.ing)";

export const PAGES = [
  "/my_page/my_best_score.php?&&page=1",
  "/my_page/recently_played.php",
  "/my_page/play_data.php",
  "/my_page/pumbility.php",
  "/my_page/title.php",
];

export type Hop = {
  n: number;
  step: string;
  method: string;
  url: string;
  status: number | null;
  location?: string;
  setCookies: string[];
  ms: number;
  error?: string;
};

// Query values can carry SSO tokens or the account id; keep only the ones we chose ourselves.
const SAFE_QUERY_KEYS = new Set(["page", "lv", "no", "t", "search"]);
export function redactUrl(raw: string, base?: string): string {
  let u: URL;
  try {
    u = new URL(raw, base);
  } catch {
    return "<unparseable>";
  }
  for (const key of [...u.searchParams.keys()]) {
    if (!SAFE_QUERY_KEYS.has(key)) u.searchParams.set(key, "REDACTED");
  }
  return u.toString();
}

type Cookie = { name: string; value: string; domain: string; hostOnly: boolean };

export class CookieJar {
  cookies: Cookie[] = [];

  store(requestUrl: string, setCookieHeaders: string[]): string[] {
    const host = new URL(requestUrl).hostname;
    const names: string[] = [];
    for (const header of setCookieHeaders) {
      const [pair, ...attrs] = header.split(";");
      const eq = pair.indexOf("=");
      if (eq < 1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      let domain = host;
      let hostOnly = true;
      let expired = false;
      let life = "";
      for (const attr of attrs) {
        const [k, v = ""] = attr.split("=").map((s) => s.trim());
        const key = k.toLowerCase();
        if (key === "domain" && v) {
          domain = v.replace(/^\./, "").toLowerCase();
          hostOnly = false;
        } else if (key === "max-age") {
          life = `max-age=${v}`;
          if (Number(v) <= 0) expired = true;
        } else if (key === "expires") {
          if (!life) life = `expires=${v}`;
          if (Date.parse(v) < Date.now()) expired = true;
        }
      }
      this.cookies = this.cookies.filter((c) => !(c.name === name && c.domain === domain));
      if (!expired && value !== "deleted") this.cookies.push({ name, value, domain, hostOnly });
      // Name plus lifetime attributes only (never the value). "session" = no Expires/Max-Age.
      names.push(expired || value === "deleted" ? `${name} (deleted)` : `${name} (${life || "session"})`);
    }
    return names;
  }

  header(url: string): string {
    const host = new URL(url).hostname;
    return this.cookies
      .filter((c) => (c.hostOnly ? host === c.domain : host === c.domain || host.endsWith("." + c.domain)))
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  }

  names(): string[] {
    return this.cookies.map((c) => `${c.name}@${c.hostOnly ? "" : "."}${c.domain}`);
  }

  find(prefix: string): Cookie | undefined {
    return this.cookies.find((c) => c.name.toLowerCase().startsWith(prefix));
  }
}

export class PoliteClient {
  jar = new CookieJar();
  hops: Hop[] = [];
  requests = 0;
  private last = 0;
  private log: (hop: Hop) => void;
  private budget: number;

  constructor(log: (hop: Hop) => void = () => {}, budget = MAX_REQUESTS) {
    this.log = log;
    this.budget = budget;
  }

  private async wait() {
    const gap = Date.now() - this.last;
    if (gap < MIN_GAP_MS) await new Promise((r) => setTimeout(r, MIN_GAP_MS - gap));
    this.last = Date.now();
  }

  /** Follows redirects by hand, storing cookies on every hop. Returns the final response's body. */
  async request(step: string, method: "GET" | "POST", url: string, form?: Record<string, string>) {
    let current = url;
    let currentMethod = method;
    let body: string | undefined = form ? new URLSearchParams(form).toString() : undefined;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      if (this.requests >= this.budget) throw new Error(`request budget (${this.budget}) exhausted`);
      await this.wait();
      this.requests++;
      const headers: Record<string, string> = { "user-agent": USER_AGENT, accept: "text/html,*/*" };
      const cookie = this.jar.header(current);
      if (cookie) headers.cookie = cookie;
      if (new URL(current).hostname.endsWith("piugame.com")) headers.origin = BASE;
      if (body) headers["content-type"] = "application/x-www-form-urlencoded";
      const hop: Hop = {
        n: this.requests,
        step,
        method: currentMethod,
        url: redactUrl(current),
        status: null,
        setCookies: [],
        ms: 0,
      };
      const t0 = Date.now();
      let res: Response;
      try {
        res = await fetch(current, { method: currentMethod, headers, body, redirect: "manual" });
      } catch (e) {
        hop.ms = Date.now() - t0;
        const err = e as Error & { cause?: { code?: string; message?: string } };
        hop.error = `${err.name}: ${err.message}${err.cause ? ` (cause: ${err.cause.code ?? err.cause.message})` : ""}`;
        this.hops.push(hop);
        this.log(hop);
        throw e;
      }
      hop.ms = Date.now() - t0;
      hop.status = res.status;
      hop.setCookies = this.jar.store(current, res.headers.getSetCookie());
      const location = res.headers.get("location");
      if (location) hop.location = redactUrl(location, current);
      this.hops.push(hop);
      this.log(hop);
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel();
        current = new URL(location, current).toString();
        if (res.status !== 307 && res.status !== 308) {
          currentMethod = "GET";
          body = undefined;
        }
        continue;
      }
      return { status: res.status, finalUrl: current, html: await res.text() };
    }
    throw new Error("too many redirects");
  }
}

export type PageSummary = {
  path: string;
  status: number;
  finalUrl: string;
  bytes: number;
  title: string | null;
  /** `.login_wrap` is in the site header on EVERY page, logged in or not, so this alone proves nothing. */
  loginWrap: boolean;
  /** The login form (`form[name=flogin]`) is rendered only for anonymous visitors. */
  loginForm: boolean;
  /** gnuboard's `var g5_is_member = "1"`: the reliable logged-in signal. */
  isMember: boolean;
  /** Treat as the login page when the form is shown or g5_is_member is not "1". */
  loginPage: boolean;
  /** gnuboard error pages are `alert("…"); document.location.replace(…)`. */
  alert?: string;
  bestScoreLayout?: "classic" | "redesign" | "neither";
};

export function summarise(path: string, r: { status: number; finalUrl: string; html: string }): PageSummary {
  const has = (cls: string) => new RegExp(`class="[^"]*\\b${cls}\\b`).test(r.html);
  const s: PageSummary = {
    path,
    status: r.status,
    finalUrl: redactUrl(r.finalUrl),
    bytes: r.html.length,
    title: r.html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? null,
    loginWrap: has("login_wrap"),
    loginForm: /<form[^>]*name="flogin"/.test(r.html),
    isMember: /g5_is_member\s*=\s*"1"/.test(r.html),
    loginPage: false,
  };
  s.loginPage = s.loginForm || !s.isMember;
  // Only gnuboard's alert page counts (alert + immediate redirect). Normal pages carry other
  // inline alert() calls, e.g. the game-ID change form's "It is the same as the existing Game ID."
  const alert = r.html.match(/alert\(\s*["']([^"']{0,200})["']\s*\);?\s*(?:document\.location\.replace|location\.href|history\.back)/)?.[1];
  if (alert) s.alert = alert;
  if (path.includes("my_best_score"))
    s.bestScoreLayout = has("my_best_scoreList") ? "classic" : has("recently_playeList") ? "redesign" : "neither";
  return s;
}

export type LoginResult = {
  sidCookie: boolean;
  sidCookieName?: string;
  cookieNamesAfterPost: string[];
  cookieNamesAfterSso: string[];
  /** Did the piugame `sid` value change on the POST? (A boolean only; the value is never exposed.) */
  sidChangedOnPost: boolean;
  postStatus: number;
  postBodyHint: string;
  /** gnuboard reports a rejected login as an alert() on a 200 page. */
  rejected: boolean;
};

/** Steps 1–4 of the brief. Throws only on transport errors; a rejected login is reported, not thrown. */
export async function login(client: PoliteClient, id: string, password: string): Promise<LoginResult> {
  await client.request("1 warm-up", "GET", `${BASE}/`);
  const sidBefore = client.jar.cookies.find((c) => c.name === "sid" && c.domain === "piugame.com")?.value;
  const post = await client.request("2 login POST", "POST", `${BASE}/bbs/login_check.php`, {
    url: "/",
    mb_id: id,
    mb_password: password,
  });
  const cookieNamesAfterPost = client.jar.names();
  const sid = client.jar.find("sid");
  const sidAfter = client.jar.cookies.find((c) => c.name === "sid" && c.domain === "piugame.com")?.value;
  // Pull out any alert() text (gnuboard reports login errors that way); never the page itself.
  const alert = post.html.match(/alert\(\s*["']([^"']{0,200})["']/)?.[1];
  const redirectJs = post.html.match(/location\.(?:replace|href)\s*\(?\s*=?\s*["']([^"']{0,200})["']/)?.[1];
  const postBodyHint = alert
    ? `alert: ${alert}`
    : `${post.html.length} bytes, title=${summarise("", post).title}` + (redirectJs ? `, js-redirect=${redactUrl(redirectJs, BASE)}` : "");
  await client.request("4 am-pass SSO", "GET", AM_PASS);
  return {
    sidCookie: !!sid,
    sidCookieName: sid?.name,
    cookieNamesAfterPost,
    cookieNamesAfterSso: client.jar.names(),
    sidChangedOnPost: !!sidBefore && !!sidAfter && sidBefore !== sidAfter,
    postStatus: post.status,
    postBodyHint,
    // Success is a 302 from login_check.php; a rejection is a 200 alert page.
    rejected: client.hops.find((h) => h.step.startsWith("2") && h.method === "POST")?.status !== 302,
  };
}

/** Step 5: fetch the authenticated pages. */
export async function fetchPages(client: PoliteClient, paths = PAGES) {
  const out: { summary: PageSummary; html: string }[] = [];
  for (const path of paths) {
    const r = await client.request(`5 ${path}`, "GET", `${BASE}${path}`);
    out.push({ summary: summarise(path, r), html: r.html });
  }
  return out;
}
