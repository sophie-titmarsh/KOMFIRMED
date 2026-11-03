// Tells the front end which Strava app to send riders to. The secret never leaves the server.
export default function handler(req, res) {
  const clientId = process.env.STRAVA_CLIENT_ID || "";
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ clientId, configured: Boolean(clientId && process.env.STRAVA_CLIENT_SECRET) }));
}
