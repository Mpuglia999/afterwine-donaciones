import { getGoogleToken } from "./_google.js";
// Thank-you email for donors, sent from the code via Gmail API as "Fundación Desfibrilar" <donaciones@>.

const NOMBRES = { afterwine: "After Wine 2026", pulsoweek: "Pulso Week 2027", latidos: "Latidos" };
const LANDING = "https://afterwine.desfibrilar.org.ar/";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pesos = (n) => "$" + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

function fecha(iso) {
  try {
    return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
  } catch (e) { return ""; }
}

// d = { email, nombre, monto, proyecto, mensual (bool), fecha (ISO), operacion }
export function mailAgradecimiento(d) {
  const proyecto = NOMBRES[d.proyecto] || "Fundación Desfibrilar";
  const nombre = (d.nombre || "").trim().split(" ")[0];
  const saludo = nombre ? `¡Gracias, ${esc(nombre)}!` : "¡Gracias!";
  const subject = d.mensual
    ? "¡Bienvenido/a a la red de donantes mensuales de Desfibrilar!"
    : "¡Gracias por tu aporte a Fundación Desfibrilar!";

  const intro = d.mensual
    ? `Felicitaciones: desde hoy sos parte de quienes sostienen todos los meses una ciudad cardioprotegida. Tu aporte de <b>${pesos(d.monto)} por mes</b> para ${esc(proyecto)} ya está activo.`
    : `Felicitaciones: ya sos parte de una ciudad cardioprotegida. Recibimos tu aporte de <b>${pesos(d.monto)}</b> para ${esc(proyecto)}.`;

  const mensualNota = d.mensual
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#6B6363;">Mercado Pago te va a cobrar automáticamente cada mes. Podés pausarlo o cancelarlo cuando quieras desde la app de Mercado Pago, en <i>Tu perfil &gt; Suscripciones</i>.</p>`
    : "";

  const html = `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:0;background:#FAF7F5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F5;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#211C1C;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#141414;padding:22px 28px;">
    <div style="color:#ffffff;font-size:13px;letter-spacing:3px;font-weight:bold;">FUNDACIÓN <span style="color:#F05A61;">DESFIBRILAR</span></div>
  </td></tr>
  <tr><td style="background:#C41C24;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:32px 28px 8px;">
    <div style="font-size:30px;line-height:1.15;font-weight:bold;color:#141414;margin:0 0 14px;">${saludo} <span style="color:#C41C24;">&#10084;</span></div>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${intro}</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Con tu ayuda vamos a sumar <b>más desfibriladores</b> donde hoy no hay ninguno, <b>capacitar a más personas en RCP</b> y poner en marcha <b>PULSO 2027</b>, el movimiento que va a poner a latir a toda la ciudad.</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">Cada proyecto se comunica: te vamos a contar dónde está tu aporte.</p>
    ${mensualNota}
  </td></tr>
  <tr><td style="padding:0 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EBE6;border-radius:12px;">
      <tr><td style="padding:16px 18px;font-size:14px;line-height:1.8;color:#211C1C;">
        <b>Aporte:</b> ${pesos(d.monto)}${d.mensual ? " por mes" : ""}<br>
        <b>Destino:</b> ${esc(proyecto)}<br>
        ${d.fecha ? `<b>Fecha:</b> ${esc(fecha(d.fecha))}<br>` : ""}
        ${d.operacion ? `<b>N.º de operación:</b> ${esc(d.operacion)}` : ""}
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:24px 28px 8px;">
    <a href="${LANDING}" style="display:inline-block;background:#C41C24;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 28px;border-radius:10px;">Conocé After Wine y PULSO 2027</a>
  </td></tr>
  <tr><td style="padding:16px 28px 28px;">
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">¿Nos ayudás a llegar a más gente? Compartí que sos parte con <b>@desfibrilar #pulso2027</b>.</p>
    <p style="margin:0;font-size:15px;line-height:1.6;">Un abrazo grande,<br><b>Equipo de Fundación Desfibrilar</b><br><a href="https://www.desfibrilar.org.ar" style="color:#C41C24;">www.desfibrilar.org.ar</a></p>
  </td></tr>
  <tr><td style="background:#FAF7F5;padding:16px 28px;font-size:12px;line-height:1.6;color:#6B6363;">
    Mercado Pago te envía por separado el comprobante del pago. Si necesitás una constancia de donación a nombre de la Fundación, respondé este mail y te la mandamos.
  </td></tr>
</table>
</td></tr></table></body></html>`;

  const text = [
    saludo.replace(/<[^>]+>/g, ""),
    "",
    (d.mensual
      ? `Felicitaciones: desde hoy sos parte de quienes sostienen todos los meses una ciudad cardioprotegida. Tu aporte de ${pesos(d.monto)} por mes para ${proyecto} ya está activo.`
      : `Felicitaciones: ya sos parte de una ciudad cardioprotegida. Recibimos tu aporte de ${pesos(d.monto)} para ${proyecto}.`),
    "",
    "Con tu ayuda vamos a sumar más desfibriladores, capacitar a más personas en RCP y poner en marcha PULSO 2027.",
    "Cada proyecto se comunica: te vamos a contar dónde está tu aporte.",
    d.mensual ? "\nPodés pausarlo o cancelarlo cuando quieras desde Mercado Pago > Tu perfil > Suscripciones." : "",
    "",
    LANDING,
    "",
    "Un abrazo grande,",
    "Equipo de Fundación Desfibrilar",
    "www.desfibrilar.org.ar",
  ].join("\n");

  return { to: d.email, subject, html, text };
}

// Sends via Gmail API as the Fundación (service account + domain-wide delegation, scope gmail.send).
// MAIL_USER: Workspace mailbox that sends (default mpuglia@). MAIL_FROM: alias shown as sender.
// Reusable from any project: import { enviarMail } and pass { to, subject, html, text }.
export async function enviarMail(msg) {
  if (!msg || !msg.to) return false;
  if (process.env.MAIL_DISABLED === "1") return false;
  const user = process.env.MAIL_USER || "mpuglia@desfibrilar.org.ar";
  const from = process.env.MAIL_FROM || "donaciones@desfibrilar.org.ar";
  const fromName = msg.fromName || "Fundación Desfibrilar";
  const token = await getGoogleToken("https://www.googleapis.com/auth/gmail.send", user);

  const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
  const enc = (s) => `=?UTF-8?B?${b64(s)}?=`;
  const boundary = "dsf_" + Date.now().toString(36);
  const raw = [
    `From: ${enc(fromName)} <${from}>`,
    `To: ${msg.to}`,
    `Reply-To: ${msg.replyTo || from}`,
    `Subject: ${enc(msg.subject || "")}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(msg.text || "").replace(/.{76}/g, "$&\r\n"),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(msg.html || "").replace(/.{76}/g, "$&\r\n"),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(user)}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(raw, "utf8").toString("base64url") }),
  });
  if (!r.ok) throw new Error(`Gmail ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return true;
}
