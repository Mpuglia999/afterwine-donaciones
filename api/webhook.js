// POST /api/webhook — Mercado Pago notifications → Google Sheets ("Hoja 1")
// One row per payment_id: a repeated notification updates the existing row (status, net, release date).
import { getGoogleToken } from "./_google.js";

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets/";

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).send("OK");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) return res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" });

  try {
    const body = req.body || {};
    const q = req.query || {};
    console.log("[webhook] Received:", JSON.stringify(body), JSON.stringify(q));

    let paymentId = null;
    if ((body.type === "payment" || /^payment\./.test(body.action || "")) && body.data && body.data.id) paymentId = body.data.id;
    else if (q.type === "payment" && q["data.id"]) paymentId = q["data.id"];
    else if (q.topic === "payment" && q.id) paymentId = q.id;
    if (!paymentId) return res.status(200).json({ status: "ignored" });

    const pr = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
    if (!pr.ok) {
      console.error("[webhook] Failed to fetch payment:", pr.status);
      return res.status(200).json({ status: "payment_fetch_failed" });
    }
    const p = await pr.json();
    console.log("[webhook] Payment:", p.id, p.status, p.external_reference);

    const extRef = p.external_reference || "";
    const project = extRef.split("_").slice(0, -1).join("_") || extRef || "afterwine";
    const payer = p.payer || {};
    const td = p.transaction_details || {};
    const fees = (p.fee_details || []).reduce((s, f) => s + (Number(f.amount) || 0), 0);

    const row = [
      p.date_created ? new Date(p.date_created).toISOString() : new Date().toISOString(), // fecha del pago
      String(p.id),
      p.transaction_amount || 0,
      p.status || "",
      payer.email || "",
      ((payer.first_name || "") + " " + (payer.last_name || "")).trim(),
      project,
      p.payment_type_id || "",
      p.status_detail || "",
      td.net_received_amount != null ? td.net_received_amount : "", // neto_acreditado
      p.fee_details ? fees : "",                                     // comision_mp
      p.money_release_date ? String(p.money_release_date).slice(0, 10) : "", // fecha_acreditacion
    ];

    if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_KEY) {
      console.log("[webhook] Google Sheets:", await upsertRow(row));
    }
    return res.status(200).json({ status: "ok", payment_id: p.id });
  } catch (err) {
    console.error("[webhook] Error:", err);
    return res.status(200).json({ status: "error", message: err.message });
  }
}

async function upsertRow(row) {
  const token = await getGoogleToken("https://www.googleapis.com/auth/spreadsheets");
  const base = SHEETS + process.env.GOOGLE_SHEET_ID + "/values/";
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const r = await fetch(base + encodeURIComponent("Hoja 1!B:B"), { headers: auth });
  if (!r.ok) throw new Error(`Sheets read error ${r.status}: ${await r.text()}`);
  const ids = (await r.json()).values || [];
  let rowIndex = -1;
  for (let i = 1; i < ids.length; i++) {
    if (ids[i] && String(ids[i][0]) === row[1]) { rowIndex = i + 1; break; }
  }

  const url = rowIndex > 0
    ? base + encodeURIComponent(`Hoja 1!A${rowIndex}:L${rowIndex}`) + "?valueInputOption=USER_ENTERED"
    : base + encodeURIComponent("Hoja 1!A:L") + ":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS";
  const w = await fetch(url, { method: rowIndex > 0 ? "PUT" : "POST", headers: auth, body: JSON.stringify({ values: [row] }) });
  if (!w.ok) throw new Error(`Sheets write error ${w.status}: ${await w.text()}`);
  return rowIndex > 0 ? `updated row ${rowIndex}` : "appended";
}
