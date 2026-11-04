// GET ?token=: delete a subscription and everything stored for it.
import { kv, getJSON } from "../../lib/kv.js";
import { page, send } from "../../lib/mail.js";

export default async function handler(req, res) {
  const token = new URL(req.url, "http://x").searchParams.get("token") || "";
  if (/^[0-9a-f-]{36}$/.test(token)) {
    const sub = await getJSON(`sub:${token}`);
    await kv("DEL", `sub:${token}`); await kv("SREM", "subs", token);
    if (sub) { const cur = await kv("GET", `email:${sub.email}`); if (cur === token) await kv("DEL", `email:${sub.email}`); }
  }
  send(res, 200, page("Unsubscribed", "<p>You're unsubscribed and your alert details have been deleted. You won't get any more emails.</p>"), "text/html; charset=utf-8");
}
