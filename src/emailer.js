import { Resend } from "resend";

function renderHtml(offers) {
  const rows = offers
    .map(
      (o) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">
          <a href="${o.url}" style="font-weight:600;color:#1a56db;text-decoration:none;">${o.title}</a><br/>
          <span style="color:#555;font-size:13px;">${o.company} — ${o.location}</span><br/>
          <span style="color:#999;font-size:12px;">${o.source}</span>
        </td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
    <h2 style="color:#111;">🎯 ${offers.length} nouvelle(s) offre(s) VIE / IT</h2>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    <p style="color:#999;font-size:12px;margin-top:20px;">
      Digest automatique généré ce matin. Sources : Business France (VIE), France Travail.
    </p>
  </div>`;
}

export async function sendDigestEmail(offers) {
  if (offers.length === 0) {
    console.log("[emailer] Aucune nouvelle offre, pas d'email envoyé.");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.DIGEST_TO_EMAIL;
  const from = process.env.DIGEST_FROM_EMAIL || "VIE Watcher <onboarding@resend.dev>";

  if (!apiKey || !to) {
    console.error("[emailer] RESEND_API_KEY ou DIGEST_TO_EMAIL manquant. Email non envoyé.");
    console.log(JSON.stringify(offers, null, 2));
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: `${offers.length} nouvelle(s) offre(s) VIE / IT`,
    html: renderHtml(offers),
  });

  if (error) {
    console.error("[emailer] Echec envoi:", error);
    throw new Error("Envoi email échoué");
  }
  console.log(`[emailer] Email envoyé avec ${offers.length} offre(s).`);
}
