// GET /api/dashboard  (header x-dashboard-key or ?key=)
// Full detail for the team: gross, net credited, fees, by project, by status, recent donations.
import { loadData } from "./_google.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const expected = process.env.DASHBOARD_KEY;
  const given = req.headers["x-dashboard-key"] || req.query.key || "";
  if (!expected) return res.status(500).json({ error: "DASHBOARD_KEY no configurada" });
  if (given !== expected) return res.status(401).json({ error: "PIN incorrecto" });

  try {
    const { donations, manuales, suscripciones } = await loadData();
    const filter = req.query.project || null;
    const inScope = (p) => !filter || p === filter;

    const t = { bruto: 0, neto: 0, comision: 0, sin_neto: 0, cantidad: 0, manual: 0, pendientes: 0, rechazadas: 0, pruebas: 0, cobrado_mensual: 0 };
    const byProject = {};
    const byMedio = {};
    const byDay = {};

    for (const d of donations) {
      if (!inScope(d.proyecto)) continue;
      if (d.prueba) { t.pruebas += 1; continue; }
      if (d.estado === "pending" || d.estado === "in_process" || d.estado === "authorized") t.pendientes += 1;
      if (d.estado === "rejected" || d.estado === "cancelled" || d.estado === "refunded" || d.estado === "charged_back") t.rechazadas += 1;
      if (d.estado !== "approved") continue;

      t.bruto += d.monto; t.cantidad += 1;
      if (d.tipo === "mensual") t.cobrado_mensual += d.monto;
      if (d.neto != null) { t.neto += d.neto; t.comision += d.comision != null ? d.comision : d.monto - d.neto; }
      else t.sin_neto += 1;

      const p = (byProject[d.proyecto] = byProject[d.proyecto] || { bruto: 0, neto: 0, cantidad: 0, manual: 0 });
      p.bruto += d.monto; p.neto += d.neto != null ? d.neto : 0; p.cantidad += 1;

      const m = (byMedio[d.medio || "otro"] = byMedio[d.medio || "otro"] || { bruto: 0, cantidad: 0 });
      m.bruto += d.monto; m.cantidad += 1;

      const day = String(d.fecha).slice(0, 10);
      byDay[day] = (byDay[day] || 0) + d.monto;
    }
    for (const m of manuales) {
      if (!inScope(m.proyecto)) continue;
      t.manual += m.monto;
      const p = (byProject[m.proyecto] = byProject[m.proyecto] || { bruto: 0, neto: 0, cantidad: 0, manual: 0 });
      p.manual += m.monto;
    }

    const subs = suscripciones.filter((x) => inScope(x.proyecto));
    const activas = subs.filter((x) => x.estado === "authorized");
    const mensual = {
      activos: activas.length,
      comprometido_mes: activas.reduce((acc, x) => acc + x.monto, 0),
      bajas: subs.filter((x) => x.estado === "cancelled" || x.estado === "canceled").length,
      pausadas: subs.filter((x) => x.estado === "paused").length,
      cobrado: t.cobrado_mensual,
    };

    const recientes = donations
      .filter((d) => inScope(d.proyecto))
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
      .slice(0, 100);

    return res.status(200).json({
      totales: { ...t, total: t.bruto + t.manual, promedio: t.cantidad ? t.bruto / t.cantidad : 0 },
      mensual,
      suscripciones: subs.sort((a, b) => String(b.alta).localeCompare(String(a.alta))).slice(0, 100),
      por_proyecto: byProject,
      por_medio: byMedio,
      por_dia: byDay,
      manuales: manuales.filter((m) => inScope(m.proyecto)),
      recientes,
      filtro: filter,
      actualizado: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[dashboard] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
