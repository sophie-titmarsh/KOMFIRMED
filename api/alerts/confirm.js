// GET ?token=: confirm a subscription (replaces any earlier one for the same email).
import { kv, getJSON, setJSON } from "../../lib/kv.js";
import { page, send, esc } from "../../lib/mail.js";

export default async function handler(req, res) {
  const token = new URL(req.url, "http://x").searchParams.get("token") || "";
  const sub = /^[0-9a-f-]{36}$/.test(token) ? await getJSON(`sub:${token}`) : null;
  if (!sub) return send(res, 404, page("Link expired", "<p>This link has expired or was already used. Turn alerts on again from the app.</p>"), "text/html; charset=utf-8");
  const old = await kv("GET", `email:${sub.email}`);
  if (old && old !== token) { await kv("DEL", `sub:${old}`); await kv("SREM", "subs", old); }
  sub.confirmed = true; sub.confirmedAt = Date.now();
  await setJSON(`sub:${token}`, sub);
  await kv("PERSIST", `sub:${token}`);
  await kv("SET", `email:${sub.email}`, token);
  await kv("SADD", "subs", token);
  send(res, 200, page("Alerts on", `<p>You're all set. We'll email <b>${esc(sub.email)}</b> when a good window is forecast on ${sub.segments.map((s) => esc(s.name)).join(", ")}.</p><p><a href="${esc(sub.base)}">Back to KOMFIRMED</a></p>`), "text/html; charset=utf-8");
}
