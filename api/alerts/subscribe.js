// POST: store a pending alert subscription and email a confirmation link (double opt-in).
import { randomUUID } from "node:crypto";
import { kv, setJSON } from "../../lib/kv.js";
import { sendMail, esc, baseUrl, readBody, send } from "../../lib/mail.js";

const num = (x) => typeof x === "number" && isFinite(x);
function cleanSegment(s) {
  if (!s || !Array.isArray(s.points) || s.points.length < 2 || s.points.length > 120) return null;
  if (!s.points.every((p) => Array.isArray(p) && p.length === 2 && num(p[0]) && num(p[1]))) return null;
  if (!num(s.distance) || !num(s.T) || s.distance <= 0 || s.distance > 200000 || s.T <= 0) return null;
  let profile = null;
  if (s.profile && Array.isArray(s.profile.d) && Array.isArray(s.profile.a) && s.profile.d.length === s.profile.a.length && s.profile.d.length <= 80 && s.profile.d.every(num) && s.profile.a.every(num)) profile = { d: s.profile.d, a: s.profile.a };
  return { id: String(s.id).slice(0, 40), name: String(s.name || "Segment").slice(0, 120), distance: s.distance, average_grade: num(s.average_grade) ? s.average_grade : 0,
    points: s.points, profile, T: s.T, label: ["KOM", "QOM", "PR", "est."].includes(s.label) ? s.label : "KOM" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  if (!process.env.RESEND_API_KEY || !process.env.ALERTS_FROM) return send(res, 501, { error: "Email alerts aren't switched on for this site yet." });
  let body; try { body = await readBody(req); } catch { return send(res, 400, { error: "Body must be JSON" }); }
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return send(res, 400, { error: "Enter a valid email address." });
  const segments = (Array.isArray(body.segments) ? body.segments : []).slice(0, 5).map(cleanSegment).filter(Boolean);
  if (!segments.length) return send(res, 400, { error: "Pick at least one segment." });
  const mass = Math.min(200, Math.max(40, +body.rider?.mass || 80)), cda = Math.min(0.6, Math.max(0.15, +body.rider?.cda || 0.32));
  const prefs = { safetyFirst: body.prefs?.safetyFirst !== false, includeMaybe: !!body.prefs?.includeMaybe };

  // One confirmation email per address every 10 minutes.
  const ok = await kv("SET", `rl:${email}`, "1", "NX", "EX", 600);
  if (!ok) return send(res, 429, { error: "We just sent a confirmation to that address. Check your inbox (and spam), or try again in 10 minutes." });

  const token = randomUUID();
  const base = baseUrl(req);
  await setJSON(`sub:${token}`, { token, email, segments, rider: { mass, cda }, prefs, confirmed: false, createdAt: Date.now(), base, lastSig: null });
  await kv("EXPIRE", `sub:${token}`, 60 * 60 * 48); // unconfirmed subscriptions vanish after 48 hours
  const link = `${base}/api/alerts/confirm?token=${token}`;
  await sendMail({
    to: email, subject: "Confirm your KOMFIRMED window alerts",
    html: `<p>Tap to start getting emails when a good window is forecast on: ${segments.map((s) => `<b>${esc(s.name)}</b>`).join(", ")}.</p>
      <p><a href="${link}" style="display:inline-block;background:#1D4ED8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Confirm alerts</a></p>
      <p style="color:#5A6573;font-size:13px">If you didn't ask for this, ignore this email and nothing will be sent.</p>`,
    text: `Confirm your KOMFIRMED window alerts: ${link}\nIf you didn't ask for this, ignore this email.`,
  });
  send(res, 200, { ok: true });
}
