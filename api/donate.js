// GET /api/donate?amount=5000&project=afterwine
// Simple redirect-based donation (legacy endpoint)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) return res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" });

  const amount = parseInt(req.query.amount, 10);
  const project = req.query.project || "afterwine";
  if (!amount || amount <= 0) return res.status(400).json({ error: "amount query param required" });

  try {
    const externalRef = `${project}_${Date.now()}`;
    const preference = {
      items: [{ title: "Donación After Wine - Fundación Desfibrilar", quantity: 1, currency_id: "ARS", unit_price: amount }],
      back_urls: { success: "https://afterwine-donaciones.vercel.app/gracias", failure: "https://afterwine-donaciones.vercel.app/error", pending: "https://afterwine-donaciones.vercel.app/pendiente" },
      auto_return: "approved",
      statement_descriptor: "DESFIBRILAR",
      external_reference: externalRef,
      notification_url: "https://afterwine-donaciones.vercel.app/api/webhook",
    };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
      body: JSON.stringify(preference),
    });

    const data = await response.json();
    const checkoutUrl = data.init_point || data.sandbox_init_point;
    return res.redirect(302, checkoutUrl);
  } catch (err) {
    console.error("[donate] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
