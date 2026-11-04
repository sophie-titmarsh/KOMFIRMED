// Daily job (Vercel Cron): for each confirmed subscription, forecast its segments and email new windows.
import { kv, getJSON, setJSON } from "../../lib/kv.js";
import { sendMail, esc, send } from "../../lib/mail.js";
import { prepareSeg, evaluateAll, findWindows, fetchForecast, tsOf, fmtWhen, compass, kmh, SAFETY } from "../../lib/model.js";

const HORIZON_H = 72;
const SAFE_COL = ["#17703D", "#A84F00", "#A3281C"];

export async function windowsFor(sub, forecast = fetchForecast) {
  const rider = { mass: sub.rider.mass, cda: sub.rider.cda, draft: 0, leadPct: 0 };
  const out = [];
  for (const s of sub.segments) {
    const seg = prepareSeg({ ...s, profile: s.profile || null });
    let f; try { f = await forecast(seg.lat, seg.lng); } catch { continue; }
    const { evals } = evaluateAll(seg, f, rider, s.T);
    const nowLocal = Date.now() + (f.utc_offset_seconds || 0) * 1000;
    const from = evals.findIndex((e) => tsOf(e.time) >= nowLocal + 36e5);
    if (from < 0) continue;
    const wins = findWindows(evals, from, { safetyFirst: sub.prefs.safetyFirst, includeMaybe: sub.prefs.includeMaybe, limit: 3, toIdx: from + HORIZON_H })
      .sort((a, b) => a.start.i - b.start.i);
    if (wins.length) out.push({ seg: s, wins });
  }
  return out;
}

function emailHTML(sub, found) {
  const unsub = `${sub.base}/api/alerts/unsubscribe?token=${sub.token}`;
  const blocks = found.map(({ seg, wins }) => `
    <h3 style="margin:18px 0 6px;font-size:17px;color:#D9530A">${esc(seg.name)}</h3>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">${wins.map((w) => {
      const endH = String((new Date(tsOf(w.end.time)).getUTCHours() + 1) % 24).padStart(2, "0") + ":00";
      const go = w.peak.verdict === "go";
      return `<tr><td style="padding:4px 12px 4px 0"><b>${esc(fmtWhen(w.start.time))}${w.start.i === w.end.i ? "" : "–" + endH}</b></td>
        <td style="padding:4px 12px 4px 0"><span style="background:${go ? "#1E8A4C" : "#E8710A"};color:#fff;border-radius:4px;padding:1px 7px">${go ? "Go" : "Maybe"}</span></td>
        <td style="padding:4px 12px 4px 0">${Math.round(-w.peak.wxGain) <= 0 ? "−" : "+"}${Math.abs(Math.round(w.peak.wxGain))} s vs still air</td>
        <td style="padding:4px 12px 4px 0">${compass(w.peak.from)} ${Math.round(kmh(w.peak.wind))} km/h, ${Math.round(w.peak.temp)}°C${w.peak.night ? ", after dark" : ""}</td>
        <td style="padding:4px 0;color:${SAFE_COL[w.safety]}">${SAFETY[w.safety]}</td></tr>`;
    }).join("")}</table>`).join("");
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#121820;max-width:620px">
    <h2 style="margin:0 0 4px"><span style="color:#D9530A">KOM</span>FIRMED</h2>
    <p style="margin:0 0 8px">Good windows coming up in the next 3 days:</p>${blocks}
    <p style="margin:20px 0 6px"><a href="${esc(sub.base)}" style="color:#1D4ED8">Open KOMFIRMED for the full forecast and pacing plan</a></p>
    <p style="font-size:13px;color:#5A6573">Strava is 4EVA, but… ride safe. Follow the road rules and pick quiet roads. Forecasts change, so check again before you go.</p>
    <p style="font-size:12px;color:#5A6573"><a href="${unsub}" style="color:#5A6573">Unsubscribe</a> and delete your alert details.</p></div>`;
}

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return send(res, 401, { error: "Unauthorised" });
  const tokens = (await kv("SMEMBERS", "subs")) || [];
  let sent = 0, checked = 0;
  for (const token of tokens) {
    const sub = await getJSON(`sub:${token}`);
    if (!sub) { await kv("SREM", "subs", token); continue; }
    if (!sub.confirmed) continue;
    checked++;
    try {
      const found = await windowsFor(sub);
      const sig = JSON.stringify(found.map(({ seg, wins }) => [seg.id, wins.map((w) => [w.start.time, w.end.time, w.peak.verdict])]));
      if (!found.length || sig === sub.lastSig) continue;
      await sendMail({ to: sub.email, subject: `Go window${found.length > 1 ? "s" : ""} on ${found.map((x) => x.seg.name).slice(0, 2).join(" and ")}${found.length > 2 ? " and more" : ""}`,
        html: emailHTML(sub, found), headers: { "List-Unsubscribe": `<${sub.base}/api/alerts/unsubscribe?token=${sub.token}>` } });
      sub.lastSig = sig; sub.lastSentAt = Date.now(); await setJSON(`sub:${token}`, sub); sent++;
    } catch (e) { console.error("alert failed", token, e.message); }
  }
  send(res, 200, { checked, sent });
}
