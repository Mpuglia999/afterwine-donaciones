// Vercel Serverless Function — Mercado Pago Checkout Pro (sandbox)
// POST /api/create-preference
// Body: { amount: number, description?: string, recurring?: boolean }

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) return res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" });

  try {
    const { amount, description, recurring } = req.body || {};

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "amount is required and must be > 0" });
    }

    const preference = {
      items: [
        {
          title: description || "Donación After Wine - Fundación Desfibrilar",
          quantity: 1,
          currency_id: "ARS",
          unit_price: Number(amount),
        },
      ],
      back_urls: {
        success: "https://afterwine-donaciones.vercel.app/gracias",
        failure: "https://afterwine-donaciones.vercel.app/error",
        pending: "https://afterwine-donaciones.vercel.app/pendiente",
      },
      auto_return: "approved",
      statement_descriptor: "DESFIBRILAR",
      external_reference: `afterwine_${Date.now()}`,
    };

    const response = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify(preference),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("MP error:", data);
      return res.status(response.status).json({ error: data.message || "MP API error", details: data });
    }

    return res.status(200).json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
