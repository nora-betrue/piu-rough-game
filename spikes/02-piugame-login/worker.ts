// Worker runner for spike 2. Deployed as rg-spike-02 (delete it afterwards).
// GET /run with header `x-run-token: <RUN_TOKEN secret>`: one login, the five pages, then a
// sid-only re-use check (fresh client holding just the sid, like PIU Scores' ClientForSid).
// Returns summaries and the hop log only: never HTML, cookie values or credentials.
import { BASE, PoliteClient, fetchPages, login, summarise, type Hop } from "./login.ts";

type Env = { PIU_ID: string; PIU_PASSWORD: string; RUN_TOKEN: string };

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== "/run") return new Response("not found", { status: 404 });
    if (!env.RUN_TOKEN || req.headers.get("x-run-token") !== env.RUN_TOKEN)
      return new Response("forbidden", { status: 403 });

    const started = new Date().toISOString();
    const log: string[] = [];
    const printHop = (h: Hop) =>
      log.push(`#${h.n} [${h.step}] ${h.method} ${h.url} -> ${h.status ?? "ERR"} ${h.ms}ms` +
        (h.location ? ` location=${h.location}` : "") +
        (h.setCookies.length ? ` set-cookie=[${h.setCookies.join(", ")}]` : "") +
        (h.error ? ` error=${h.error}` : ""));
    const client = new PoliteClient(printHop);
    const out: Record<string, unknown> = { runtime: "workerd (deployed)", colo: (req as any).cf?.colo, started };
    try {
      const result = await login(client, env.PIU_ID, env.PIU_PASSWORD);
      out.result = result;
      if (!result.rejected) {
        out.pages = (await fetchPages(client)).map((p) => p.summary);
        const sid = client.jar.cookies.find((c) => c.name === "sid" && c.domain === "piugame.com");
        if (sid) {
          const reuse = new PoliteClient(printHop);
          reuse.jar.cookies.push({ ...sid, hostOnly: true });
          const r = await reuse.request("7 sid-only reuse", "GET", `${BASE}/my_page/title.php`);
          out.reuse = summarise("/my_page/title.php", r);
          out.requests = client.requests + reuse.requests;
        }
      }
    } catch (e) {
      out.error = String(e);
    }
    out.requests ??= client.requests;
    out.hops = client.hops;
    out.log = log;
    let json = JSON.stringify(out, null, 2);
    // Belt and braces: never echo a credential back.
    for (const secret of [env.PIU_ID, env.PIU_PASSWORD, env.PIU_ID.split("@")[0]])
      if (secret && json.includes(secret)) json = JSON.stringify({ error: "response contained a credential; suppressed" });
    return new Response(json, { headers: { "content-type": "application/json" } });
  },
};
