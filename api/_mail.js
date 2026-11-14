// Thank-you email for donors. Rendered here, sent by the Apps Script mailer at MAIL_WEBHOOK_URL
// (runs as the Fundación's Google account, sender name "Fundación Desfibrilar").

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

export async function enviarMail(msg) {
  const url = process.env.MAIL_WEBHOOK_URL;
  if (!url || !msg.to) return false;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg), redirect: "follow" });
  const t = await r.text();
  if (!r.ok || !/"ok"\s*:\s*true/.test(t)) throw new Error(`Mailer ${r.status}: ${t.slice(0, 200)}`);
  return true;
}
