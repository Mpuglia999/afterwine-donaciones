// Shared Google helpers (Service Account JWT). Files starting with "_" are not exposed as endpoints.
import crypto from "crypto";

const tokenCache = {};

// subject: optional Workspace user to impersonate (domain-wide delegation, e.g. to send Gmail)
export async function getGoogleToken(scope, subject) {
  const cacheKey = scope + "|" + (subject || "");
  const cached = tokenCache[cacheKey];
  if (cached && cached.exp > Date.now() + 60000) return cached.token;

  const email = process.env.GOOGLE_SA_EMAIL;
  const key = (process.env.GOOGLE_SA_KEY || "").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = b64({ alg: "RS256", typ: "JWT" }) + "." + b64(Object.assign({ iss: email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }, subject ? { sub: subject } : {}));
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(key, "base64url");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${signature}`,
  });
  if (!resp.ok) throw new Error("Google OAuth failed: " + (await resp.text()));
  const data = await resp.json();
  tokenCache[cacheKey] = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// Reads a range as raw numbers/strings (not "$10.000,00" formatted text).
export async function readRange(range) {
  const token = await getGoogleToken("https://www.googleapis.com/auth/spreadsheets.readonly");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (resp.status === 400) return []; // e.g. the "Ajustes" tab does not exist
  if (!resp.ok) throw new Error(`Sheets read error ${resp.status}: ${await resp.text()}`);
  return (await resp.json()).values || [];
}

// Writes: append one row to a tab, or overwrite row N (1-based) from column A.
export async function appendRow(tab, row) {
  const token = await getGoogleToken("https://www.googleapis.com/auth/spreadsheets");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(tab + "!A1")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ values: [row] }) });
  if (!r.ok) throw new Error(`Sheets append error ${r.status}: ${await r.text()}`);
  const d = await r.json().catch(() => ({}));
  const m = String((d.updates && d.updates.updatedRange) || "").match(/![A-Z]+(\d+)/);
  return m ? Number(m[1]) : null; // row number where it landed
}
export async function clearRow(tab, rowNumber) {
  const token = await getGoogleToken("https://www.googleapis.com/auth/spreadsheets");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(tab + "!A" + rowNumber + ":Z" + rowNumber)}:clear`;
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Sheets clear error ${r.status}: ${await r.text()}`);
}
export async function updateRow(tab, rowNumber, row) {
  const token = await getGoogleToken("https://www.googleapis.com/auth/spreadsheets");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(tab + "!A" + rowNumber)}?valueInputOption=USER_ENTERED`;
  const r = await fetch(url, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ values: [row] }) });
  if (!r.ok) throw new Error(`Sheets update error ${r.status}: ${await r.text()}`);
}

// Monthly donation catalog (fixed amounts per project). Plans are created once via /api/admin-planes.
export const PLANES_MENSUALES = {
  afterwine: { nombre: "After Wine 2026", montos: [5000, 10000, 20000, 50000] },
  pulsoweek: { nombre: "Pulso Week 2027", montos: [5000, 10000, 20000, 50000] },
};

export function toNumber(v) {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  // Accepts "$10.000,00", "10000", "10.000", "10000.5"
  let s = String(v).replace(/[^\d,.-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Donations (Hoja 1) + manual contributions (Ajustes), one entry per payment_id.
// Columns Hoja 1: 0 timestamp, 1 payment_id, 2 amount, 3 status, 4 email, 5 name,
// 6 project, 7 payment_type, 8 status_detail, 9 net, 10 fee, 11 release_date
export async function loadData() {
  const [rows, ajustes, subs] = await Promise.all([readRange("Hoja 1!A2:N"), readRange("Ajustes!A2:D"), readRange("Suscripciones!A2:H")]);
  const latest = new Map();
  rows.forEach((r) => { if (r && r[1]) latest.set(String(r[1]), r); });
  const donations = [...latest.values()].map((r) => {
    const email = r[4] || "";
    const amount = toNumber(r[2]);
    const net = r[9] === undefined || r[9] === "" ? null : toNumber(r[9]);
    return {
      fecha: r[0] || "",
      payment_id: r[1] ? String(r[1]) : "",
      monto: amount,
      estado: (r[3] || "").toLowerCase(),
      email,
      nombre: r[5] || "",
      proyecto: r[6] || "afterwine",
      medio: r[7] || "",
      detalle: r[8] || "",
      neto: net,
      comision: r[10] === undefined || r[10] === "" ? null : toNumber(r[10]),
      acreditacion: r[11] || "",
      prueba: /@testuser\.com$/i.test(email),
      tipo: r[12] || "unica",
      suscripcion: r[13] ? String(r[13]) : "",
    };
  });
  const suscripciones = subs.filter((r) => r[0]).map((r) => ({
    id: String(r[0]), alta: r[1] || "", email: r[2] || "", monto: toNumber(r[3]),
    estado: (r[4] || "").toLowerCase(), proyecto: r[5] || "afterwine", plan: r[6] || "", actualizado: r[7] || "",
  }));
  const manuales = ajustes
    .filter((r) => toNumber(r[2]) !== 0)
    .map((r) => ({ fecha: r[0] || "", concepto: r[1] || "", monto: toNumber(r[2]), proyecto: r[3] || "afterwine" }));
  return { donations, manuales, suscripciones };
}
