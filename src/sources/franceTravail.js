// Source : API officielle "Offres d'emploi" de France Travail (ex Pôle Emploi).
// Doc : https://francetravail.io/data/api/offres-emploi
//
// IMPORTANT : on ne cherche PAS motsCles="VIE ..." tout seul, car "vie" est un
// mot français courant (vie professionnelle, équilibre vie pro/perso, etc.) et
// la recherche motsCles est floue -> ça remontait plein d'offres sans rapport
// avec le dispositif VIE. On cherche donc la phrase complète, non ambiguë,
// "volontariat international en entreprise", puis on filtre nous-mêmes sur
// le domaine (logiciel / systèmes d'information) côté client.

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

// Recherche unique, non ambiguë : la phrase complète du dispositif.
const SEARCH_QUERY = "volontariat international en entreprise";

// Mots-clés utilisés pour ne garder que le domaine logiciel / systèmes d'info
// (ajuste cette liste librement si tu veux élargir ou resserrer).
const IT_KEYWORDS = [
  "informatique", "logiciel", "système d'information", "systeme d'information",
  "systèmes d'information", "systemes d'information", "SI ", "développeur",
  "developpeur", "ingénieur logiciel", "ingenieur logiciel", "data", "cloud",
  "devops", "cybersécurité", "cybersecurite", "réseau", "reseau", "IT ",
  "full stack", "fullstack", "backend", "frontend", "software", "UX/UI", "UX", "UI", "interface utilisateur", "user interface", "user experience"
];

function matchesItDomain(text) {
  const lower = text.toLowerCase();
  return IT_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

export async function fetchFranceTravailOffers() {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    const url = new URL(API_URL);
    url.searchParams.set("motsCles", SEARCH_QUERY);
    url.searchParams.set("sort", "1");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status !== 200 && res.status !== 206) {
      console.error("[franceTravail] Recherche échouée:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    const all = data.resultats || [];

    const itOnly = all.filter((offre) => {
      const text = `${offre.intitule || ""} ${offre.description || ""}`;
      return matchesItDomain(text);
    });

    console.log(
      `[franceTravail] ${all.length} offre(s) VIE trouvée(s), ${itOnly.length} après filtre logiciel/SI.`
    );

    return itOnly.map((offre) => ({
      id: `ft-${offre.id}`,
      title: offre.intitule,
      company: offre.entreprise?.nom || "Entreprise non précisée",
      location: offre.lieuTravail?.libelle || "Lieu non précisé",
      url: offre.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${offre.id}`,
      source: "France Travail",
      publishedAt: offre.dateCreation,
    }));
  } catch (err) {
    console.error("[franceTravail] Erreur:", err.message);
    return [];
  }
}
