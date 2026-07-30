import { loadSeenIds, saveSeenIds } from "./state.js";
import { fetchBusinessFranceVieOffers } from "./sources/businessFranceVie.js";
import { fetchFranceTravailOffers } from "./sources/franceTravail.js";
import { sendDigestEmail } from "./emailer.js";
import { sendTelegramNotification } from "./notifier.js";

async function main() {
  const seen = await loadSeenIds();

  const [bfvOffers, ftOffers] = await Promise.all([
    fetchBusinessFranceVieOffers().catch((err) => {
      console.error("[businessFranceVie] Erreur:", err.message);
      return [];
    }),
    fetchFranceTravailOffers().catch((err) => {
      console.error("[franceTravail] Erreur:", err.message);
      return [];
    }),
  ]);

  const allOffers = [...bfvOffers, ...ftOffers];
  const newOffers = allOffers.filter((o) => !seen.has(o.id));

  console.log(
    `[index] ${allOffers.length} offres récupérées au total, ${newOffers.length} nouvelle(s).`
  );

  await Promise.all([
    sendDigestEmail(newOffers),
    sendTelegramNotification(newOffers).catch((err) =>
      console.error("[telegram] Erreur:", err.message)
    ),
  ]);

  newOffers.forEach((o) => seen.add(o.id));
  await saveSeenIds(seen);
}

main().catch((err) => {
  console.error("Erreur fatale:", err);
  process.exit(1);
});
