// GET /api/widget-config
// Returns widget configuration (amounts, project info, etc.)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=60");

  return res.status(200).json({
    amounts: [5000, 10000, 25000, 50000],
    currency: "ARS",
    org: "Fundación Desfibrilar",
    projects: {
      afterwine: { name: "After Wine 2026", description: "Brindis solidario por la vida" },
      pulsoweek: { name: "Pulso Week 2027", description: "Semana de concientización cardíaca" },
      latidos: { name: "Latidos Wines", description: "Vinos que salvan vidas" },
    },
  });
}
