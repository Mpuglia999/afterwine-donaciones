// GET /api/admin-planes?key=DASHBOARD_KEY
// Admin-only: creates the monthly Mercado Pago plans (preapproval_plan) defined in PLANES_MENSUALES
// that do not exist yet, and stores them in the "Planes" tab. Safe to run more than once.
import { readRange, appendRow, PLANES_MENSUALES } from "./_google.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.DASHBOARD_KEY || (req.query.key || req.headers["x-dashboard-key"]) !== process.env.DASHBOARD_KEY) {
    return res.status(401).json({ error: "PIN incorrecto" });
  }
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" });

  try {
    const existentes = await readRange("Planes!A2:E");
    const resultado = [];
    for (const [proyecto, cfg] of Object.entries(PLANES_MENSUALES)) {
      for (const monto of cfg.montos) {
        const ya = existentes.find((r) => r[1] === proyecto && Number(r[2]) === monto && r[0]);
        if (ya) { resultado.push({ proyecto, monto, plan_id: ya[0], estado: "ya existía" }); continue; }

        const resp = await fetch("https://api.mercadopago.com/preapproval_plan", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: `Aporte mensual ${cfg.nombre} - Fundación Desfibrilar`,
            auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: monto, currency_id: "ARS" },
            back_url: "https://afterwine-donaciones.vercel.app/gracias?mensual=1",
          }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.id) {
          console.error("[admin-planes] MP error", resp.status, JSON.stringify(data));
          resultado.push({ proyecto, monto, error: data.message || `MP ${resp.status}` });
          continue;
        }
        await appendRow("Planes", [data.id, proyecto, monto, new Date().toISOString(), data.init_point || ""]);
        resultado.push({ proyecto, monto, plan_id: data.id, estado: "creado" });
      }
    }
    return res.status(200).json({ ok: true, planes: resultado });
  } catch (err) {
    console.error("[admin-planes] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
