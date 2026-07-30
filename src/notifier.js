// Notification Telegram — gratuite, quasi instantanée sur le téléphone.
//
// Mise en place (5 min) :
// 1. Ouvre Telegram, cherche "@BotFather", envoie /newbot et suis les
//    instructions (choix d'un nom). Il te donne un token du type
//    "123456:ABC-DEF...".
// 2. Envoie N'IMPORTE QUEL message à ton nouveau bot (cherche-le par son
//    nom d'utilisateur et clique "Démarrer"/"Start").
// 3. Va sur cette URL dans ton navigateur (remplace TOKEN par le tien) :
//    https://api.telegram.org/botTOKEN/getUpdates
//    Cherche "chat":{"id": ... } dans la réponse -> c'est ton CHAT_ID.
// 4. Mets ces deux valeurs dans TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID
//    (dans .env en local, et dans les secrets GitHub Actions en prod).

function formatMessage(offers) {
  const lines = offers
    .slice(0, 20) // Telegram limite la taille d'un message ; on tronque si besoin
    .map((o) => `• ${o.title} — ${o.company} (${o.location})\n${o.url}`)
    .join("\n\n");

  const suffix = offers.length > 20 ? `\n\n...et ${offers.length - 20} autre(s).` : "";

  return `🎯 ${offers.length} nouvelle(s) offre(s) VIE / IT\n\n${lines}${suffix}`;
}

export async function sendTelegramNotification(offers) {
  if (offers.length === 0) return;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("[telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID absents, notif ignorée.");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatMessage(offers),
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    console.error("[telegram] Echec envoi:", res.status, await res.text());
    return;
  }
  console.log(`[telegram] Notification envoyée avec ${offers.length} offre(s).`);
}
