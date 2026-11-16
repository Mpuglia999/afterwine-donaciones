// GET /api/admin-sendas?key=DASHBOARD_KEY → registers MAIL_FROM as a "Send as" alias of MAIL_USER via Gmail API.
// Needs scope https://www.googleapis.com/auth/gmail.settings.sharing in the domain-wide delegation.
// Domain aliases added this way by a delegated service account are accepted without the verification email.
import { getGoogleToken } from "./_google.js";

export default async function handler(req, res) {
  const key = (req.query && req.query.key) || "";
  if (!process.env.DASHBOARD_KEY || key !== process.env.DASHBOARD_KEY) return res.status(401).json({ error: "unauthorized" });
  const user = process.env.MAIL_USER || "mpuglia@desfibrilar.org.ar";
  const from = process.env.MAIL_FROM || "donaciones@desfibrilar.org.ar";
  const name = (req.query && req.query.nombre) || "Fundación Desfibrilar";
  try {
    const token = await getGoogleToken("https://www.googleapis.com/auth/gmail.settings.sharing", user);
    const base = `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(user)}/settings/sendAs`;
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const body = JSON.stringify({ sendAsEmail: from, displayName: name, replyToAddress: from, treatAsAlias: true });
    let r = await fetch(base, { method: "POST", headers: h, body });
    if (r.status === 409) r = await fetch(`${base}/${encodeURIComponent(from)}`, { method: "PUT", headers: h, body });
    const data = await r.json().catch(() => ({}));
    const list = await (await fetch(base, { headers: h })).json().catch(() => ({}));
    return res.status(r.ok ? 200 : 500).json({
      ok: r.ok, status: r.status, resultado: data,
      alias: (list.sendAs || []).map((s) => ({ email: s.sendAsEmail, nombre: s.displayName, estado: s.verificationStatus || "principal" })),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
