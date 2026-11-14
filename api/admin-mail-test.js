// GET /api/admin-mail-test?key=DASHBOARD_KEY&tipo=unica|mensual
// Admin-only: sends a sample thank-you email to mpuglia@desfibrilar.org.ar to check the Gmail setup.
import { mailAgradecimiento, enviarMail } from "./_mail.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.DASHBOARD_KEY || req.query.key !== process.env.DASHBOARD_KEY) return res.status(401).json({ error: "PIN incorrecto" });
  try {
    const msg = mailAgradecimiento({
      email: "mpuglia@desfibrilar.org.ar", nombre: "Mariano", monto: 10000, proyecto: "afterwine",
      mensual: req.query.tipo === "mensual", fecha: new Date().toISOString(), operacion: "PRUEBA",
    });
    msg.subject = "[Prueba] " + msg.subject;
    await enviarMail(msg);
    return res.status(200).json({ ok: true, enviado_a: msg.to });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
