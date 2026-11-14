// GET /api/totals?project=afterwine
// Public totals (no personal data): approved Mercado Pago donations + manual "Ajustes".
// Test-user payments (@testuser.com) are excluded.
import { loadData } from "./_google.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SA_EMAIL || !process.env.GOOGLE_SA_KEY) {
    return res.status(200).json({ total: 0, count: 0, by_project: {}, message: "Google Sheets not configured" });
  }

  try {
    const { donations, manuales } = await loadData();
    const filter = req.query.project || null;
    const byProject = {};
    const add = (p) => (byProject[p] = byProject[p] || { total: 0, online: 0, manual: 0, count: 0 });
    let online = 0, manual = 0, count = 0;

    for (const d of donations) {
      if (d.estado !== "approved" || d.prueba) continue;
      const p = add(d.proyecto);
      p.total += d.monto; p.online += d.monto; p.count += 1;
      if (!filter || d.proyecto === filter) { online += d.monto; count += 1; }
    }
    for (const m of manuales) {
      const p = add(m.proyecto);
      p.total += m.monto; p.manual += m.monto;
      if (!filter || m.proyecto === filter) manual += m.monto;
    }

    return res.status(200).json({
      total: Math.round(online + manual),
      online: Math.round(online),
      manual: Math.round(manual),
      count,
      by_project: byProject,
      filter,
      last_updated: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[totals] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
