// Source : API officielle "Offres d'emploi" de France Travail (ex Pôle Emploi).
// Doc : https://francetravail.io/data/api/offres-emploi
// Nécessite un compte développeur gratuit sur https://francetravail.io/
// -> créer une application, activer l'API "Offres d'emploi v2",
//    et récupérer un CLIENT_ID / CLIENT_SECRET.
//
// Cette source ne référence pas spécifiquement des VIE (France Travail liste
// surtout des CDI/CDD/stages), mais on cherche les offres qui mentionnent
// "VIE" ou "volontariat international" dans les mots-clés pour capter les
// entreprises qui publient aussi leur VIE là-bas.

const TOKEN_URL =
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire";
const API_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";

async function getAccessToken() {
  const clientId = process.env.FT_CLIENT_ID;
  const clientSecret = process.env.FT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.log("[franceTravail] FT_CLIENT_ID / FT_CLIENT_SECRET absents, source ignorée.");
    return null;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "api_offresdemploiv2 o2dsoffre",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    console.error("[franceTravail] Echec auth:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return data.access_token;
}

// Liste de recherches à combiner (mots-clés). On agrège les résultats et on
// dédoublonne par id d'offre.
const SEARCHES = [
  "VIE informatique",
  "volontariat international informatique",
  "VIE développeur",
  "VIE data",
];

export async function fetchFranceTravailOffers() {
  const token = await getAccessToken();
  if (!token) return [];

  const results = new Map();

  for (const motsCles of SEARCHES) {
    try {
      const url = new URL(API_URL);
      url.searchParams.set("motsCles", motsCles);
      url.searchParams.set("sort", "1"); // tri par date de création décroissante

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // L'API renvoie 206 (Partial Content) quand il y a des résultats paginés,
      // ce qui est normal, pas une erreur.
      if (res.status !== 200 && res.status !== 206) {
        console.error(`[franceTravail] "${motsCles}" ->`, res.status, await res.text());
        continue;
      }

      const data = await res.json();
      for (const offre of data.resultats || []) {
        results.set(offre.id, {
          id: `ft-${offre.id}`,
          title: offre.intitule,
          company: offre.entreprise?.nom || "Entreprise non précisée",
          location: offre.lieuTravail?.libelle || "Lieu non précisé",
          url: offre.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${offre.id}`,
          source: "France Travail",
          publishedAt: offre.dateCreation,
        });
      }
    } catch (err) {
      console.error(`[franceTravail] Erreur sur "${motsCles}":`, err.message);
    }
  }

  return Array.from(results.values());
}
