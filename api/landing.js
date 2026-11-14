// GET /  -> After Wine landing.
// The HTML lives in Google Drive ("Brindis Desfibrilar - 2026/Claude outputs/After Wine 2026 - Landing web (index.html)"),
// shared read-only with the service account. Replacing that file updates the site (cache ~5 min).
import { getGoogleToken } from "./_google.js";

const FILE_ID = process.env.LANDING_FILE_ID || "1leYWVRccuIj4G0eaThBY0gcKCY3Ru0W_";
let cache = { html: null, at: 0 };

export default async function handler(req, res) {
  try {
    if (!cache.html || Date.now() - cache.at > 5 * 60 * 1000) {
      const token = await getGoogleToken("https://www.googleapis.com/auth/drive.readonly");
      const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Drive error ${resp.status}: ${await resp.text()}`);
      cache = { html: await resp.text(), at: Date.now() };
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    return res.status(200).send(cache.html);
  } catch (err) {
    console.error("[landing] Error:", err);
    if (cache.html) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(cache.html);
    }
    // Fallback: previous version of the landing (from the original Git deployment)
    try {
      const old = await fetch("https://afterwine-donaciones-gfi5xn6hf-mpuglia999s-projects.vercel.app/");
      if (old.ok) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, s-maxage=60");
        return res.status(200).send(await old.text());
      }
    } catch (e) {}
    return res.status(502).send("La página no está disponible en este momento. Probá de nuevo en unos minutos.");
  }
}
