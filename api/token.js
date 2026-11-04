// Exchanges a Strava OAuth code for tokens, or refreshes an expired access token.
// Strava requires the client secret for both, so this has to run server-side.
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = process.env;
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    return send(res, 500, { error: "Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET on the server." });
  }
  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: "Body must be JSON" }); }

  const params = new URLSearchParams({ client_id: STRAVA_CLIENT_ID, client_secret: STRAVA_CLIENT_SECRET });
  if (body.code) {
    params.set("code", String(body.code));
    params.set("grant_type", "authorization_code");
  } else if (body.refresh_token) {
    params.set("refresh_token", String(body.refresh_token));
    params.set("grant_type", "refresh_token");
  } else {
    return send(res, 400, { error: "Send either code or refresh_token" });
  }

  const r = await fetch("https://www.strava.com/oauth/token", { method: "POST", body: params });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return send(res, r.status, { error: data.message || "Strava rejected the token request", details: data.errors });

  // Only pass back what the browser needs.
  send(res, 200, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    scope: data.scope,
    athlete: data.athlete ? { id: data.athlete.id, firstname: data.athlete.firstname, lastname: data.athlete.lastname, sex: data.athlete.sex, weight: data.athlete.weight } : undefined,
  });
}
