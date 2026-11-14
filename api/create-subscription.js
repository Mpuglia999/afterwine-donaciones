// POST /api/create-subscription  { project, amount }
// Returns the Mercado Pago subscription link (init_point) of the pre-created monthly plan.
// Only amounts from the server-side catalog (PLANES_MENSUALES / "Planes" tab) are accepted.
import { readRange, PLANES_MENSUALES } from "./_google.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { project, amount } = req.body || {};
  const proyecto = String(project || "afterwine").toLowerCase();
  const monto = Math.round(Number(amount));
  const cfg = PLANES_MENSUALES[proyecto];
  if (!cfg || !cfg.montos.includes(monto)) {
    return res.status(400).json({ error: "monto_no_disponible", message: "Ese monto mensual no está disponible." });
  }

  try {
    const planes = await readRange("Planes!A2:E");
    const plan = planes.find((r) => r[1] === proyecto && Number(r[2]) === monto && r[0]);
    if (!plan) return res.status(503).json({ error: "plan_no_configurado", message: "La donación mensual todavía no está habilitada." });

    let initPoint = plan[4];
    if (!initPoint) {
      const r = await fetch(`https://api.mercadopago.com/preapproval_plan/${plan[0]}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      });
      const d = await r.json();
      initPoint = d.init_point;
    }
    if (!initPoint) return res.status(502).json({ error: "sin_link", message: "No pudimos generar el link. Probá de nuevo." });
    return res.status(200).json({ init_point: initPoint, plan_id: plan[0] });
  } catch (err) {
    console.error("[create-subscription] Error:", err);
    return res.status(500).json({ error: "error", message: "No pudimos procesar el pedido. Probá de nuevo." });
  }
}
