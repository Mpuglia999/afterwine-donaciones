// Shared Google helpers (Service Account JWT). Files starting with "_" are not exposed as endpoints.
import crypto from "crypto";

const tokenCache = {};

export async function getGoogleToken(scope) {
  const cached = tokenCache[scope];
  if (cached && cached.exp > Date.now() + 60000) return cached.token;

  const email = process.env.GOOGLE_SA_EMAIL;
  const key = (process.env.GOOGLE_SA_KEY || "").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({ iss: email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(key, "base64url");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${signature}`,
  });
  if (!resp.ok) throw new Error("Google OAuth failed: " + (await resp.text()));
  const data = await resp.json();
  tokenCache[scope] = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
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
  const [rows, ajustes] = await Promise.all([readRange("Hoja 1!A2:L"), readRange("Ajustes!A2:D")]);
  const latest = new Map();
  rows.forEach((r, i) => latest.set(r[1] ? String(r[1]) : `row_${i}`, r));
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
    };
  });
  const manuales = ajustes
    .filter((r) => toNumber(r[2]) !== 0)
    .map((r) => ({ fecha: r[0] || "", concepto: r[1] || "", monto: toNumber(r[2]), proyecto: r[3] || "afterwine" }));
  return { donations, manuales };
}
