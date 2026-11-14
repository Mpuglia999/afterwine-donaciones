// POST /api/webhook — Mercado Pago notifications → Google Sheets
// - payment: one row per payment_id in "Hoja 1" (repeated notifications update the same row)
// - subscription_preapproval: one row per subscription in "Suscripciones" (alta / pausa / baja)
// - subscription_authorized_payment: monthly charge → its payment is recorded as tipo "mensual"
import { loadData, readRange, appendRow, updateRow } from "./_google.js";

const MP = "https://api.mercadopago.com";
const NOMBRES = { afterwine: "After Wine 2026", pulsoweek: "Pulso Week 2027", latidos: "Latidos" };
const pesos = (n) => "$" + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

async function mp(path) {
  const r = await fetch(MP + path, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } });
  if (!r.ok) throw new Error(`MP ${path} → ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).send("OK");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.MP_ACCESS_TOKEN) return res.status(500).json({ error: "Missing MP_ACCESS_TOKEN" });

  try {
    const body = req.body || {};
    const q = req.query || {};
    console.log("[webhook] Received:", JSON.stringify(body), JSON.stringify(q));

    const type = body.type || q.type || q.topic || (String(body.action || "").split(".")[0]) || "";
    const id = (body.data && body.data.id) || q["data.id"] || q.id;
    if (!id) return res.status(200).json({ status: "ignored" });

    if (type === "payment") {
      await procesarPago(id, null);
    } else if (type === "subscription_preapproval") {
      await procesarSuscripcion(id);
    } else if (type === "subscription_authorized_payment") {
      const ap = await mp(`/authorized_payments/${id}`);
      const payId = ap.payment && ap.payment.id;
      if (payId) await procesarPago(payId, ap.preapproval_id || null);
    } else {
      return res.status(200).json({ status: "ignored", type });
    }
    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("[webhook] Error:", err);
    return res.status(200).json({ status: "error", message: err.message });
  }
}

// ---------- Plans / subscriptions → project ----------
async function proyectoDePlan(planId) {
  if (!planId) return null;
  const planes = await readRange("Planes!A2:C");
  const p = planes.find((r) => String(r[0]) === String(planId));
  return p ? p[1] : null;
}

async function proyectoDeSuscripcion(subId) {
  const subs = await readRange("Suscripciones!A2:G");
  const s = subs.find((r) => String(r[0]) === String(subId));
  if (s && s[5]) return s[5];
  try {
    const pre = await mp(`/preapproval/${subId}`);
    return (await proyectoDePlan(pre.preapproval_plan_id)) || "afterwine";
  } catch (e) {
    return "afterwine";
  }
}

// ---------- Payments ----------
async function procesarPago(paymentId, preapprovalId) {
  const p = await mp(`/v1/payments/${paymentId}`);
  console.log("[webhook] Payment:", p.id, p.status, p.external_reference);

  const subId = preapprovalId
    || (p.metadata && p.metadata.preapproval_id)
    || (p.point_of_interaction && p.point_of_interaction.transaction_data && p.point_of_interaction.transaction_data.subscription_id)
    || null;

  let project;
  if (subId) project = await proyectoDeSuscripcion(subId);
  else {
    const extRef = p.external_reference || "";
    project = extRef.split("_").slice(0, -1).join("_") || extRef || "afterwine";
  }

  const payer = p.payer || {};
  const td = p.transaction_details || {};
  const fees = (p.fee_details || []).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const row = [
    p.date_created ? new Date(p.date_created).toISOString() : new Date().toISOString(),
    String(p.id),
    p.transaction_amount || 0,
    p.status || "",
    payer.email || "",
    ((payer.first_name || "") + " " + (payer.last_name || "")).trim(),
    project,
    p.payment_type_id || "",
    p.status_detail || "",
    td.net_received_amount != null ? td.net_received_amount : "",
    p.fee_details ? fees : "",
    p.money_release_date ? String(p.money_release_date).slice(0, 10) : "",
    subId ? "mensual" : "unica",
    subId ? String(subId) : "",
  ];

  if (!process.env.GOOGLE_SHEET_ID) return;
  const rows = await readRange("Hoja 1!A1:N");
  let rowNumber = -1, prev = null;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i] && String(rows[i][1]) === row[1]) { rowNumber = i + 1; prev = rows[i]; break; }
  }
  // A later plain "payment" notification must not erase the subscription link found earlier
  if (prev && !subId && prev[13]) { row[6] = prev[6]; row[12] = prev[12]; row[13] = prev[13]; }
  if (rowNumber > 0) await updateRow("Hoja 1", rowNumber, row);
  else await appendRow("Hoja 1", row);

  const prevStatus = prev ? String(prev[3] || "").toLowerCase() : null;
  if (row[3] === "approved" && prevStatus !== "approved" && !/@testuser\.com$/i.test(row[4])) {
    await avisarChat(row).catch((e) => console.error("[webhook] Chat error:", e.message));
  }
}

// ---------- Subscriptions ----------
async function procesarSuscripcion(subId) {
  const pre = await mp(`/preapproval/${subId}`);
  const project = (await proyectoDePlan(pre.preapproval_plan_id)) || "afterwine";
  const ar = pre.auto_recurring || {};
  const estado = String(pre.status || "").toLowerCase();
  const row = [
    String(pre.id),
    pre.date_created ? new Date(pre.date_created).toISOString() : new Date().toISOString(),
    pre.payer_email || "",
    ar.transaction_amount || 0,
    estado,
    project,
    pre.preapproval_plan_id || "",
    new Date().toISOString(),
  ];
  const subs = await readRange("Suscripciones!A1:H");
  let rowNumber = -1, prevEstado = null;
  for (let i = 1; i < subs.length; i++) {
    if (subs[i] && String(subs[i][0]) === row[0]) { rowNumber = i + 1; prevEstado = String(subs[i][4] || "").toLowerCase(); break; }
  }
  if (rowNumber > 0) await updateRow("Suscripciones", rowNumber, row);
  else await appendRow("Suscripciones", row);

  if (estado !== prevEstado) {
    let msg = null;
    if (estado === "authorized") msg = `🔁 *Nuevo donante mensual ${NOMBRES[project] || project}: ${pesos(row[3])}/mes*\nDe: ${row[2] || "sin datos"}`;
    else if (estado === "cancelled" || estado === "canceled") msg = `⚠️ Baja de donante mensual ${NOMBRES[project] || project} (${pesos(row[3])}/mes)\nDe: ${row[2] || "sin datos"}`;
    else if (estado === "paused") msg = `⏸️ Donación mensual pausada (${pesos(row[3])}/mes) — ${row[2] || "sin datos"}`;
    if (msg) await enviarChat(msg + "\nTablero: https://afterwine-donaciones.vercel.app/dashboard").catch((e) => console.error("[webhook] Chat error:", e.message));
  }
}

// ---------- Google Chat ----------
async function enviarChat(text) {
  const hook = process.env.CHAT_WEBHOOK_URL;
  if (!hook) return;
  const r = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify({ text }) });
  if (!r.ok) throw new Error(`Chat ${r.status}: ${await r.text()}`);
}

async function avisarChat(row) {
  if (!process.env.CHAT_WEBHOOK_URL) return;
  const proyecto = row[6];
  let total = null;
  try {
    const { donations, manuales } = await loadData();
    total = donations.filter((d) => d.estado === "approved" && !d.prueba && d.proyecto === proyecto).reduce((s, d) => s + d.monto, 0)
      + manuales.filter((m) => m.proyecto === proyecto).reduce((s, m) => s + m.monto, 0);
  } catch (e) {}
  const lineas = [
    `💛 *Nueva donación ${row[12] === "mensual" ? "mensual " : ""}${NOMBRES[proyecto] || proyecto}: ${pesos(row[2])}*`,
    `De: ${row[5] || row[4] || "sin datos"}`,
    row[9] !== "" ? `Neto acreditado: ${pesos(row[9])}` : null,
    total != null ? `Total recaudado: ${pesos(total)}` : null,
    "Tablero: https://afterwine-donaciones.vercel.app/dashboard",
  ].filter(Boolean);
  await enviarChat(lineas.join("\n"));
}
