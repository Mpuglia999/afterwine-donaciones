// Vercel Serverless Function — Redirect to MP Checkout (GET)
// GET /api/donate?amount=25000&description=...
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) return res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" });

  try {
    const amount = parseInt(req.query.amount, 10);
    const description = req.query.description || "Donacion After Wine - Fundacion Desfibrilar";

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "amount is required and must be > 0" });
    }

    const preference = {
      items: [{
        title: description,
        quantity: 1,
        currency_id: "ARS",
        unit_price: amount,
      }],
      back_urls: {
        success: "https://afterwine-donaciones.vercel.app/gracias",
        failure: "https://afterwine-donaciones.vercel.app/error",
        pending: "https://afterwine-donaciones.vercel.app/pendiente",
      },
      auto_return: "approved",
      statement_descriptor: "DESFIBRILAR",
      external_reference: "afterwine_" + Date.now(),
    };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + ACCESS_TOKEN,
      },
      body: JSON.stringify(preference),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("MP error:", data);
      return res.status(500).json({ error: "No se pudo crear el pago" });
    }

    const redirectUrl = data.sandbox_init_point || data.init_point;
    return res.redirect(302, redirectUrl);
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
                        }
