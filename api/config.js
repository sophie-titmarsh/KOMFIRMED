// Tells the front end which Strava app to send riders to. The secret never leaves the server.
export default function handler(req, res) {
  const clientId = process.env.STRAVA_CLIENT_ID || "";
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  // The CARTO basemaps key is public by design (it goes in every map tile URL).
  res.end(JSON.stringify({ clientId, configured: Boolean(clientId && process.env.STRAVA_CLIENT_SECRET), mapKey: process.env.CARTO_BASEMAPS_KEY || "",
    alerts: Boolean((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && process.env.RESEND_API_KEY && process.env.ALERTS_FROM) }));
}
